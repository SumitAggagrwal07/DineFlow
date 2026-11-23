const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffCode: { type: String, unique: true, sparse: true, uppercase: true, index: true },
    logo: { type: String, default: '' }, // data URL or https URL
    accent: { type: String, default: '#e76f51' },
    tableCount: { type: Number, default: 10, min: 1, max: 200 },
    taxPercent: { type: Number, default: 5, min: 0, max: 40 },
    currency: { type: String, default: '₹', maxlength: 4 },
    phone: { type: String, default: '', maxlength: 30 },
    address: { type: String, default: '', maxlength: 200 },
    paymentQr: { type: String, default: '' }, // business payment QR (UPI / GPay / PhonePe / Paytm data URL or URL)
    defaultPrepMinutes: { type: Number, default: 15, min: 1, max: 180 },
    isOpen: { type: Boolean, default: true }, // accepting orders
    isActive: { type: Boolean, default: true }, // platform switch (super admin)
  },
  { timestamps: true }
);

module.exports = mongoose.model('Restaurant', restaurantSchema);
