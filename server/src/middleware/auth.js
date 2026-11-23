const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const { asyncHandler, httpError } = require('../utils/helpers');

const signToken = (id) => jwt.sign({ id }, config.jwtSecret, { expiresIn: config.jwtExpires });

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!raw) throw httpError(401, 'Please sign in');

  let payload;
  try {
    payload = jwt.verify(raw, config.jwtSecret);
  } catch {
    throw httpError(401, 'Session expired, please sign in again');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.active) throw httpError(401, 'This account is not available');

  if (user.role !== 'superadmin') {
    const r = await Restaurant.findById(user.restaurant).select('isActive');
    if (!r || !r.isActive) throw httpError(403, 'This restaurant has been suspended');
  }

  req.user = user;
  next();
});

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(httpError(403, 'You do not have access to this'));

module.exports = { signToken, protect, allow };
