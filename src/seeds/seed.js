import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import User from '../models/User.js';
import Field from '../models/Field.js';
import PricingRule from '../models/PricingRule.js';
import Booking from '../models/Booking.js';

// Prefer IPv4 resolution for Node on Windows/Atlas connections
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

dotenv.config();

const seedData = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/santrino_db';
    const maskedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`📡 Connecting to MongoDB (${maskedUri})...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('🌱 Connected to MongoDB for seeding...');


    // Clear existing collections
    await Booking.deleteMany({});
    await PricingRule.deleteMany({});
    await Field.deleteMany({});
    await User.deleteMany({});

    console.log('🧹 Cleaned existing database collections');

    // 1. Create SuperAdmin, Owner & Player users
    const superadmin = await User.create({
      name: 'المدير العام (Super Admin)',
      phone: '01024556910',
      password: '123456',
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

    console.log('👤 Users created:');
    console.log('   - SuperAdmin: 01024556910 / 123456');
    console.log('   - Owner: 01000000000 / password123');
    console.log('   - Player: 01111111111 / password123');


    // 2. Create Field
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
      images: [
        'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=1200&q=80',
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

    console.log(`🏟️ Field created: ${field.name}`);

    // 3. Create Pricing Rules Covering All Day & Night Periods
    const rules = await PricingRule.insertMany([
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
        daysOfWeek: [5, 6], // Friday & Saturday
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

    console.log(`⚡ Created ${rules.length} Dynamic Pricing Rules`);

    // 4. Create Sample Bookings for today and past days
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sampleBookings = [
      {
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
      },
      {
        field: field._id,
        dateString: todayStr,
        startTime: '21:00',
        endTime: '22:00',
        playerName: 'محمد الشناوي',
        playerPhone: '01222222222',
        price: 400,
        status: 'confirmed',
        paymentStatus: 'pending',
        bookingSource: 'online',
        notes: 'عايزين كورة إضافية',
      },
      {
        field: field._id,
        dateString: yesterdayStr,
        startTime: '19:00',
        endTime: '20:00',
        playerName: 'محمود عزت',
        playerPhone: '01055555555',
        price: 400,
        status: 'completed',
        paymentStatus: 'paid_cash',
        bookingSource: 'dashboard_manual',
        notes: '',
      },
      {
        field: field._id,
        dateString: yesterdayStr,
        startTime: '20:00',
        endTime: '21:00',
        playerName: 'كريم عبدالعزيز',
        playerPhone: '01066666666',
        price: 400,
        status: 'completed',
        paymentStatus: 'paid_cash',
        bookingSource: 'online',
        notes: '',
      },
    ];

    await Booking.insertMany(sampleBookings);
    console.log(`📅 Created ${sampleBookings.length} Sample Bookings`);

    console.log('\n✨ Database seeding completed successfully! ✨\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
