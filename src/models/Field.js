import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم الملعب مطلوب'],
      trim: true,
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
    location: {
      address: { type: String, required: true },
      city: { type: String, default: 'القاهرة' },
      mapUrl: { type: String, default: '' },
    },
    fieldType: {
      type: String,
      enum: ['5v5', '7v7', '11v11', 'paddle'],
      default: '5v5',
    },
    amenities: {
      type: [String],
      default: ['إضاءة كاشفة', 'نجيل صناعي تركي', 'غرف تبديل ملابس', 'كافيتريا', 'مكان انتظار سيارات'],
    },
    images: {
      type: [String],
      default: [],
    },
    operatingHours: {
      open: { type: String, default: '14:00' }, // 2:00 PM
      close: { type: String, default: '02:00' }, // 2:00 AM next day
    },
    slotDurationMinutes: {
      type: Number,
      default: 60, // 60 minutes
    },
    defaultHourlyPrice: {
      type: Number,
      default: 150,
    },
    defaultDayPrice: {
      type: Number,
      default: 150,
    },
    defaultNightPrice: {
      type: Number,
      default: 200,
    },

    phone: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Field', fieldSchema);
