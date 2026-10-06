import Booking from '../models/Booking.js';
import Facility from '../models/Facility.js';
import Field from '../models/Field.js';
import {
  getSlotsWithAvailability,
  createBooking,
  createMultipleBookings,
  confirmBookingByToken,
  expireStaleBookings,
} from '../services/booking.service.js';

/**
 * Get available slots for date
 */
export const getAvailableSlots = async (req, res, next) => {
  try {
    let { facilityId, fieldId, date } = req.query;

    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    const targetId = facilityId || fieldId;

    let finalId = targetId;
    if (!finalId) {
      const primaryFacility = await Facility.findOne({ isActive: true });
      if (primaryFacility) {
        finalId = primaryFacility._id;
      } else {
        const primaryField = await Field.findOne({ isActive: true });
        if (!primaryField) {
          return res.status(404).json({ success: false, message: 'لا توجد منشأة أو ملعب متاح' });
        }
        finalId = primaryField._id;
      }
    }

    const data = await getSlotsWithAvailability(finalId, date);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new booking (Single, Multi-Slot, or Session with Participants)
 */
export const makeBooking = async (req, res, next) => {
  try {
    let {
      facilityId,
      fieldId,
      dateString,
      startTime,
      endTime,
      slots,
      playerName,
      playerPhone,
      participantsCount = 1,
      notes,
    } = req.body;

    if (!dateString || !playerName || !playerPhone) {
      return res.status(400).json({
        success: false,
        message: 'يرجى استكمال جميع بيانات الحجز (التاريخ، الاسم، الهاتف)',
      });
    }

    let targetId = facilityId || fieldId;
    if (!targetId) {
      const primaryFacility = await Facility.findOne({ isActive: true });
      if (primaryFacility) {
        targetId = primaryFacility._id;
      } else {
        const primaryField = await Field.findOne({ isActive: true });
        if (!primaryField) {
          return res.status(404).json({ success: false, message: 'لا توجد منشأة أو ملعب متاح' });
        }
        targetId = primaryField._id;
      }
    }

    const userId = req.user ? req.user._id : null;
    const bookingSource = req.user && req.user.role === 'owner' ? 'dashboard_manual' : 'online';

    let result;
    if (Array.isArray(slots) && slots.length > 0) {
      result = await createMultipleBookings({
        facilityId: targetId,
        dateString,
        slots,
        playerName,
        playerPhone,
        participantsCount,
        userId,
        bookingSource,
        notes,
      });
    } else if (startTime && endTime) {
      result = await createBooking({
        facilityId: targetId,
        dateString,
        startTime,
        endTime,
        playerName,
        playerPhone,
        participantsCount,
        userId,
        bookingSource,
        notes,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد الساعات أو الجلسة المراد حجزها',
      });
    }

    res.status(201).json({
      success: true,
      message:
        result.booking.status === 'pending_confirmation'
          ? 'تم الحجز مبدئياً — يرجى تأكيد حضورك'
          : 'تم تأكيد الحجز بنجاح',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user bookings (grouped by reservation batch/session)
 */
export const getMyBookings = async (req, res, next) => {
  try {
    await expireStaleBookings();
    const rawBookings = await Booking.find({
      $or: [{ user: req.user._id }, { playerPhone: req.user.phone }],
    })
      .populate('venue', 'name location phone images rating')
      .populate('facility', 'name activityType bookingType capacity images location')
      .populate('field', 'name location fieldType')
      .sort({ dateString: -1, startTime: 1 });

    const groupedMap = new Map();

    for (const b of rawBookings) {
      const groupKey =
        b.batchId ||
        b.confirmationToken ||
        `${b.facility?._id || b.field?._id || 'target'}_${b.dateString}_${b.playerPhone}_${new Date(b.createdAt).toISOString().slice(0, 16)}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          _id: b._id,
          batchId: b.batchId || groupKey,
          venue: b.venue,
          facility: b.facility,
          field: b.field,
          activityType: b.activityType || b.facility?.activityType || 'football',
          bookingType: b.bookingType || b.facility?.bookingType || 'time_slot',
          participantsCount: b.participantsCount || 1,
          user: b.user,
          dateString: b.dateString,
          startTime: b.startTime,
          endTime: b.endTime,
          playerName: b.playerName,
          playerPhone: b.playerPhone,
          price: b.price,
          status: b.status,
          confirmationToken: b.confirmationToken,
          confirmationDeadline: b.confirmationDeadline,
          confirmedAt: b.confirmedAt,
          paymentStatus: b.paymentStatus,
          bookingSource: b.bookingSource,
          notes: b.notes,
          createdAt: b.createdAt,
          slots: [
            {
              _id: b._id,
              startTime: b.startTime,
              endTime: b.endTime,
              price: b.price,
              status: b.status,
            },
          ],
          totalSlots: 1,
        });
      } else {
        const group = groupedMap.get(groupKey);
        group.slots.push({
          _id: b._id,
          startTime: b.startTime,
          endTime: b.endTime,
          price: b.price,
          status: b.status,
        });
        group.totalSlots = group.slots.length;
        group.price += b.price;

        group.slots.sort((s1, s2) => s1.startTime.localeCompare(s2.startTime));
        group.startTime = group.slots[0].startTime;
        group.endTime = group.slots[group.slots.length - 1].endTime;

        if (b.status === 'pending_confirmation' || group.status === 'pending_confirmation') {
          group.status = 'pending_confirmation';
        } else if (b.status === 'confirmed' || group.status === 'confirmed') {
          group.status = 'confirmed';
        }
      }
    }

    const groupedBookings = Array.from(groupedMap.values()).sort((a, b) => {
      if (a.dateString !== b.dateString) {
        return b.dateString.localeCompare(a.dateString);
      }
      return b.startTime.localeCompare(a.startTime);
    });

    res.json({
      success: true,
      data: groupedBookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
    }

    const isOwnerOrAdmin =
      req.user &&
      (req.user.role === 'owner' || req.user.role === 'admin' || req.user.role === 'superadmin');
    const isCreator =
      req.user &&
      ((booking.user && booking.user.toString() === req.user._id.toString()) ||
        booking.playerPhone === req.user.phone);

    if (!isOwnerOrAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بإلغاء هذا الحجز',
      });
    }

    const batchFilter = booking.batchId
      ? { batchId: booking.batchId }
      : booking.confirmationToken
      ? { confirmationToken: booking.confirmationToken }
      : { _id: booking._id };

    await Booking.updateMany(
      {
        ...batchFilter,
        status: { $nin: ['cancelled', 'auto_expired'] },
      },
      {
        $set: { status: 'cancelled' },
      }
    );

    res.json({
      success: true,
      message: 'تم إلغاء الحجز بنجاح وإتاحة الموعد للآخرين',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single booking by ID
 */
export const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('venue')
      .populate('facility')
      .populate('field');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get booking info by confirmation token
 */
export const getBookingByToken = async (req, res, next) => {
  try {
    await expireStaleBookings();
    const { token } = req.params;

    const primaryBooking = await Booking.findOne({ confirmationToken: token })
      .populate('venue')
      .populate('facility')
      .populate('field');

    if (!primaryBooking) {
      return res.status(404).json({
        success: false,
        message: 'رمز تأكيد الحجز غير موجود أو انتهت صلاحيته',
      });
    }

    let allBookings = [primaryBooking];
    if (primaryBooking.batchId) {
      allBookings = await Booking.find({ batchId: primaryBooking.batchId })
        .populate('venue')
        .populate('facility')
        .populate('field')
        .sort({ startTime: 1 });
    }

    const totalPrice = allBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const sortedSlots = allBookings.map((b) => ({
      _id: b._id,
      startTime: b.startTime,
      endTime: b.endTime,
      price: b.price,
      status: b.status,
    }));

    const fullDetails = {
      ...primaryBooking.toObject(),
      slots: sortedSlots,
      totalSlots: sortedSlots.length,
      totalPrice,
      startTime: sortedSlots[0]?.startTime || primaryBooking.startTime,
      endTime: sortedSlots[sortedSlots.length - 1]?.endTime || primaryBooking.endTime,
    };

    res.json({
      success: true,
      data: fullDetails,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm booking attendance via Token
 */
export const confirmBooking = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await confirmBookingByToken(token);

    res.json({
      success: true,
      message: result.message,
      data: result.booking,
      alreadyConfirmed: result.alreadyConfirmed,
    });
  } catch (error) {
    next(error);
  }
};
