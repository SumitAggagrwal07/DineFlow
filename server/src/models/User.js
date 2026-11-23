const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['superadmin', 'owner', 'chef', 'waiter', 'receptionist'], required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matches = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafe = function () {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone || '',
    email: this.email,
    role: this.role,
    restaurant: this.restaurant,
    active: this.active,
  };
};

module.exports = mongoose.model('User', userSchema);
