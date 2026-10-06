import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import User from '../models/User.js';
import Venue from '../models/Venue.js';
import Facility from '../models/Facility.js';
import Field from '../models/Field.js';
import PricingRule from '../models/PricingRule.js';
import Booking from '../models/Booking.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

dotenv.config();

const seedData = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    console.log('📡 Connecting to MongoDB for multi-sport platform seeding...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('🌱 Connected to MongoDB successfully!');

    // Clean existing collections
    await Booking.deleteMany({});
    await PricingRule.deleteMany({});
    await Facility.deleteMany({});
    await Venue.deleteMany({});
    await Field.deleteMany({});
    await User.deleteMany({});

    console.log('🧹 Cleaned existing database collections');

    // 1. Create Users
    const superadmin = await User.create({
      name: 'المدير العام (Super Admin)',
      phone: '01024556910',
      password: '123456',
      role: 'superadmin',
    });

    const owner = await User.create({
      name: 'كابتن حسام الألفي (صاحب المنشأة)',
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

    console.log('👤 Users created successfully');

    // 2. Create Venues
    const venue1 = await Venue.create({
      name: 'نادي سنترينو الرياضي المتكامل — Santrino Sports Club',
      slug: 'santrino-sports-club',
      owner: owner._id,
      description: 'مجمع رياضي عالمي يضم أحدث ملاعب البادل والتنس وكرة القدم الخماسية والسباعية مع مسبح نصف أولمبي وصالة لياقة بدنية.',
      shortDescription: 'بادل • كرة قدم • تنس • سباحة • لياقة',
      location: {
        address: 'شارع التسعين الشمالي، بجوار مجمع البنوك، التجمع الخامس',
        city: 'القاهرة الجديدة',
        area: 'التجمع الخامس',
        mapUrl: 'https://maps.google.com/?q=New+Cairo+Egypt',
        coordinates: { lat: 30.0275, lng: 31.4722 },
      },
      phone: '01000000000',
      amenities: [
        'غرف تبديل ملابس فندقية ومياه ساخنة',
        'كافيتريا ومشروبات بروتين وعصائر طازجة',
        'موقف سيارات خاص مؤمن مجاني',
        'إضاءة ليد HD للمباريات الليلية',
        'واي فاي فائق السرعة',
        'خزائن أمانات إلكترونية',
        'مدرجات واستراحات مكيفة',
        'متجر معدات ومضارب',
      ],
      images: [
        'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80', // padel / sports
        'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80', // football
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80', // gym
        'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?auto=format&fit=crop&w=1200&q=80', // pool
      ],
      rating: 4.9,
      reviewCount: 68,
      activities: ['padel', 'football', 'tennis', 'swimming', 'fitness'],
      featured: true,
      isActive: true,
    });

    const venue2 = await Venue.create({
      name: 'ذا هَب بادل أند كورتس — The Hub Padel Arena',
      slug: 'the-hub-padel-arena',
      owner: owner._id,
      description: 'نادي البادل المتخصص الأكبر في غرب القاهرة، 4 ملاعب بانورامية ومطعم واستراحة راقية وبطولات أسبوعية.',
      shortDescription: 'بادل احترافي • ملاعب بانورامية • استراحة فاخرة',
      location: {
        address: 'وصلة دهشور، مدخل زايد 4، الشيخ زايد',
        city: 'الشيخ زايد',
        area: 'الشيخ زايد',
        mapUrl: 'https://maps.google.com/?q=Sheikh+Zayed+City',
        coordinates: { lat: 30.0561, lng: 30.9786 },
      },
      phone: '01022334455',
      amenities: [
        'أرضيات موندو إسبانية رسمية WPT',
        'كافيه ومطعم راقي',
        'إيجار وتجربة أحدث المضارب',
        'مدربين معتمدين دولياً',
        'مواقف سيارات واسعة',
      ],
      images: [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80',
      ],
      rating: 4.8,
      reviewCount: 42,
      activities: ['padel', 'table_tennis'],
      featured: true,
      isActive: true,
    });

    const venue3 = await Venue.create({
      name: 'أولمبيك أرينا — Olympic Arena المعادي',
      slug: 'olympic-arena-maadi',
      owner: owner._id,
      description: 'منشأة رياضية متكاملة تقدم ملاعب كرة سلة، طائرة، ريشة، ومسبح أولمبي معتمد لأكاديميات السباحة.',
      shortDescription: 'سباحة • كرة سلة • طائرة • ريشة طائرة',
      location: {
        address: 'دجلة، شارع 206، المعادي',
        city: 'المعادي',
        area: 'دجلة المعادي',
        mapUrl: 'https://maps.google.com/?q=Maadi+Cairo',
        coordinates: { lat: 29.9602, lng: 31.2569 },
      },
      phone: '01099887766',
      amenities: [
        'مسبح أولمبي مدفأ شتاءً',
        'صالة باركيه مغطاة للسلة والطائرة',
        'حكام ومسعفين متواجدين دائماً',
        'غرف ساونا وجاكوزي',
      ],
      images: [
        'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
      ],
      rating: 4.7,
      reviewCount: 31,
      activities: ['swimming', 'basketball', 'volleyball', 'badminton'],
      featured: true,
      isActive: true,
    });

    console.log('🏟️ Venues created');

    // 3. Create Facilities under Venue 1 (Santrino Sports Club)
    const fPadel1 = await Facility.create({
      venue: venue1._id,
      name: 'ملعب بادل 01 (بانورامي)',
      activityType: 'padel',
      subType: 'panoramic',
      description: 'ملعب بادل زجاجي بانورامي فائق الرؤية مع زجاج سيكوريت عالي السماكة وعشب موندو WPT.',
      images: [
        'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80',
      ],
      amenities: ['زجاج بانورامي', 'إضاءة HD', 'مضارب وكرات متاحة'],
      bookingType: 'time_slot',
      capacity: 1,
      slotDurationMinutes: 90,
      operatingHours: { open: '08:00', close: '02:00' },
      defaultHourlyPrice: 350,
      defaultDayPrice: 300,
      defaultNightPrice: 400,
      isActive: true,
    });

    const fPadel2 = await Facility.create({
      venue: venue1._id,
      name: 'ملعب بادل 02 (Indoor مغطى)',
      activityType: 'padel',
      subType: 'indoor',
      description: 'ملعب بادل مغطى ومكيف بالكامل للعب في أجواء مثالية صيفاً وشتاءً.',
      images: [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80',
      ],
      amenities: ['مغطى بالكامل', 'تكييف مركزي', 'عزل صوتي وضوئي'],
      bookingType: 'time_slot',
      capacity: 1,
      slotDurationMinutes: 90,
      operatingHours: { open: '09:00', close: '01:00' },
      defaultHourlyPrice: 380,
      defaultDayPrice: 340,
      defaultNightPrice: 420,
      isActive: true,
    });

    const fFootball1 = await Facility.create({
      venue: venue1._id,
      name: 'ملعب كرة قدم خماسي 01',
      activityType: 'football',
      subType: '5v5',
      description: 'نجيل صناعي تركي جيل خامس مع إضاءة ليد احترافية وشباك علوية وجانبية.',
      images: [
        'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=800&q=80',
      ],
      amenities: ['نجيل تركي ممتاز', 'كرات مجانية', 'أقماع وتدريب'],
      bookingType: 'time_slot',
      capacity: 1,
      slotDurationMinutes: 60,
      operatingHours: { open: '08:00', close: '02:00' },
      defaultHourlyPrice: 250,
      defaultDayPrice: 220,
      defaultNightPrice: 300,
      isActive: true,
    });

    const fTennis1 = await Facility.create({
      venue: venue1._id,
      name: 'ملعب تنس أرضي 01 (صلب)',
      activityType: 'tennis',
      subType: 'hard',
      description: 'ملعب تنس بمواصفات الاتحاد الدولي ITF أرضية أكريليك سريعة ومريحة للمفاصل.',
      images: [
        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80',
      ],
      amenities: ['أرضية أكريليك دولية', 'إضاءة مسائية', 'مدرجات جانبية'],
      bookingType: 'time_slot',
      capacity: 1,
      slotDurationMinutes: 60,
      operatingHours: { open: '07:00', close: '23:00' },
      defaultHourlyPrice: 200,
      defaultDayPrice: 180,
      defaultNightPrice: 240,
      isActive: true,
    });

    const fPool1 = await Facility.create({
      venue: venue1._id,
      name: 'مسبح سنترينو نصف أولمبي (جلسات حرة وتدريب)',
      activityType: 'swimming',
      subType: 'olympic',
      description: 'مسبح 25 متر مع 6 حارات سباحة، معقم بأحدث أنظمة الأوزون ومراقب بواسطة منقذين معتمدين.',
      images: [
        'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?auto=format&fit=crop&w=800&q=80',
      ],
      amenities: ['مياه مدفأة', 'منقذون معتمدون', 'شاورات مياه ساخنة', 'خزائن أمانات'],
      bookingType: 'session',
      capacity: 20, // 20 swimmers per session
      slotDurationMinutes: 60,
      operatingHours: { open: '08:00', close: '22:00' },
      defaultHourlyPrice: 120, // 120 EGP per person per session
      defaultDayPrice: 100,
      defaultNightPrice: 130,
      isActive: true,
    });

    // Facilities under Venue 3
    const fBasketball = await Facility.create({
      venue: venue3._id,
      name: 'صالة كرة السلة المغطاة',
      activityType: 'basketball',
      subType: 'indoor',
      description: 'صالة باركيه كندي احترافية مع أطواق هيدروليكية ولوحة نتائج رقمية.',
      images: [
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80',
      ],
      amenities: ['أرضية باركيه خشب', 'لوحة رقمية', 'كرات سبالدينغ'],
      bookingType: 'time_slot',
      capacity: 1,
      slotDurationMinutes: 60,
      operatingHours: { open: '09:00', close: '23:00' },
      defaultHourlyPrice: 220,
      defaultDayPrice: 200,
      defaultNightPrice: 260,
      isActive: true,
    });

    console.log('🎾 Facilities created across venues');

    // 4. Create synced legacy Field for backward compatibility
    const legacyField = await Field.create({
      name: fFootball1.name,
      owner: owner._id,
      description: fFootball1.description,
      location: venue1.location,
      fieldType: '5v5',
      amenities: fFootball1.amenities,
      images: fFootball1.images,
      operatingHours: fFootball1.operatingHours,
      slotDurationMinutes: 60,
      defaultHourlyPrice: 250,
      defaultDayPrice: 220,
      defaultNightPrice: 300,
      phone: venue1.phone,
      isActive: true,
    });

    console.log('🏟️ Legacy Field synced');

    // 5. Create Pricing Rules
    await PricingRule.insertMany([
      {
        facility: fPadel1._id,
        field: legacyField._id,
        name: 'ساعات الذروة المسائية (بادل)',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: '18:00',
        endTime: '01:00',
        price: 400,
        priority: 2,
        isActive: true,
      },
      {
        facility: fFootball1._id,
        field: legacyField._id,
        name: 'سهرات نهاية الأسبوع (كرة قدم)',
        daysOfWeek: [4, 5], // Thursday & Friday
        startTime: '19:00',
        endTime: '02:00',
        price: 320,
        priority: 3,
        isActive: true,
      },
    ]);

    // 6. Sample Bookings for today
    const todayStr = new Date().toISOString().split('T')[0];
    await Booking.create([
      {
        venue: venue1._id,
        facility: fPadel1._id,
        field: legacyField._id,
        activityType: 'padel',
        bookingType: 'time_slot',
        dateString: todayStr,
        startTime: '19:30',
        endTime: '21:00',
        playerName: 'محمد الشناوي',
        playerPhone: '01099887711',
        price: 400,
        status: 'confirmed',
        paymentStatus: 'paid_cash',
        bookingSource: 'online',
        notes: 'مباراة ودية بادل',
      },
      {
        venue: venue1._id,
        facility: fPool1._id,
        activityType: 'swimming',
        bookingType: 'session',
        participantsCount: 3,
        dateString: todayStr,
        startTime: '18:00',
        endTime: '19:00',
        playerName: 'أحمد علي',
        playerPhone: '01122334455',
        price: 360,
        status: 'confirmed',
        paymentStatus: 'paid_cash',
        bookingSource: 'online',
        notes: 'حصة سباحة 3 أفراد',
      },
    ]);

    console.log('✨ Seed data created successfully!');
    console.log('==============================================');
    console.log('Superadmin: 01024556910 / 123456');
    console.log('Owner:      01000000000 / password123');
    console.log('Player:     01111111111 / password123');
    console.log('==============================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
