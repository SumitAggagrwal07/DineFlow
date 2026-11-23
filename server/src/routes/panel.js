// Everything a signed-in restaurant user (owner / chef / waiter / receptionist) can do.
const router = require('express').Router();
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const Order = require('../models/Order');
const ServiceCall = require('../models/ServiceCall');
const WaitingEntry = require('../models/WaitingEntry');
const { protect, allow } = require('../middleware/auth');
const { asyncHandler, httpError, token } = require('../utils/helpers');
const { emitOrder, emitCall, menuRoom, tableRoom } = require('../utils/realtime');

router.use(protect, (req, res, next) => {
  if (!req.user.restaurant) return next(httpError(403, 'No restaurant is linked to this account'));
  next();
});

const rid = (req) => req.user.restaurant;
const io = (req) => req.app.get('io');
const validId = (id) => mongoose.isValidObjectId(id);

/* ------------------------------ restaurant ------------------------------ */

router.get(
  '/restaurant',
  asyncHandler(async (req, res) => {
    res.json(await Restaurant.findById(rid(req)));
  })
);

router.put(
  '/restaurant',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const r = await Restaurant.findById(rid(req));
    const b = req.body;

    if (b.name !== undefined) {
      if (!String(b.name).trim()) throw httpError(400, 'Restaurant name cannot be empty');
      r.name = String(b.name).trim().slice(0, 80);
    }
    if (b.logo !== undefined) {
      if (String(b.logo).length > 600000) throw httpError(400, 'Logo is too large (max about 400 KB)');
      r.logo = String(b.logo);
    }
    if (b.accent !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(b.accent)) throw httpError(400, 'Accent must be a hex colour');
      r.accent = b.accent;
    }
    if (b.tableCount !== undefined) {
      const n = parseInt(b.tableCount, 10);
      if (!(n >= 1 && n <= 200)) throw httpError(400, 'Tables must be between 1 and 200');
      r.tableCount = n;
    }
    if (b.taxPercent !== undefined) {
      const n = Number(b.taxPercent);
      if (!(n >= 0 && n <= 40)) throw httpError(400, 'Tax must be between 0 and 40');
      r.taxPercent = n;
    }
    if (b.defaultPrepMinutes !== undefined) {
      const n = parseInt(b.defaultPrepMinutes, 10);
      if (!(n >= 1 && n <= 180)) throw httpError(400, 'Default prep time must be 1-180 minutes');
      r.defaultPrepMinutes = n;
    }
    if (b.currency !== undefined) r.currency = String(b.currency).slice(0, 4) || '₹';
    if (b.phone !== undefined) r.phone = String(b.phone).slice(0, 30);
    if (b.address !== undefined) r.address = String(b.address).slice(0, 200);
    if (b.paymentQr !== undefined) {
      if (String(b.paymentQr).length > 800000) throw httpError(400, 'Payment QR image is too large');
      r.paymentQr = String(b.paymentQr);
    }
    if (b.isOpen !== undefined) r.isOpen = !!b.isOpen;

    await r.save();
    io(req)?.to(menuRoom(r.slug)).emit('menu:update');
    res.json(r);
  })
);

/* --------------------------------- menu --------------------------------- */

async function notifyMenu(req) {
  const r = await Restaurant.findById(rid(req)).select('slug');
  if (r) io(req)?.to(menuRoom(r.slug)).emit('menu:update');
}

function menuPayload(b) {
  const price = Number(b.price);
  if (!String(b.name || '').trim()) throw httpError(400, 'Item name is required');
  if (!(price >= 0)) throw httpError(400, 'Enter a valid price');
  const prep = parseInt(b.prepMinutes, 10);
  return {
    name: String(b.name).trim().slice(0, 100),
    description: String(b.description || '').slice(0, 300),
    price,
    category: String(b.category || 'Mains').trim().slice(0, 40) || 'Mains',
    veg: b.veg !== false && b.veg !== 'false',
    image: String(b.image || '').slice(0, 500),
    available: b.available !== false && b.available !== 'false',
    prepMinutes: prep >= 0 && prep <= 180 ? prep : 15,
  };
}

