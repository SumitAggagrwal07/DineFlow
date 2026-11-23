const mongoose = require('mongoose');

const serviceCallSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    tableNumber: { type: Number, required: true },
    type: { type: String, enum: ['help', 'bill', 'water', 'napkin'], default: 'help' },
    quantity: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServiceCall', serviceCallSchema);
