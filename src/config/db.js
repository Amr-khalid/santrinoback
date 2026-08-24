import mongoose from 'mongoose';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

let mongoMemoryServer = null;
let cachedConn = null;

export const connectDB = async () => {
  if (cachedConn && mongoose.connection.readyState >= 1) {
    return cachedConn;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/santrino_db';

  try {
    // Attempt connecting to the configured URI
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected to Local/Atlas: ${conn.connection.host}`);
    cachedConn = conn;
    await autoSeedIfEmpty();
    return conn;
  } catch (error) {
    console.warn(`⚠️ Could not connect to MongoDB at ${uri} (${error.message})`);
    console.log('🔄 Initializing in-memory Mongo server for development...');

    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongoMemoryServer = await MongoMemoryServer.create();
      const memUri = mongoMemoryServer.getUri();

      const conn = await mongoose.connect(memUri);
      console.log(`✅ In-Memory MongoDB Connected: ${memUri}`);
      await autoSeedIfEmpty();
      return conn;
    } catch (memErr) {
      console.error(`❌ Failed to start in-memory MongoDB: ${memErr.message}`);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
};

/**
 * Auto-seed initial demo field, owner, and pricing rules if database is clean
 */
async function autoSeedIfEmpty() {
  try {
    const User = (await import('../models/User.js')).default;
    const Field = (await import('../models/Field.js')).default;
    const PricingRule = (await import('../models/PricingRule.js')).default;
    const Booking = (await import('../models/Booking.js')).default;

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Database is empty. Seeding initial demo data...');

      const superadmin = await User.create({
        name: 'المدير العام (Super Admin)',
        phone: '01024556910',
        password: 'password123' && '123456',
        role: 'superadmin',
      });


      const owner = await User.create({
        name: 'كابتن حسام (صاحب الملعب)',
        phone: '01000000000',
        password: 'password123',
        role: 'owner',
      });

      const player = await User.create({
        name: 'أحمد طارق',
        phone: '01111111111',
        password: 'password123',
        role: 'player',
      });


      const field = await Field.create({
        name: 'ملعب سنترينو أرينا - التجمع الخامس',
        owner: owner._id,
        description: 'أفضل ملعب خماسي في التجمع الخامس مع نجيل تركي عالي الجودة وإضاءة ليد بطولية وغرف تبديل ممتازة.',
        location: {
          address: 'شارع التسعين الشمالي، بجوار مجمع البنوك، التجمع الخامس',
          city: 'القاهرة الجديدة',
          mapUrl: 'https://maps.google.com',
        },
        fieldType: '5v5',
        amenities: [
          'نجيل صناعي تركي جيل خامس',
          'إضاءة ليد ليلية احترافية HD',
          'غرف تبديل ملابس ومياه ساخنة',
          'كافيتريا ومشروبات طازجة',
          'شاشات لمشاهدة المباريات',
          'كرات وأقماع احترافية مجانية',
          'جراج سيارات خاص مؤمن',
        ],
        operatingHours: {
          open: '08:00',
          close: '08:00',
        },
        slotDurationMinutes: 60,
        defaultHourlyPrice: 300,
        phone: '01000000000',
        isActive: true,
      });

      await PricingRule.insertMany([
        {
          field: field._id,
          name: 'فترة الصباح',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: '05:00',
          endTime: '12:00',
          price: 200,
          priority: 1,
          isActive: true,
        },
        {
          field: field._id,
          name: 'فترة الظهيرة',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: '12:00',
          endTime: '15:00',
          price: 250,
          priority: 1,
          isActive: true,
        },
        {
          field: field._id,
          name: 'فترة العصر',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: '15:00',
          endTime: '18:00',
          price: 300,
          priority: 1,
          isActive: true,
        },
        {
          field: field._id,
          name: 'ساعات الذروة والمساء',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: '18:00',
          endTime: '23:00',
          price: 400,
          priority: 2,
          isActive: true,
        },
        {
          field: field._id,
          name: 'سهرة الويك إند',
          daysOfWeek: [5, 6],
          startTime: '21:00',
          endTime: '02:00',
          price: 450,
          priority: 3,
          isActive: true,
        },
        {
          field: field._id,
          name: 'ساعات بعد منتصف الليل',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: '00:00',
          endTime: '05:00',
          price: 250,
          priority: 1,
          isActive: true,
        },
      ]);

      const todayStr = new Date().toISOString().split('T')[0];
      await Booking.create({
        field: field._id,
        user: player._id,
        dateString: todayStr,
        startTime: '18:00',
        endTime: '19:00',
        playerName: 'أحمد طارق',
        playerPhone: '01111111111',
        price: 400,
        status: 'confirmed',
        paymentStatus: 'paid_cash',
        bookingSource: 'online',
        notes: 'ماتش شباب الجامعة',
      });

      console.log('✅ Demo data seeded successfully (Owner: 01000000000 / password123)');
    }
  } catch (seedErr) {
    console.error('Error during autoSeed:', seedErr.message);
  }
}
