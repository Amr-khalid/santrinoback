import mongoose from 'mongoose';

const facilitySchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'اسم المنشأة أو الملعب مطلوب'],
      trim: true,
    },
    activityType: {
      type: String,
      required: [true, 'نوع النشاط الرياضي مطلوب'],
      enum: [
        'football',
        'padel',
        'tennis',
        'swimming',
        'basketball',
        'volleyball',
        'badminton',
        'table_tennis',
        'fitness',
        'yoga',
        'martial_arts',
        'other',
      ],
      default: 'football',
      index: true,
    },
    subType: {
      type: String,
      default: '', // e.g. "5v5", "panoramic", "clay", "olympic"
    },
    description: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    amenities: {
      type: [String],
      default: [],
    },
    bookingType: {
      type: String,
      enum: ['time_slot', 'session'],
      default: 'time_slot', // 'time_slot' = exclusive court / hourly; 'session' = capacity-based per person
    },
    capacity: {
      type: Number,
      default: 1, // 1 for exclusive court; >1 for session (e.g. 20 for swimming)
      min: 1,
    },
    slotDurationMinutes: {
      type: Number,
      default: 60,
    },
    operatingHours: {
      open: { type: String, default: '08:00' },
      close: { type: String, default: '02:00' },
    },
    defaultHourlyPrice: {
      type: Number,
      default: 200,
    },
    defaultDayPrice: {
      type: Number,
      default: 180,
    },
    defaultNightPrice: {
      type: Number,
      default: 250,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Facility', facilitySchema);
