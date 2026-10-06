import mongoose from 'mongoose';

const pricingRuleSchema = new mongoose.Schema(
  {
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      default: null,
      index: true,
    },
    field: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      default: null,
      index: true,
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'اسم القاعدة مطلوب'], // e.g. "ساعات الذروة المسائية", "عطلة نهاية الأسبوع"
    },
    daysOfWeek: {
      type: [Number], // [0, 1, 2, 3, 4, 5, 6] 0 = Sunday, 5 = Friday, 6 = Saturday
      default: [0, 1, 2, 3, 4, 5, 6],
    },
    startTime: {
      type: String, // "18:00"
      required: true,
    },
    endTime: {
      type: String, // "23:00"
      required: true,
    },
    price: {
      type: Number,
      required: [true, 'السعر مطلوب'],
    },
    priority: {
      type: Number,
      default: 1, // Higher number wins if multiple rules match
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('PricingRule', pricingRuleSchema);