router.get(
  '/menu',
  asyncHandler(async (req, res) => {
    res.json(await MenuItem.find({ restaurant: rid(req) }).sort({ category: 1, sortOrder: 1, name: 1 }));
  })
);

router.post(
  '/menu',
  allow('owner'),
  asyncHandler(async (req, res) => {
    const item = await MenuItem.create({ ...menuPayload(req.body), restaurant: rid(req) });
    await notifyMenu(req);
    res.status(201).json(item);
  })
);

router.put(
  '/menu/:id',
  allow('owner'),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, 'Item not found');
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, restaurant: rid(req) },
      menuPayload(req.body),
      { new: true, runValidators: true }
    );
    if (!item) throw httpError(404, 'Item not found');
    await notifyMenu(req);
    res.json(item);
  })
);

router.patch(
  '/menu/:id/availability',
  allow('owner', 'chef'),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, 'Item not found');
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, restaurant: rid(req) },
      { available: !!req.body.available },
      { new: true }
    );
    if (!item) throw httpError(404, 'Item not found');
    await notifyMenu(req);
    res.json(item);
  })
);

router.delete(
  '/menu/:id',
  allow('owner'),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, 'Item not found');
    await MenuItem.deleteOne({ _id: req.params.id, restaurant: rid(req) });
    await notifyMenu(req);
    res.json({ ok: true });
  })
);

/* -------------------------------- staff --------------------------------- */

router.get(
  '/staff',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const staff = await User.find({ restaurant: rid(req), role: { $in: ['chef', 'waiter', 'receptionist'] } }).sort({ createdAt: -1 });
    res.json(staff.map((s) => s.toSafe()));
  })
);

router.post(
  '/staff',
  allow('owner'),
  asyncHandler(async (req, res) => {
    const { name, phone, email, password, role } = req.body;
    if (!['chef', 'waiter', 'receptionist'].includes(role)) throw httpError(400, 'Role must be chef, waiter, or receptionist');
    if (!String(name || '').trim()) throw httpError(400, 'Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) throw httpError(400, 'Enter a valid email');
    if (String(password || '').length < 6) throw httpError(400, 'Password must be at least 6 characters');
    if (await User.exists({ email: String(email).toLowerCase() })) throw httpError(409, 'That email is already in use');
    const user = await User.create({
      name: name.trim(),
      phone: String(phone || '').trim().slice(0, 30),
      email,
      password,
      role,
      restaurant: rid(req),
    });
    res.status(201).json(user.toSafe());
  })
);

router.patch(
  '/staff/:id',
  allow('owner'),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, 'Staff member not found');
    const user = await User.findOne({ _id: req.params.id, restaurant: rid(req), role: { $in: ['chef', 'waiter', 'receptionist'] } });
    if (!user) throw httpError(404, 'Staff member not found');
    if (req.body.name !== undefined && String(req.body.name).trim()) user.name = String(req.body.name).trim();
    if (req.body.phone !== undefined) user.phone = String(req.body.phone).trim().slice(0, 30);
    if (req.body.active !== undefined) user.active = !!req.body.active;
    if (req.body.password) {
      if (String(req.body.password).length < 6) throw httpError(400, 'Password must be at least 6 characters');
      user.password = String(req.body.password);
    }
    await user.save();
    res.json(user.toSafe());
  })
);

router.delete(
  '/staff/:id',
  allow('owner'),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, 'Staff member not found');
    await User.deleteOne({ _id: req.params.id, restaurant: rid(req), role: { $in: ['chef', 'waiter', 'receptionist'] } });
    res.json({ ok: true });
  })
);

/* -------------------------------- orders -------------------------------- */

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orders = await Order.find({
      restaurant: rid(req),
      $or: [{ createdAt: { $gte: since } }, { status: { $in: ['placed', 'preparing', 'ready'] } }],
    })
      .sort({ createdAt: -1 })
      .limit(300);
    res.json(orders);
  })
);

