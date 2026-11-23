const crypto = require('crypto');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'restaurant';

const token = (bytes = 12) => crypto.randomBytes(bytes).toString('hex');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

module.exports = { asyncHandler, httpError, slugify, token, round2 };
