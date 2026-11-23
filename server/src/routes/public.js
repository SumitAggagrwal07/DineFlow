// Customer-facing endpoints. No login: customers arrive by scanning a QR code.
const router = require('express').Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const ServiceCall = require('../models/ServiceCall');
const WaitingEntry = require('../models/WaitingEntry');
const { asyncHandler, httpError, token, round2 } = require('../utils/helpers');
const { emitOrder, emitCall } = require('../utils/realtime');

const limiter = (limit) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, slow down a little' },
  });

const PUBLIC_FIELDS = 'name slug logo accent tableCount currency taxPercent phone address paymentQr isOpen';

async function getRestaurant(slug) {
  const r = await Restaurant.findOne({ slug: String(slug).toLowerCase(), isActive: true });
  if (!r) throw httpError(404, 'Restaurant not found');
  return r;
}

// Menu + restaurant info (used by both table QR and wall QR)
router.get(
  '/r/:slug',
  asyncHandler(async (req, res) => {
    const r = await getRestaurant(req.params.slug);
    const items = await MenuItem.find({ restaurant: r._id })
      .sort({ category: 1, sortOrder: 1, name: 1 })
      .select('-restaurant -createdAt -updatedAt -__v');
    const restaurant = await Restaurant.findById(r._id).select(PUBLIC_FIELDS);
    res.json({ restaurant, items });
  })
);

router.post(
  '/r/:slug/orders',
  limiter(20),
  asyncHandler(async (req, res) => {
    const r = await getRestaurant(req.params.slug);
    if (!r.isOpen) throw httpError(403, 'This restaurant is not taking orders right now');

    const table = Number(req.body.tableNumber);
    if (!Number.isInteger(table) || table < 1 || table > r.tableCount) throw httpError(400, 'Invalid table number');

    const lines = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
    if (!lines.length) throw httpError(400, 'Your cart is empty');

    const ids = lines.map((l) => l.menuItemId).filter((id) => mongoose.isValidObjectId(id));
    const menu = await MenuItem.find({ restaurant: r._id, _id: { $in: ids } });
    const byId = new Map(menu.map((m) => [String(m._id), m]));

    const items = [];
    let maxPrep = 0;
    for (const l of lines) {
      const m = byId.get(String(l.menuItemId));
      const qty = Math.floor(Number(l.qty));
      const portion = l.portion === 'half' ? 'half' : 'full';
      if (!m) throw httpError(400, 'Some items are no longer on the menu');
      if (!m.available) throw httpError(409, `${m.name} just ran out`);
      if (!(qty >= 1 && qty <= 20)) throw httpError(400, 'Invalid quantity');
      
      // Calculate unit price based on portion (half is 60% of full price, rounded)
      const unitPrice = portion === 'half' ? round2(m.price * 0.6) : m.price;

      items.push({
        menuItem: m._id,
        name: portion === 'half' ? `${m.name} (Half)` : m.name,
        price: unitPrice, // calculated from database price
        qty,
        portion,
        note: String(l.note || '').slice(0, 140),
        veg: m.veg,
      });
      maxPrep = Math.max(maxPrep, m.prepMinutes || 0);
    }

    const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
    const tax = round2((subtotal * r.taxPercent) / 100);
    const total = round2(subtotal + tax);
    const d = new Date();
    const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    const order = await Order.create({
      restaurant: r._id,
      tableNumber: table,
      items,
      customerName: String(req.body.customerName || '').slice(0, 60),
      notes: String(req.body.notes || '').slice(0, 200),
      subtotal,
      tax,
      total,
      taxPercent: r.taxPercent,
      billNo: `${r.slug.slice(0, 3).toUpperCase()}-${stamp}-${token(2).toUpperCase()}`,
      prepMinutes: maxPrep || r.defaultPrepMinutes,
      accessToken: token(16),
    });

    emitOrder(req.app.get('io'), order, 'order:new');
    res.status(201).json(order);
  })
);

router.get(
  '/orders/:token',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ accessToken: String(req.params.token) });
    if (!order) throw httpError(404, 'Order not found');
    res.json(order);
  })
);

