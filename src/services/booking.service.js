import crypto from 'crypto';
import Field from '../models/Field.js';
import Booking from '../models/Booking.js';
import { generateTimeSlots } from '../utils/timeSlots.js';
import { calculateSlotPrice } from './pricing.service.js';

/**
 * Auto-expire bookings whose confirmation deadline has passed
 */
export async function expireStaleBookings() {
  const now = new Date();
  await Booking.updateMany(
    {
      status: 'pending_confirmation',
      confirmationDeadline: { $lte: now },
    },
    {
      $set: { status: 'auto_expired' },
    }
  );
}

/**
 * Calculate confirmation status and deadline based on match timing and booking source
 */
export function getConfirmationPolicyDetails(dateString, startTime, bookingSource = 'online') {
  if (bookingSource === 'dashboard_manual') {
    return {
      status: 'confirmed',
      confirmationToken: null,
      confirmationDeadline: null,
      confirmedAt: new Date(),
    };
  }

  const now = new Date();
  const matchDateTime = new Date(`${dateString}T${startTime}:00`);
  const hoursUntilMatch = (matchDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // If match is within 6 hours or in past, confirm directly
  if (hoursUntilMatch <= 6) {
    return {
      status: 'confirmed',
      confirmationToken: null,
      confirmationDeadline: null,
      confirmedAt: new Date(),
    };
  }

  const token = crypto.randomBytes(12).toString('hex');

  // If match is more than 48 hours away, deadline is 48h before match
  if (hoursUntilMatch > 48) {
    const deadline = new Date(matchDateTime.getTime() - 48 * 60 * 60 * 1000);
    return {
      status: 'pending_confirmation',
      confirmationToken: token,
      confirmationDeadline: deadline,
      confirmedAt: null,
    };
  }

  // If match is between 6h and 48h away, deadline is 3 hours from now (or 1h before match, whichever is earlier)
  const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const oneHourBeforeMatch = new Date(matchDateTime.getTime() - 1 * 60 * 60 * 1000);
  const deadline = threeHoursFromNow < oneHourBeforeMatch ? threeHoursFromNow : oneHourBeforeMatch;

  return {
    status: 'pending_confirmation',
    confirmationToken: token,
    confirmationDeadline: deadline,
    confirmedAt: null,
  };
}

/**
 * Get all slots for a given date with availability and dynamic pricing
 */
export async function getSlotsWithAvailability(fieldId, dateString) {
  // Always clean up expired bookings before fetching slots
  await expireStaleBookings();

  const field = await Field.findById(fieldId);
  if (!field) {
    throw new Error('الملعب غير موجود');
  }

  // Generate slots
  const allSlots = generateTimeSlots(
    field.operatingHours.open,
    field.operatingHours.close,
    field.slotDurationMinutes || 60
  );

  // Fetch all active bookings for this field on this date (not cancelled or auto_expired)
  const bookings = await Booking.find({
    field: fieldId,
    dateString,
    status: { $nin: ['cancelled', 'auto_expired'] },
  }).select('startTime endTime status playerName playerPhone confirmationDeadline');

  const bookedSlotsMap = new Map();
  bookings.forEach((b) => {
    bookedSlotsMap.set(b.startTime, b);
  });

  // Attach pricing & availability
  const enrichedSlots = await Promise.all(
    allSlots.map(async (slot) => {
      const isBooked = bookedSlotsMap.has(slot.startTime);
      const bookingData = bookedSlotsMap.get(slot.startTime);
      const pricing = await calculateSlotPrice(fieldId, dateString, slot.startTime);

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        displayTime: slot.displayTime,
        price: pricing.price,
        appliedRule: pricing.appliedRule,
        isAvailable: !isBooked,
        bookingInfo: isBooked
          ? {
              id: bookingData._id,
              status: bookingData.status,
              playerName: bookingData.playerName,
              playerPhone: bookingData.playerPhone,
              confirmationDeadline: bookingData.confirmationDeadline,
            }
          : null,
      };
    })
  );

  return {
    field: {
      id: field._id,
      name: field.name,
      fieldType: field.fieldType,
      defaultHourlyPrice: field.defaultHourlyPrice,
      operatingHours: field.operatingHours,
      location: field.location,
    },
    dateString,
    slots: enrichedSlots,
  };
}

/**
 * Create a new booking with conflict check, confirmation policy, and rate limiting
 */
export async function createBooking({
  fieldId,
  dateString,
  startTime,
  endTime,
  playerName,
  playerPhone,
  userId = null,
  bookingSource = 'online',
  notes = '',
}) {
  await expireStaleBookings();

  // Rate Limiting: Max 3 pending confirmation bookings per phone number
  if (bookingSource === 'online') {
    const pendingCount = await Booking.countDocuments({
      playerPhone,
      status: 'pending_confirmation',
    });
    if (pendingCount >= 3) {
      const error = new Error('لديك 3 حجوزات معلقة بانتظار التأكيد، يرجى تأكيدها أو إلغاؤها قبل إضافة حجوزات جديدة');
      error.statusCode = 400;
      throw error;
    }
  }

  // Check if slot is already booked
  const existingBooking = await Booking.findOne({
    field: fieldId,
    dateString,
    startTime,
    status: { $nin: ['cancelled', 'auto_expired'] },
  });

  if (existingBooking) {
    const error = new Error('هذا الموعد تم حجزه بالفعل، يرجى اختيار موعد آخر');
    error.statusCode = 409;
    throw error;
  }

  // Calculate dynamic price & confirmation policy
  const { price, appliedRule } = await calculateSlotPrice(fieldId, dateString, startTime);
  const policy = getConfirmationPolicyDetails(dateString, startTime, bookingSource);
  const batchId = 'batch_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  const newBooking = await Booking.create({
    field: fieldId,
    user: userId,
    dateString,
    startTime,
    endTime,
    playerName,
    playerPhone,
    price,
    bookingSource,
    notes,
    batchId,
    status: policy.status,
    confirmationToken: policy.confirmationToken,
    confirmationDeadline: policy.confirmationDeadline,
    confirmedAt: policy.confirmedAt,
    paymentStatus: 'pending',
  });

  return {
    booking: newBooking,
    appliedRule,
  };
}

