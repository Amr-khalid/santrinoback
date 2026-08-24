import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import Field from '../models/Field.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

dotenv.config();

async function updateFields() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/santrino_db';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');

    const result = await Field.updateMany({}, {
      $set: {
        defaultDayPrice: 150,
        defaultNightPrice: 200,
        defaultHourlyPrice: 150,
      }
    });

    console.log('✅ Updated fields default prices (Day: 150, Night: 200):', result.modifiedCount);
    process.exit(0);
  } catch (err) {
    console.error('Error updating fields:', err.message);
    process.exit(1);
  }
}

updateFields();
