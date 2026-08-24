import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    field: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Field',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Can be null if booked as guest by phone
    },
    dateString: {
      type: String, // Format: "YYYY-MM-DD" for accurate timezone-safe comparison
      required: [true, 'تاريخ الحجز مطلوب'],
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

// Compound Unique Index to prevent double bookings (active bookings only)
bookingSchema.index(
  { field: 1, dateString: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $nin: ['cancelled', 'auto_expired'] } },
  }
);

export default mongoose.model('Booking', bookingSchema);