/**
 * Create multiple bookings for selected hours with atomic conflict check and rate limiting
 */
export async function createMultipleBookings({
  fieldId,
  dateString,
  slots,
  playerName,
  playerPhone,
  userId = null,
  bookingSource = 'online',
  notes = '',
}) {
  await expireStaleBookings();

  if (bookingSource === 'online') {
    const pendingCount = await Booking.countDocuments({
      playerPhone,
      status: 'pending_confirmation',
    });
    if (pendingCount >= 3) {
      const error = new Error('لديك 3 حجوزات معلقة بانتظار التأكيد، يرجى تأكيدها أولاً قبل إكمال الحجز');
      error.statusCode = 400;
      throw error;
    }
  }

  const startTimes = slots.map((s) => (typeof s === 'string' ? s : s.startTime));

  // Check if any requested slot is already booked
  const existingBookings = await Booking.find({
    field: fieldId,
    dateString,
    startTime: { $in: startTimes },
    status: { $nin: ['cancelled', 'auto_expired'] },
  });

  if (existingBookings.length > 0) {
    const bookedTimes = existingBookings.map((b) => b.startTime).join(', ');
    const error = new Error(`بعض الساعات المختارة تم حجزها بالفعل (${bookedTimes})، يرجى اختيار مواعيد أخرى`);
    error.statusCode = 409;
    throw error;
  }

  const createdBookings = [];
  let totalPrice = 0;
  // Shared token and batchId for multi-slot booking session
  const sharedToken = bookingSource === 'dashboard_manual' ? null : crypto.randomBytes(12).toString('hex');
  const batchId = 'batch_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  for (const slot of slots) {
    const startTime = typeof slot === 'string' ? slot : slot.startTime;
    const endTime = typeof slot === 'object' && slot.endTime ? slot.endTime : null;
    const { price } = await calculateSlotPrice(fieldId, dateString, startTime);
    totalPrice += price;

    const policy = getConfirmationPolicyDetails(dateString, startTime, bookingSource);
    if (sharedToken) policy.confirmationToken = sharedToken;

    const newBooking = await Booking.create({
      field: fieldId,
      user: userId,
      dateString,
      startTime,
      endTime: endTime || slot.endTime,
      playerName,
      playerPhone,
      price,
      bookingSource,
      notes,
      batchId,
      status: policy.status,
      confirmationToken: policy.confirmationToken,
      confirmationDeadline: policy.confirmationDeadline,
      confirmedAt: policy.confirmedAt,
      paymentStatus: 'pending',
    });

    createdBookings.push(newBooking);
  }

  createdBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
  const mainBooking = createdBookings[0];

  return {
    bookings: createdBookings,
    booking: {
      _id: createdBookings.map((b) => b._id.toString().slice(-4)).join('-'),
      playerName,
      playerPhone,
      dateString,
      startTime: createdBookings[0].startTime,
      endTime: createdBookings[createdBookings.length - 1].endTime,
      price: totalPrice,
      status: mainBooking.status,
      confirmationToken: mainBooking.confirmationToken,
      confirmationDeadline: mainBooking.confirmationDeadline,
      totalSlots: createdBookings.length,
      slotsList: createdBookings.map((b) => `${b.startTime} - ${b.endTime}`),
    },
    totalPrice,
    count: createdBookings.length,
  };
}

/**
 * Confirm booking using token
 */
export async function confirmBookingByToken(token) {
  await expireStaleBookings();

  const bookings = await Booking.find({ confirmationToken: token });
  if (!bookings || bookings.length === 0) {
    const error = new Error('رابط التأكيد غير صحيح أو غير موجود');
    error.statusCode = 404;
    throw error;
  }

  const firstBooking = bookings[0];

  if (firstBooking.status === 'confirmed') {
    return {
      message: 'هذا الحجز مؤكد بالفعل سابقاً',
      bookings,
    };
  }

  if (firstBooking.status === 'auto_expired' || firstBooking.status === 'cancelled') {
    const error = new Error('عذراً، انتهت مهلة تأكيد هذا الحجز أو تم إلغاؤه');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  await Booking.updateMany(
    { confirmationToken: token },
    {
      $set: {
        status: 'confirmed',
        confirmedAt: now,
      },
    }
  );

  const updatedBookings = await Booking.find({ confirmationToken: token }).populate('field');
  return {
    message: 'تم تأكيد وتثبيت الحجز بنجاح',
    bookings: updatedBookings,
  };
}
