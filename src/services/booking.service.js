import crypto from 'crypto';
import Facility from '../models/Facility.js';
import Field from '../models/Field.js';
import Venue from '../models/Venue.js';
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
 * Helper to fetch target facility or field with venue context
 */
async function resolveFacilityOrField(targetId) {
  let facility = await Facility.findById(targetId).populate('venue');
  if (facility) {
    return {
      isFacility: true,
      target: facility,
      venue: facility.venue,
      facilityId: facility._id,
      fieldId: null,
      name: facility.name,
      activityType: facility.activityType,
      bookingType: facility.bookingType || 'time_slot',
      capacity: facility.capacity || (facility.bookingType === 'session' ? 20 : 1),
      operatingHours: facility.operatingHours || { open: '08:00', close: '24:00' },
      slotDurationMinutes: facility.slotDurationMinutes || 60,
      location: facility.venue?.location,
    };
  }

  const field = await Field.findById(targetId);
  if (field) {
    return {
      isFacility: false,
      target: field,
      venue: null,
      facilityId: null,
      fieldId: field._id,
      name: field.name,
      activityType: 'football',
      bookingType: 'time_slot',
      capacity: 1,
      operatingHours: field.operatingHours || { open: '08:00', close: '24:00' },
      slotDurationMinutes: field.slotDurationMinutes || 60,
      location: field.location,
    };
  }

  return null;
}

/**
 * Get all slots for a given date with availability and dynamic pricing
 */
export async function getSlotsWithAvailability(targetId, dateString) {
  await expireStaleBookings();

  const resolved = await resolveFacilityOrField(targetId);
  if (!resolved) {
    throw new Error('المنشأة أو الملعب غير موجود');
  }

  const { target, venue, facilityId, fieldId, bookingType, capacity, operatingHours, slotDurationMinutes } = resolved;

  // Generate slots
  const allSlots = generateTimeSlots(
    operatingHours.open || '08:00',
    operatingHours.close || '24:00',
    slotDurationMinutes || 60
  );

  // Fetch active bookings for this facility/field on this date
  const query = {
    dateString,
    status: { $nin: ['cancelled', 'auto_expired'] },
  };
  if (facilityId) {
    query.$or = [{ facility: facilityId }, { field: targetId }];
  } else {
    query.field = fieldId;
  }

  const bookings = await Booking.find(query).select(
    'startTime endTime status playerName playerPhone confirmationDeadline participantsCount bookingType'
  );

  // Group bookings by slot startTime
  const bookingsBySlot = new Map();
  bookings.forEach((b) => {
    const list = bookingsBySlot.get(b.startTime) || [];
    list.push(b);
    bookingsBySlot.set(b.startTime, list);
  });

  // Attach pricing & availability
  const enrichedSlots = await Promise.all(
    allSlots.map(async (slot) => {
      const slotBookings = bookingsBySlot.get(slot.startTime) || [];
      const pricing = await calculateSlotPrice(targetId, dateString, slot.startTime);

      let isAvailable = true;
      let bookedCount = 0;
      let remainingSlots = capacity;

      if (bookingType === 'session') {
        bookedCount = slotBookings.reduce((sum, b) => sum + (b.participantsCount || 1), 0);
        remainingSlots = Math.max(0, capacity - bookedCount);
        isAvailable = remainingSlots > 0;
      } else {
        // Exclusive court/time_slot
        isAvailable = slotBookings.length === 0;
        bookedCount = slotBookings.length > 0 ? 1 : 0;
        remainingSlots = isAvailable ? 1 : 0;
      }

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        displayTime: slot.displayTime,
        price: pricing.price,
        appliedRule: pricing.appliedRule,
        bookingType,
        capacity,
        bookedCount,
        remainingSlots,
        isAvailable,
        bookingInfo: slotBookings.length > 0
          ? {
              id: slotBookings[0]._id,
              status: slotBookings[0].status,
              playerName: slotBookings[0].playerName,
              playerPhone: slotBookings[0].playerPhone,
              participantsCount: bookedCount,
            }
          : null,
      };
    })
  );

  return {
    facility: {
      id: target._id,
      name: target.name,
      activityType: resolved.activityType,
      bookingType,
      capacity,
      defaultHourlyPrice: target.defaultHourlyPrice,
      operatingHours,
      location: resolved.location,
      venue: venue
        ? {
            id: venue._id,
            name: venue.name,
            location: venue.location,
            phone: venue.phone,
          }
        : null,
    },
    // Also include 'field' for legacy compatibility
    field: {
      id: target._id,
      name: target.name,
      fieldType: target.subType || target.fieldType || '5v5',
      defaultHourlyPrice: target.defaultHourlyPrice,
      operatingHours,
      location: resolved.location,
    },
    dateString,
    slots: enrichedSlots,
  };
}