// Payment. UPI/card go through the demo gateway below - swap in Razorpay/Stripe here.
router.post(
  '/orders/:token/pay',
  limiter(15),
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ accessToken: String(req.params.token) });
    if (!order) throw httpError(404, 'Order not found');
    if (order.status === 'cancelled') throw httpError(400, 'This order was cancelled');
    if (order.payment.status === 'paid') return res.json(order);

    const method = req.body.method;
    if (!['upi', 'card', 'cash', 'phonepe', 'googlepay', 'applepay'].includes(method)) throw httpError(400, 'Choose a payment method');

    if (method === 'cash') {
      order.payment = { status: 'cash_requested', method: 'cash' };
      const exists = await ServiceCall.exists({
        restaurant: order.restaurant,
        tableNumber: order.tableNumber,
        type: 'bill',
        status: 'open',
      });
      if (!exists) {
        const call = await ServiceCall.create({
          restaurant: order.restaurant,
          tableNumber: order.tableNumber,
          type: 'bill',
        });
        emitCall(req.app.get('io'), call, 'call:new');
      }
    } else {
      // ---- DEMO GATEWAY: replace with a real payment provider + webhook verification ----
      order.payment = {
        status: 'paid',
        method,
        paidAt: new Date(),
        reference: `DEMO-${token(4).toUpperCase()}`,
      };
    }
    await order.save();
    emitOrder(req.app.get('io'), order);
    res.json(order);
  })
);

// "Help" / "bring the bill" button
router.post(
  '/r/:slug/calls',
  limiter(10),
  asyncHandler(async (req, res) => {
    const r = await getRestaurant(req.params.slug);
    const table = Number(req.body.tableNumber);
    if (!Number.isInteger(table) || table < 1 || table > r.tableCount) throw httpError(400, 'Invalid table number');
    const validTypes = ['help', 'bill', 'water', 'napkin'];
    const type = validTypes.includes(req.body.type) ? req.body.type : 'help';
    const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
    const unitPrice = type === 'water' ? 20 : 0; // ₹20 per mineral water bottle, napkins free (₹0)
    const totalPrice = unitPrice * quantity;

    let call = await ServiceCall.create({
      restaurant: r._id,
      tableNumber: table,
      type,
      quantity,
      unitPrice,
      totalPrice,
    });
    emitCall(req.app.get('io'), call, 'call:new');
    res.status(201).json(call);
  })
);

// Customer requests a table from wall QR (no table number assigned yet)
router.post(
  '/r/:slug/request-table',
  limiter(5),
  asyncHandler(async (req, res) => {
    const r = await getRestaurant(req.params.slug);
    const { customerName, phone, partySize, notes } = req.body;
    if (!String(customerName || '').trim()) throw httpError(400, 'Your name is required');

    // Auto-calculate wait time based on latest active order
    let waitMins = 15;
    const latestActive = await Order.findOne({
      restaurant: r._id,
      status: { $in: ['placed', 'preparing', 'ready'] },
    }).sort({ etaAt: -1 });
    if (latestActive?.etaAt) {
      const remaining = Math.max(0, Math.ceil((new Date(latestActive.etaAt) - Date.now()) / 60000));
      waitMins = remaining + 10;
    }

    const etaSeatedAt = new Date(Date.now() + waitMins * 60000);
    const entry = await WaitingEntry.create({
      restaurant: r._id,
      customerName: String(customerName).trim().slice(0, 80),
      phone: String(phone || '').trim().slice(0, 20),
      partySize: Math.max(1, parseInt(partySize, 10) || 1),
      notes: String(notes || '').slice(0, 200),
      estimatedWaitMinutes: waitMins,
      etaSeatedAt,
      source: 'qr',
    });

    // Notify receptionist/owner
    req.app.get('io')?.to(`rest:${r._id}`).emit('waiting:new', entry);
    res.status(201).json({ entry, estimatedWaitMinutes: waitMins });
  })
);

module.exports = router;
