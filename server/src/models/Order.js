const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: String,
    price: Number,
    qty: { type: Number, min: 1 },
    portion: { type: String, enum: ['full', 'half'], default: 'full' },
    note: { type: String, default: '' },
    veg: { type: Boolean, default: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    tableNumber: { type: Number, required: true },
    items: [lineSchema],
    customerName: { type: String, default: '', maxlength: 60 },
    notes: { type: String, default: '', maxlength: 200 },

    subtotal: Number,
    tax: Number,
    total: Number,
    taxPercent: Number,
    billNo: String,

    status: {
      type: String,
      enum: ['placed', 'preparing', 'ready', 'served', 'cancelled'],
      default: 'placed',
      index: true,
    },
    prepMinutes: { type: Number, default: 15 }, // set by chef/owner
    startedAt: Date, // timer start (when chef accepts)
    etaAt: Date, // when the food should be ready
    readyAt: Date,
    servedAt: Date,

    payment: {
      status: { type: String, enum: ['unpaid', 'cash_requested', 'paid'], default: 'unpaid' },
      method: { type: String, enum: ['upi', 'card', 'cash', 'phonepe', 'googlepay', 'applepay'] },
      paidAt: Date,
      reference: String,
    },

    // secret the customer's phone uses to follow this order
    accessToken: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

orderSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