/**
 * Create a new booking with conflict check, confirmation policy, and rate limiting
 */
export async function createBooking({
  facilityId,
  fieldId,
  dateString,
  startTime,
  endTime,
  playerName,
  playerPhone,
  participantsCount = 1,
  userId = null,
  bookingSource = 'online',
  notes = '',
}) {
  await expireStaleBookings();

  const targetId = facilityId || fieldId;
  const resolved = await resolveFacilityOrField(targetId);
  if (!resolved) {
    const err = new Error('المنشأة أو الملعب غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { target, venue, bookingType, capacity, activityType } = resolved;
  const count = Math.max(1, parseInt(participantsCount, 10) || 1);

  // Rate Limiting: Max 3 pending confirmation bookings per phone number
  if (bookingSource === 'online') {
    const pendingCount = await Booking.countDocuments({
      playerPhone,
      status: 'pending_confirmation',
    });
    if (pendingCount >= 3) {
      const error = new Error('لديك 3 حجوزات معلقة بانتظار التأكيد، يرجى تأكيدها أو إلغاؤها أولاً');
      error.statusCode = 400;
      throw error;
    }
  }

  // Conflict / Capacity check
  const activeBookings = await Booking.find({
    $or: [{ facility: target._id }, { field: target._id }],
    dateString,
    startTime,
    status: { $nin: ['cancelled', 'auto_expired'] },
  });

  if (bookingType === 'session') {
    const totalBooked = activeBookings.reduce((sum, b) => sum + (b.participantsCount || 1), 0);
    const available = capacity - totalBooked;
    if (count > available) {
      const error = new Error(`المقاعد المتبقية في هذه الجلسة (${available}) غير كافية لطلبك (${count})`);
      error.statusCode = 409;
      throw error;
    }
  } else {
    // Exclusive time_slot
    if (activeBookings.length > 0) {
      const error = new Error('هذا الموعد تم حجزه بالفعل، يرجى اختيار موعد آخر');
      error.statusCode = 409;
      throw error;
    }
  }

  // Calculate dynamic price & confirmation policy
  const { price: unitPrice, appliedRule } = await calculateSlotPrice(target._id, dateString, startTime);
  const totalPrice = bookingType === 'session' ? unitPrice * count : unitPrice;
  const policy = getConfirmationPolicyDetails(dateString, startTime, bookingSource);
  const batchId = 'batch_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  const newBooking = await Booking.create({
    venue: venue ? venue._id : null,
    facility: resolved.isFacility ? target._id : null,
    field: !resolved.isFacility ? target._id : null,
    activityType,
    bookingType,
    participantsCount: count,
    user: userId,
    dateString,
    startTime,
    endTime,
    playerName,
    playerPhone,
    price: totalPrice,
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
 * Create multiple bookings (multi-slot)
 */
export async function createMultipleBookings({
  facilityId,
  fieldId,
  dateString,
  slots,
  playerName,
  playerPhone,
  participantsCount = 1,
  userId = null,
  bookingSource = 'online',
  notes = '',
}) {
  await expireStaleBookings();

  const targetId = facilityId || fieldId;
  const resolved = await resolveFacilityOrField(targetId);
  if (!resolved) {
    const err = new Error('المنشأة أو الملعب غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { target, venue, bookingType, capacity, activityType } = resolved;
  const count = Math.max(1, parseInt(participantsCount, 10) || 1);

  if (bookingSource === 'online') {
    const pendingCount = await Booking.countDocuments({
      playerPhone,
      status: 'pending_confirmation',
    });
    if (pendingCount >= 3) {
      const error = new Error('لديك 3 حجوزات معلقة بانتظار التأكيد، يرجى تأكيدها أولاً');
      error.statusCode = 400;
      throw error;
    }
  }

  const startTimes = slots.map((s) => (typeof s === 'string' ? s : s.startTime));

  // Check conflicts for all slots
  const existingBookings = await Booking.find({
    $or: [{ facility: target._id }, { field: target._id }],
    dateString,
    startTime: { $in: startTimes },
    status: { $nin: ['cancelled', 'auto_expired'] },
  });

  if (bookingType !== 'session' && existingBookings.length > 0) {
    const conflictSlot = existingBookings[0].startTime;
    const error = new Error(`أحد المواعيد المحددة (${conflictSlot}) تم حجزه بالفعل`);
    error.statusCode = 409;
    throw error;
  }

  const batchId = 'batch_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const createdBookings = [];
  let totalBatchPrice = 0;

  for (const slot of slots) {
    const slotStartTime = typeof slot === 'string' ? slot : slot.startTime;
    const slotEndTime = typeof slot === 'string' ? null : slot.endTime;

    // Calculate end time if not given
    const calculatedEndTime =
      slotEndTime ||
      `${String(parseInt(slotStartTime.split(':')[0], 10) + 1).padStart(2, '0')}:${slotStartTime.split(':')[1]}`;

    const { price: unitPrice } = await calculateSlotPrice(target._id, dateString, slotStartTime);
    const totalPrice = bookingType === 'session' ? unitPrice * count : unitPrice;
    totalBatchPrice += totalPrice;

    const policy = getConfirmationPolicyDetails(dateString, slotStartTime, bookingSource);

    const bookingDoc = await Booking.create({
      venue: venue ? venue._id : null,
      facility: resolved.isFacility ? target._id : null,
      field: !resolved.isFacility ? target._id : null,
      activityType,
      bookingType,
      participantsCount: count,
      user: userId,
      dateString,
      startTime: slotStartTime,
      endTime: calculatedEndTime,
      playerName,
      playerPhone,
      price: totalPrice,
      bookingSource,
      notes,
      batchId,
      status: policy.status,
      confirmationToken: policy.confirmationToken,
      confirmationDeadline: policy.confirmationDeadline,
      confirmedAt: policy.confirmedAt,
      paymentStatus: 'pending',
    });

    createdBookings.push(bookingDoc);
  }

  return {
    batchId,
    totalPrice: totalBatchPrice,
    bookingsCount: createdBookings.length,
    bookings: createdBookings,
    booking: createdBookings[0],
  };
}

/**
 * Confirm a booking or batch by token
 */
export async function confirmBookingByToken(token) {
  const primaryBooking = await Booking.findOne({ confirmationToken: token });
  if (!primaryBooking) {
    const error = new Error('رمز التأكيد غير صالح أو منتهي الصلاحية');
    error.statusCode = 404;
    throw error;
  }

  if (primaryBooking.status === 'confirmed') {
    return {
      alreadyConfirmed: true,
      message: 'تم تأكيد هذا الحجز بالفعل في وقت سابق',
      booking: primaryBooking,
    };
  }

  if (primaryBooking.status === 'cancelled' || primaryBooking.status === 'auto_expired') {
    const error = new Error('عذراً، تم إلغاء هذا الحجز مسبقاً أو انتهت مهلة تأكيده');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  if (primaryBooking.confirmationDeadline && primaryBooking.confirmationDeadline < now) {
    primaryBooking.status = 'auto_expired';
    await primaryBooking.save();
    const error = new Error('عذراً، انتهت المهلة المحددة لتأكيد الحجز');
    error.statusCode = 400;
    throw error;
  }

  // Update all bookings in this batch
  const updateFilter = primaryBooking.batchId
    ? { batchId: primaryBooking.batchId, status: 'pending_confirmation' }
    : { _id: primaryBooking._id };

  await Booking.updateMany(updateFilter, {
    $set: {
      status: 'confirmed',
      confirmedAt: now,
    },
  });

  const updatedBooking = await Booking.findById(primaryBooking._id)
    .populate('venue')
    .populate('facility')
    .populate('field');

  return {
    alreadyConfirmed: false,
    message: 'تم تأكيد حجزك بنجاح! ننتظرك في الموعد المحدد.',
    booking: updatedBooking,
  };
}
