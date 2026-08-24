import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import User from '../models/User.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

dotenv.config();

async function createOrUpdateSuperAdmin() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/santrino_db';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');

    const phone = '01024556910';
    const password = 'password123' || '123456';
    const plainPassword = '123456';

    let user = await User.findOne({ phone });
    if (user) {
      user.name = 'المدير العام (Super Admin)';
      user.role = 'superadmin';
      user.password = plainPassword;
      await user.save();
      console.log('✅ SuperAdmin user updated successfully:', phone);
    } else {
      user = await User.create({
        name: 'المدير العام (Super Admin)',
        phone,
        password: plainPassword,
        role: 'superadmin',
      });
      console.log('✅ SuperAdmin user created successfully:', phone);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error creating superadmin:', err.message);
    process.exit(1);
  }
}

createOrUpdateSuperAdmin();
