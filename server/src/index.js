const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const config = require('./config');
const User = require('./models/User');
const { staffRoom, orderRoom, menuRoom, tableRoom } = require('./utils/realtime');

const app = express();
const server = http.createServer(app);

const corsOrigin = config.isProd ? config.clientOrigins : true;
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (!config.isProd) app.use(morgan('dev'));

/* ------------------------------ realtime ------------------------------- */
const io = new Server(server, { cors: { origin: corsOrigin } });
app.set('io', io);

io.use(async (socket, next) => {
  const raw = socket.handshake.auth?.token;
  if (raw) {
    try {
      const { id } = jwt.verify(raw, config.jwtSecret);
      const user = await User.findById(id);
      if (user && user.active && user.restaurant) {
        socket.user = user;
        socket.join(staffRoom(user.restaurant));
      }
    } catch {
      /* treat as an anonymous customer socket */
    }
  }
  next();
});

io.on('connection', (socket) => {
  const clean = (v) => typeof v === 'string' && v.length > 0 && v.length <= 80;
  socket.on('join:order', (t) => clean(t) && socket.join(orderRoom(t)));
  socket.on('join:menu', (slug) => clean(slug) && socket.join(menuRoom(slug)));
  socket.on('join:table', ({ slug, table } = {}) => {
    if (clean(slug) && Number.isInteger(table)) socket.join(tableRoom(slug, table));
  });
});

/* -------------------------------- routes ------------------------------- */
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/panel', require('./routes/panel'));
app.use('/api/public', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));

// In production the Express server also serves the built React app.
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|socket\.io).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid value';
  } else if (err.code === 11000) {
    status = 409;
    message = 'That value is already in use';
  }
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 && config.isProd ? 'Server error' : message });
});

/* -------------------------------- start -------------------------------- */
async function start() {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ MongoDB connected successfully to: ${config.mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
  } catch (e) {
    console.error(`\n❌ Could not connect to MongoDB at ${config.mongoUri}\n${e.message}\n`);
    console.error('Please verify your MONGO_URI in server/.env (e.g. MongoDB Atlas cluster string or running local mongod).');
    process.exit(1);
  }

  if (config.seedOnStart) {
    const { seed } = require('./seed');
    await seed();
  }

  server.listen(config.port, () => console.log(`🚀 DineFlow API running on http://localhost:${config.port}`));
}

if (require.main === module) start();

module.exports = { app, server };