async function loadOrder(req) {
  if (!validId(req.params.id)) throw httpError(404, 'Order not found');
  const order = await Order.findOne({ _id: req.params.id, restaurant: rid(req) });
  if (!order) throw httpError(404, 'Order not found');
  return order;
}

// Chef / owner: set the preparation time. This starts (or restarts) the customer's countdown.
router.patch(
  '/orders/:id/prep',
  allow('owner', 'chef'),
  asyncHandler(async (req, res) => {
    const order = await loadOrder(req);
    if (['served', 'cancelled'].includes(order.status)) throw httpError(400, 'This order is already closed');
    const minutes = parseInt(req.body.minutes, 10);
    if (!(minutes >= 1 && minutes <= 180)) throw httpError(400, 'Time must be between 1 and 180 minutes');

    const now = new Date();
    order.prepMinutes = minutes;
    order.etaAt = new Date(now.getTime() + minutes * 60000);
    if (order.status === 'placed') {
      order.status = 'preparing';
      order.startedAt = now;
    }
    await order.save();
    emitOrder(io(req), order);
    res.json(order);
  })
);

router.patch(
  '/orders/:id/status',
  allow('owner', 'chef', 'waiter', 'receptionist'),
  asyncHandler(async (req, res) => {
    const order = await loadOrder(req);
    const next = req.body.status;
    const role = req.user.role;
    const allowed = {
      owner: ['preparing', 'ready', 'served', 'cancelled'],
      chef: ['preparing', 'ready', 'cancelled'],
      waiter: ['served'],
      receptionist: ['cancelled'],
    }[role];
    if (!allowed || !allowed.includes(next)) throw httpError(403, 'You cannot set this status');
    if (['served', 'cancelled'].includes(order.status)) throw httpError(400, 'This order is already closed');

    const now = new Date();
    if (next === 'preparing' && !order.startedAt) {
      order.startedAt = now;
      order.etaAt = new Date(now.getTime() + (order.prepMinutes || 15) * 60000);
    }
    if (next === 'ready') {
      order.readyAt = now;
      // Alert waiter that food is ready to serve
      io(req)?.to(`rest:${rid(req)}`).emit('alert:waiter', {
        type: 'order_ready',
        tableNumber: order.tableNumber,
        billNo: order.billNo,
        message: `Order for Table ${order.tableNumber} is READY! Waiter please pick up and serve.`,
      });
    }
    if (next === 'served') {
      order.servedAt = now;
      if (!order.readyAt) order.readyAt = now;
      // Alert owner that order was successfully served
      io(req)?.to(`rest:${rid(req)}`).emit('alert:owner', {
        type: 'order_served',
        tableNumber: order.tableNumber,
        billNo: order.billNo,
        servedBy: req.user.name,
        message: `Table ${order.tableNumber} order successfully served by ${req.user.name}.`,
      });
    }
    order.status = next;
    await order.save();
    emitOrder(io(req), order);
    res.json(order);
  })
);

// Waiter / owner / receptionist: customer paid at the table (cash, or card machine).
router.patch(
  '/orders/:id/pay',
  allow('owner', 'waiter', 'receptionist'),
  asyncHandler(async (req, res) => {
    const order = await loadOrder(req);
    const method = ['upi', 'card', 'cash', 'razorpay', 'phonepe', 'googlepay'].includes(req.body.method) ? req.body.method : 'cash';
    order.payment = { status: 'paid', method, paidAt: new Date(), reference: `MANUAL-${req.user.role}-${token(4).toUpperCase()}` };
    await order.save();

    const open = await ServiceCall.find({
      restaurant: rid(req),
      tableNumber: order.tableNumber,
      type: 'bill',
      status: 'open',
    });
    for (const c of open) {
      c.status = 'resolved';
      c.resolvedAt = new Date();
      c.resolvedBy = req.user._id;
      await c.save();
      emitCall(io(req), c, 'call:update');
    }
    emitOrder(io(req), order);
    res.json(order);
  })
);

/* ------------------------------ service calls --------------------------- */

router.get(
  '/calls',
  asyncHandler(async (req, res) => {
    res.json(await ServiceCall.find({ restaurant: rid(req), status: 'open' }).sort({ createdAt: 1 }));
  })
);

