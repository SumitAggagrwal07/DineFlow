const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 300 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: 'Mains', trim: true, maxlength: 40 },
    veg: { type: Boolean, default: true },
    image: { type: String, default: '' },
    available: { type: Boolean, default: true },
    prepMinutes: { type: Number, default: 15, min: 0, max: 180 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
