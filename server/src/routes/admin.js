// Platform owner (you). Only the super admin can use these.
const router = require('express').Router();
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { protect, allow } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/helpers');

router.use(protect, allow('superadmin'));

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [restaurants, owners, staff, orders, revenue] = await Promise.all([
      Restaurant.countDocuments(),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: { $in: ['chef', 'waiter'] } }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { 'payment.status': 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);
    res.json({ restaurants, owners, staff, orders, revenue: revenue[0]?.total || 0 });
  })
);

router.get(
  '/restaurants',
  asyncHandler(async (req, res) => {
    const list = await Restaurant.find().sort({ createdAt: -1 }).populate('owner', 'name email active');
    const ids = list.map((r) => r._id);
    const [orderCounts, menuCounts, staffCounts] = await Promise.all([
      Order.aggregate([{ $match: { restaurant: { $in: ids } } }, { $group: { _id: '$restaurant', n: { $sum: 1 } } }]),
      MenuItem.aggregate([{ $match: { restaurant: { $in: ids } } }, { $group: { _id: '$restaurant', n: { $sum: 1 } } }]),
      User.aggregate([
        { $match: { restaurant: { $in: ids }, role: { $in: ['chef', 'waiter'] } } },
        { $group: { _id: '$restaurant', n: { $sum: 1 } } },
      ]),
    ]);
    const toMap = (arr) => new Map(arr.map((x) => [String(x._id), x.n]));
    const o = toMap(orderCounts);
    const m = toMap(menuCounts);
    const s = toMap(staffCounts);

    res.json(
      list.map((r) => ({
        id: r._id,
        name: r.name,
        slug: r.slug,
        tableCount: r.tableCount,
        isActive: r.isActive,
        createdAt: r.createdAt,
        owner: r.owner ? { name: r.owner.name, email: r.owner.email } : null,
        orders: o.get(String(r._id)) || 0,
        menuItems: m.get(String(r._id)) || 0,
        staff: s.get(String(r._id)) || 0,
      }))
    );
  })
);

router.patch(
  '/restaurants/:id/active',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Restaurant not found');
    const r = await Restaurant.findByIdAndUpdate(req.params.id, { isActive: !!req.body.isActive }, { new: true });
    if (!r) throw httpError(404, 'Restaurant not found');
    res.json({ id: r._id, isActive: r.isActive });
  })
);

module.exports = router;