router.get(
  '/calls/history',
  allow('owner', 'waiter', 'receptionist'),
  asyncHandler(async (req, res) => {
    const history = await ServiceCall.find({ restaurant: rid(req) })
      .populate('resolvedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(history);
  })
);

router.patch(
  '/calls/:id/resolve',
  allow('owner', 'waiter', 'receptionist'),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, 'Request not found');
    const call = await ServiceCall.findOne({ _id: req.params.id, restaurant: rid(req) });
    if (!call) throw httpError(404, 'Request not found');
    call.status = 'resolved';
    call.resolvedAt = new Date();
    call.resolvedBy = req.user._id;
    await call.save();

    emitCall(io(req), call, 'call:update');
    const r = await Restaurant.findById(rid(req)).select('slug');
    io(req)?.to(tableRoom(r.slug, call.tableNumber)).emit('call:update', call.toObject());
    res.json(call);
  })
);

/* -------------------------------- stats --------------------------------- */

router.get(
  '/stats',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const restaurant = rid(req);

    const [today, active, openCalls, menuCount, staffCount, topItems] = await Promise.all([
      Order.aggregate([
        { $match: { restaurant, createdAt: { $gte: start }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$total', 0] } },
            pending: { $sum: { $cond: [{ $ne: ['$payment.status', 'paid'] }, '$total', 0] } },
          },
        },
      ]),
      Order.countDocuments({ restaurant, status: { $in: ['placed', 'preparing', 'ready'] } }),
      ServiceCall.countDocuments({ restaurant, status: 'open' }),
      MenuItem.countDocuments({ restaurant }),
      User.countDocuments({ restaurant, role: { $in: ['chef', 'waiter', 'receptionist'] } }),
      Order.aggregate([
        { $match: { restaurant, createdAt: { $gte: new Date(Date.now() - 7 * 864e5) }, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.name', qty: { $sum: '$items.qty' } } },
        { $sort: { qty: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const t = today[0] || { orders: 0, revenue: 0, pending: 0 };
    res.json({
      ordersToday: t.orders,
      revenueToday: t.revenue,
      pendingToday: t.pending,
      activeOrders: active,
      openCalls,
      menuCount,
      staffCount,
      topItems: topItems.map((i) => ({ name: i._id, qty: i.qty })),
    });
  })
);

/* ----------------------------- worker history ----------------------------- */
// Full activity log per worker: orders they served, calls they resolved
router.get(
  '/staff/history',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const restaurant = rid(req);
    const [staff, servedOrders, resolvedCalls, waitingServed] = await Promise.all([
      User.find({ restaurant, role: { $in: ['chef', 'waiter', 'receptionist'] } }).select('name role email phone active createdAt'),
      Order.find({ restaurant, status: 'served' }).sort({ servedAt: -1 }).limit(500).select('tableNumber billNo customerName total servedAt status payment'),
      ServiceCall.find({ restaurant, status: 'resolved' }).populate('resolvedBy', 'name role').sort({ resolvedAt: -1 }).limit(500),
      WaitingEntry.find({ restaurant }).populate('servedBy', 'name role').sort({ createdAt: -1 }).limit(200),
    ]);
    res.json({ staff: staff.map(s => s.toSafe ? s.toSafe() : s), servedOrders, resolvedCalls, waitingServed });
  })
);

/* ----------------------------- customer visits ----------------------------- */
router.get(
  '/customers',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const restaurant = rid(req);
    const visits = await Order.aggregate([
      { $match: { restaurant, customerName: { $ne: '' } } },
      { $group: {
        _id: { $toLower: '$customerName' },
        name: { $last: '$customerName' },
        visits: { $sum: 1 },
        totalSpent: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$total', 0] } },
        lastVisit: { $max: '$createdAt' },
        tables: { $addToSet: '$tableNumber' },
      }},
      { $sort: { visits: -1 } },
      { $limit: 200 },
    ]);
    res.json(visits);
  })
);

/* ----------------------------- waiting list ----------------------------- */

// Get current waiting list
router.get(
  '/waiting',
  allow('owner', 'receptionist', 'waiter'),
  asyncHandler(async (req, res) => {
    const list = await WaitingEntry.find({ restaurant: rid(req), status: 'waiting' })
      .populate('servedBy', 'name')
      .sort({ createdAt: 1 });
    res.json(list);
  })
);

// Get waiting list history (all statuses)
router.get(
  '/waiting/history',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const list = await WaitingEntry.find({ restaurant: rid(req), createdAt: { $gte: since } })
      .populate('servedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(300);
    res.json(list);
  })
);

// Add customer to waiting list (receptionist or walk-in QR)
router.post(
  '/waiting',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const { customerName, phone, partySize, notes, estimatedWaitMinutes } = req.body;
    if (!String(customerName || '').trim()) throw httpError(400, 'Customer name is required');

    // Auto-calculate estimated wait if not provided:
    // Find latest active order that is not served yet, get its etaAt, add 10 min buffer
    let waitMins = parseInt(estimatedWaitMinutes, 10) || 15;
    if (!estimatedWaitMinutes) {
      const latestActive = await Order.findOne({
        restaurant: rid(req),
        status: { $in: ['placed', 'preparing', 'ready'] },
      }).sort({ etaAt: -1 });
      if (latestActive?.etaAt) {
        const remaining = Math.max(0, Math.ceil((new Date(latestActive.etaAt) - Date.now()) / 60000));
        waitMins = remaining + 10;
      }
    }

    const etaSeatedAt = new Date(Date.now() + waitMins * 60000);
    const entry = await WaitingEntry.create({
      restaurant: rid(req),
      customerName: String(customerName).trim().slice(0, 80),
      phone: String(phone || '').trim().slice(0, 20),
      partySize: Math.max(1, parseInt(partySize, 10) || 1),
      notes: String(notes || '').slice(0, 200),
      estimatedWaitMinutes: waitMins,
      etaSeatedAt,
      servedBy: req.user._id,
      source: 'walk_in',
    });
    io(req)?.to(`rest:${rid(req)}`).emit('waiting:new', entry);
    res.status(201).json(entry);
  })
);

