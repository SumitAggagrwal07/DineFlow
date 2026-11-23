# DineFlow - restaurant automation platform

MERN stack: **MongoDB + Express + React + Node**, with Three.js (landing page), Socket.IO (live orders), JWT auth with roles.

## Run it

You need Node 18+ and MongoDB (local, or a free MongoDB Atlas URL).

```bash
cd dineflow
npm run install:all          # installs root, server and client
cp server/.env.example server/.env    # then edit MONGO_URI / JWT_SECRET if needed
npm run dev                  # API on :5000, website on :5173
```

Open http://localhost:5173

On first start the server creates the accounts below automatically (`SEED_ON_START=true`).

## Login credentials

| Role | Email | Password | Lands on |
|------|-------|----------|----------|
| Platform admin (you) | admin@dineflow.com | Admin@123 | All restaurants, usage stats, suspend/reactivate |
| Restaurant owner | owner@demo.com | Owner@123 | Overview, menu, tables and QR, staff, settings |
| Chef | chef@demo.com | Chef@123 | Kitchen board: accept orders, set timers, sold-out switches |
| Waiter | waiter@demo.com | Waiter@123 | Help/bill calls, serve, collect cash |

Change the admin password before going live: set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `server/.env` **before the first start**, or change it in the database. In development the login page also shows one-click demo buttons (hidden in production builds).

Any new restaurant owner registers at `/register`, then creates chef and waiter logins from **Staff**.

## How it works

1. **Owner registers** (name, restaurant, tables) and adds the menu, logo and tax.
2. **Tables & QR** page makes one QR per table (`/r/<slug>?table=N`) plus a **wall QR** (`/r/<slug>`, menu only, no ordering). Colours, dot shape and the restaurant logo in the centre are customisable. Download PNGs or print a sheet.
3. **Guest scans** a table QR, browses, orders. The bill (with tax) is generated instantly; prices always come from the database, not the browser.
4. **Chef** sees the order live, sets minutes, which starts the guest's countdown. +5 / -5 min adjusts it. Mark ready.
5. **Guest** taps **Call waiter** at any time; every waiter and the owner get an alert with the table number. Guests can also pay (UPI / card / cash request).
6. **Wall QR** guests see availability only, updated live when the chef marks a dish sold out.

## Project layout

```
server/src
  models/      User, Restaurant, MenuItem, Order, ServiceCall
  routes/      auth.js  panel.js (owner/chef/waiter)  public.js (customers)  admin.js
  middleware/  JWT + role checks
  index.js     Express + Socket.IO,  seed.js  demo data
client/src
  pages/       Landing (3D), Login, Register, dashboard/*, customer/CustomerPage
  components/  Hero3D (three.js), QRStyled, Countdown, ui
```

## Before real customers use it

- **Payments are a demo gateway.** UPI/card buttons mark the bill paid without moving money. Replace the block marked `DEMO GATEWAY` in `server/src/routes/public.js` with Razorpay (or Stripe): create the payment order there, and mark the bill paid only from a verified webhook.
- Set a strong `JWT_SECRET` (the server refuses to start in production without one) and `CLIENT_ORIGIN`.
- QR codes contain the address typed in **Tables & QR**. `localhost` only works on your computer; use your real domain (or your LAN address such as `http://192.168.1.20:5173` to test with a phone) before printing.
- Production: `npm run build`, then `NODE_ENV=production npm start`. Express serves the built site and API from one port.
- Logos are stored in MongoDB as small images (max about 300 KB). Move to object storage if you expect many restaurants.
