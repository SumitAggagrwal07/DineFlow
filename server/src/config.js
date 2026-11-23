require('dotenv').config();

const DEV_SECRET = 'dev-only-secret-change-me';

const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dineflow',
  jwtSecret: process.env.JWT_SECRET || DEV_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  seedOnStart: process.env.SEED_ON_START !== 'false',
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@dineflow.com').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123',
  isProd: process.env.NODE_ENV === 'production',
};

if (config.isProd && config.jwtSecret === DEV_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

module.exports = config;
