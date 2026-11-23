// Creates the super admin and a demo restaurant (with chef + waiter) if they do not exist yet.
// Run manually with:  npm run seed
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const MenuItem = require('./models/MenuItem');

const DEMO = {
  owner: { name: 'Sumit Aggarwal', email: 'owner@demo.com', password: 'Owner@123', phone: '+91 98765 11111' },
  chef: { name: 'Chef Anita Sharma', email: 'chef@demo.com', password: 'Chef@123', phone: '+91 98765 22222' },
  waiter: { name: 'Waiter Sam Patel', email: 'waiter@demo.com', password: 'Waiter@123', phone: '+91 98765 33333' },
  receptionist: { name: 'Receptionist Priya Verma', email: 'reception@demo.com', password: 'Reception@123', phone: '+91 98765 44444' },
};

const MENU = [
  ['Starters', 'Paneer Tikka', 'Charred cottage cheese, mint chutney', 260, true, 15, true],
  ['Starters', 'Crispy Corn', 'Tossed with pepper and spring onion', 190, true, 10, true],
  ['Starters', 'Chicken 65', 'Spicy fried chicken, curry leaf', 280, false, 15, true],
  ['Mains', 'Butter Chicken', 'Creamy tomato gravy, kasuri methi', 340, false, 20, true],
  ['Mains', 'Dal Makhani', 'Slow cooked black lentils', 240, true, 20, true],
  ['Mains', 'Paneer Butter Masala', 'Rich tomato-cashew gravy', 290, true, 18, true],
  ['Mains', 'Veg Biryani', 'Basmati, saffron, raita on the side', 260, true, 25, false],
  ['Mains', 'Chicken Biryani', 'Dum style, boiled egg', 320, false, 25, true],
  ['Breads', 'Butter Naan', 'Tandoor baked', 55, true, 8, true],
  ['Breads', 'Garlic Naan', 'Garlic and coriander', 70, true, 8, true],
  ['Desserts', 'Gulab Jamun', 'Two pieces, warm', 110, true, 5, true],
  ['Desserts', 'Brownie with Ice Cream', 'Warm walnut brownie', 180, true, 8, true],
  ['Drinks', 'Masala Chai', 'Fresh ginger and cardamom', 60, true, 5, true],
  ['Drinks', 'Fresh Lime Soda', 'Sweet, salted or mixed', 90, true, 4, true],
];

async function ensureUser(data, role, restaurant) {
  let u = await User.findOne({ email: data.email.toLowerCase() });
  if (!u) {
    u = await User.create({ ...data, role, restaurant });
    console.log(`  + created ${role}: ${data.email}`);
  }
  return u;
}

async function seed() {
  const admin = await ensureUser(
    { name: 'Platform Admin', email: config.adminEmail, password: config.adminPassword },
    'superadmin'
  );

  let owner = await User.findOne({ email: DEMO.owner.email });
  let restaurant = owner ? await Restaurant.findById(owner.restaurant) : null;

  if (!restaurant) {
    owner = owner || (await User.create({ ...DEMO.owner, role: 'owner' }));
    restaurant = await Restaurant.create({
      name: 'Spice Route Kitchen',
      slug: 'spice-route-kitchen',
      staffCode: 'DF-DEMO',
      owner: owner._id,
      tableCount: 8,
      taxPercent: 5,
      currency: '₹',
      phone: '+91 98765 43210',
      address: 'MG Road, Agra',
      defaultPrepMinutes: 15,
    });
    owner.restaurant = restaurant._id;
    await owner.save();
    console.log('  + created demo restaurant: Spice Route Kitchen');

    await MenuItem.insertMany(
      MENU.map(([category, name, description, price, veg, prepMinutes, available], i) => ({
        restaurant: restaurant._id,
        category,
        name,
        description,
        price,
        veg,
        prepMinutes,
        available,
        sortOrder: i,
      }))
    );
  }

  await ensureUser(DEMO.chef, 'chef', restaurant._id);
  await ensureUser(DEMO.waiter, 'waiter', restaurant._id);
  await ensureUser(DEMO.receptionist, 'receptionist', restaurant._id);
  return { admin, owner, restaurant };
}

module.exports = { seed, DEMO };

if (require.main === module) {
  mongoose
    .connect(config.mongoUri)
    .then(() => seed())
    .then(() => {
      console.log('Seed complete.');
      return mongoose.disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
