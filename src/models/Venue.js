import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم المنشأة / النادي مطلوب'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    shortDescription: {
      type: String,
      default: '',
    },
    location: {
      address: { type: String, required: [true, 'عنوان المنشأة مطلوب'] },
      city: { type: String, default: 'القاهرة الجديدة' },
      area: { type: String, default: '' },
      mapUrl: { type: String, default: 'https://maps.google.com' },
      coordinates: {
        lat: { type: Number, default: 30.0444 },
        lng: { type: Number, default: 31.2357 },
      },
    },
    phone: {
      type: String,
      default: '',
    },
    amenities: {
      type: [String],
      default: [
        'غرف تبديل ملابس ومياه ساخنة',
        'كافيتريا ومشروبات طازجة',
        'مكان انتظار سيارات مؤمن',
        'إضاءة ليد ليلية احترافية',
        'واي فاي مجاني',
      ],
    },
    images: {
      type: [String],
      default: [],
    },
    logo: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 36,
    },
    activities: {
      type: [String],
      default: ['football', 'padel'],
    },
    featured: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Generate slug before save if not present
venueSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = encodeURIComponent(
      this.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0621-\u064A-]+/g, '')
    ) + '-' + Math.floor(1000 + Math.random() * 9000);
  }
  next();
});

export default mongoose.model('Venue', venueSchema);
