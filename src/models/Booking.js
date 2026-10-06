import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      index: true,
    },
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      index: true,
    },
    field: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      default: null,
      index: true,
    },
    activityType: {
      type: String,
      default: 'football',
      index: true,
    },
    bookingType: {
      type: String,
      enum: ['time_slot', 'session'],
      default: 'time_slot',
    },
    participantsCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Can be null if booked as guest by phone
    },
    dateString: {
      type: String, // Format: "YYYY-MM-DD" for accurate timezone-safe comparison
      required: [true, 'تاريخ الحجز مطلوب'],
      index: true,
    },
    startTime: {
      type: String, // "18:00"
      required: [true, 'وقت البدء مطلوب'],
    },
    endTime: {
      type: String, // "19:00"
      required: [true, 'وقت الانتهاء مطلوب'],
    },
    playerName: {
      type: String,
      required: [true, 'اسم الحاجز مطلوب'],
      trim: true,
    },
    playerPhone: {
      type: String,
      required: [true, 'رقم هاتف الحاجز مطلوب'],
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending_confirmation', 'confirmed', 'cancelled', 'auto_expired', 'completed'],
      default: 'confirmed',
      index: true,
    },
    batchId: {
      type: String,
      default: null,
      index: true,
    },
    confirmationToken: {
      type: String,
      default: null,
      index: true,
    },
    confirmationDeadline: {
      type: Date,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid_cash', 'paid_online'],
      default: 'pending',
    },
    bookingSource: {
      type: String,
      enum: ['online', 'dashboard_manual', 'phone'],
      default: 'online',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound index for time_slot bookings to ensure exclusivity
bookingSchema.index(
  { facility: 1, dateString: 1, startTime: 1 },
  {
    partialFilterExpression: {
      bookingType: 'time_slot',
      status: { $nin: ['cancelled', 'auto_expired'] },
    },
  }
);

export default mongoose.model('Booking', bookingSchema);