// Update waiting entry (seat / cancel / update time)
router.patch(
  '/waiting/:id',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, 'Waiting entry not found');
    const entry = await WaitingEntry.findOne({ _id: req.params.id, restaurant: rid(req) });
    if (!entry) throw httpError(404, 'Waiting entry not found');

    if (req.body.status === 'seated') {
      entry.status = 'seated';
      entry.seatedAt = new Date();
      entry.tableNumber = parseInt(req.body.tableNumber, 10) || entry.tableNumber;
      entry.servedBy = req.user._id;
    } else if (req.body.status === 'cancelled') {
      entry.status = 'cancelled';
      entry.cancelledAt = new Date();
      entry.servedBy = req.user._id;
    } else if (req.body.status === 'no_show') {
      entry.status = 'no_show';
      entry.servedBy = req.user._id;
    }
    if (req.body.estimatedWaitMinutes) {
      const mins = parseInt(req.body.estimatedWaitMinutes, 10);
      if (mins > 0 && mins <= 300) {
        entry.estimatedWaitMinutes = mins;
        entry.etaSeatedAt = new Date(Date.now() + mins * 60000);
      }
    }
    if (req.body.tableNumber) entry.tableNumber = parseInt(req.body.tableNumber, 10);
    if (req.body.notes !== undefined) entry.notes = String(req.body.notes).slice(0, 200);

    await entry.save();
    io(req)?.to(`rest:${rid(req)}`).emit('waiting:update', entry);
    res.json(entry);
  })
);

/* ---- Public: QR wall table request (customer side) ---- */
// This is handled via public route but kept here as a panel action to fetch requests
router.get(
  '/waiting/requests',
  allow('owner', 'receptionist'),
  asyncHandler(async (req, res) => {
    const requests = await WaitingEntry.find({
      restaurant: rid(req),
      source: 'qr',
      status: 'waiting',
    }).sort({ createdAt: 1 });
    res.json(requests);
  })
);

module.exports = router;
