const mongoose = require('mongoose');

const waitingSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    customerName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, default: '', trim: true, maxlength: 20 },
    partySize: { type: Number, default: 1, min: 1, max: 50 },
    // Estimated wait time in minutes (computed by receptionist / auto)
    estimatedWaitMinutes: { type: Number, default: 15 },
    // When we expect to seat them
    etaSeatedAt: { type: Date },
    status: {
      type: String,
      enum: ['waiting', 'seated', 'cancelled', 'no_show'],
      default: 'waiting',
      index: true,
    },
    tableNumber: { type: Number }, // assigned when seated
    seatedAt: { type: Date },
    cancelledAt: { type: Date },
    servedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // receptionist who managed
    notes: { type: String, default: '', maxlength: 200 },
    // Source: 'walk_in' (receptionist adds), 'qr' (customer scanned wall QR)
    source: { type: String, enum: ['walk_in', 'qr'], default: 'walk_in' },
  },
  { timestamps: true }
);

waitingSchema.index({ restaurant: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('WaitingEntry', waitingSchema);
