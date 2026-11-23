const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { signToken, protect } = require('../middleware/auth');
const { asyncHandler, httpError, slugify, token } = require('../utils/helpers');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, try again in a few minutes' },
});

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  while (await Restaurant.exists({ slug })) slug = `${base}-${token(2)}`;
  return slug;
}

async function generateStaffCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let exists = true;
  while (exists) {
    code = 'DF-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    exists = await Restaurant.exists({ staffCode: code });
  }
  return code;
}

// Restaurant owner sign-up: creates the owner account + their restaurant.
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { ownerName, restaurantName, email, password, phone } = req.body;
    const tableCount = Math.min(200, Math.max(1, parseInt(req.body.tableCount, 10) || 10));

    if (!ownerName?.trim()) throw httpError(400, 'Your name is required');
    if (!restaurantName?.trim()) throw httpError(400, 'Restaurant name is required');
    if (!emailOk(String(email || ''))) throw httpError(400, 'Enter a valid email');
    if (String(password || '').length < 6) throw httpError(400, 'Password must be at least 6 characters');
    if (await User.exists({ email: String(email).toLowerCase() })) {
      throw httpError(409, 'An account with this email already exists');
    }

    const user = await User.create({
      name: ownerName.trim(),
      email,
      password,
      role: 'owner',
    });
    try {
      const restaurant = await Restaurant.create({
        name: restaurantName.trim(),
        slug: await uniqueSlug(restaurantName),
        staffCode: await generateStaffCode(),
        owner: user._id,
        tableCount,
        phone: phone || '',
      });
      user.restaurant = restaurant._id;
      await user.save();
      res.status(201).json({ token: signToken(user._id), user: user.toSafe(), restaurant });
    } catch (e) {
      await User.deleteOne({ _id: user._id });
      throw e;
    }
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const selectedRole = req.body.role ? String(req.body.role).trim().toLowerCase() : null;
    const staffCode = req.body.staffCode ? String(req.body.staffCode).trim().toUpperCase() : null;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matches(password))) throw httpError(401, 'Wrong email or password');
    if (!user.active) throw httpError(403, 'This account has been disabled');

    // Role check if passed
    if (selectedRole && user.role !== selectedRole) {
      throw httpError(403, `This account is registered as a ${user.role}, not ${selectedRole}. Please select the correct login role.`);
    }

    let restaurant = null;
    if (user.role !== 'superadmin') {
      restaurant = await Restaurant.findById(user.restaurant);
      if (!restaurant || !restaurant.isActive) throw httpError(403, 'This restaurant has been suspended');

      // If user is chef, waiter, or receptionist, verify restaurant staff code
      if (['chef', 'waiter', 'receptionist'].includes(user.role)) {
        if (!staffCode) {
          throw httpError(400, 'Restaurant Code is required for Chef, Waiter and Receptionist login.');
        }
        if (restaurant.staffCode && restaurant.staffCode.toUpperCase() !== staffCode) {
          throw httpError(403, 'Invalid Restaurant Code. You can only login to your assigned restaurant.');
        }
      }
    }
    res.json({ token: signToken(user._id), user: user.toSafe(), restaurant });
  })
);

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const restaurant = req.user.restaurant ? await Restaurant.findById(req.user.restaurant) : null;
    res.json({ user: req.user.toSafe(), restaurant });
  })
);

module.exports = router;
