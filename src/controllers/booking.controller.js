import Booking from '../models/Booking.js';
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
    let { fieldId, date } = req.query;

    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    if (!fieldId) {
      const primaryField = await Field.findOne({ isActive: true });
      if (!primaryField) {
        return res.status(404).json({ success: false, message: 'لا يوجد ملعب متاح' });
      }
      fieldId = primaryField._id;
    }

    const data = await getSlotsWithAvailability(fieldId, date);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new booking (Single or Multi-Slot)
 */
export const makeBooking = async (req, res, next) => {
  try {
    let { fieldId, dateString, startTime, endTime, slots, playerName, playerPhone, notes } = req.body;

    if (!dateString || !playerName || !playerPhone) {
      return res.status(400).json({
        success: false,
        message: 'يرجى استكمال جميع بيانات الحجز (التاريخ، الاسم، الهاتف)',
      });
    }

    if (!fieldId) {
      const primaryField = await Field.findOne({ isActive: true });
      if (!primaryField) {
        return res.status(404).json({ success: false, message: 'لا يوجد ملعب متاح' });
      }
      fieldId = primaryField._id;
    }

    const userId = req.user ? req.user._id : null;
    const bookingSource = req.user && req.user.role === 'owner' ? 'dashboard_manual' : 'online';

    let result;
    if (Array.isArray(slots) && slots.length > 0) {
      result = await createMultipleBookings({
        fieldId,
        dateString,
        slots,
        playerName,
        playerPhone,
        userId,
        bookingSource,
        notes,
      });
    } else if (startTime && endTime) {
      result = await createBooking({
        fieldId,
        dateString,
        startTime,
        endTime,
        playerName,
        playerPhone,
        userId,
        bookingSource,
        notes,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد الساعات المراد حجزها',
      });
    }

    res.status(201).json({
      success: true,
      message: result.booking.status === 'pending_confirmation' ? 'تم الحجز مبدئياً — يرجى تأكيد حضورك' : 'تم تأكيد الحجز بنجاح',
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
      .populate('field', 'name location fieldType')
      .sort({ dateString: -1, startTime: 1 });

    // Group bookings that belong to the same reservation session
    const groupedMap = new Map();

    for (const b of rawBookings) {
      const groupKey =
        b.batchId ||
        b.confirmationToken ||
        `${b.field?._id || b.field}_${b.dateString}_${b.playerPhone}_${new Date(b.createdAt).toISOString().slice(0, 16)}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          _id: b._id,
          batchId: b.batchId || groupKey,
          field: b.field,
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

        // Sort slots and expand overall startTime and endTime
        group.slots.sort((s1, s2) => s1.startTime.localeCompare(s2.startTime));
        group.startTime = group.slots[0].startTime;
        group.endTime = group.slots[group.slots.length - 1].endTime;

        // Representative status: if any is pending_confirmation, group is pending_confirmation
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
 * Cancel a booking (and all hours in the same reservation session)
 */
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
    }

    // Check permission: superadmin, owner, admin, or the creator player
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

    // Build batch cancellation filter
    const batchFilter = booking.batchId
      ? { batchId: booking.batchId }
      : booking.confirmationToken
      ? { confirmationToken: booking.confirmationToken }
      : {
          field: booking.field,
          dateString: booking.dateString,
          playerPhone: booking.playerPhone,
          createdAt: {
            $gte: new Date(new Date(booking.createdAt).getTime() - 60000),
            $lte: new Date(new Date(booking.createdAt).getTime() + 60000),
          },
        };

    // Cancel all linked bookings in that reservation batch
    await Booking.updateMany(
      {
        ...batchFilter,
        status: { $nin: ['cancelled', 'auto_expired'] },
      },
      {
        $set: { status: 'cancelled' },
      }
    );

    booking.status = 'cancelled';

    res.json({
      success: true,
      message: 'تم إلغاء الحجز بنجاح',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get booking details by ID
 */
export const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('field');
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
 * Get booking by confirmation token
 */
export const getBookingByToken = async (req, res, next) => {
  try {
    await expireStaleBookings();
    const token = req.params.token;
    const bookings = await Booking.find({ confirmationToken: token }).populate('field');

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ success: false, message: 'رابط التأكيد غير صحيح أو انتهت صلاحيته' });
    }

    res.json({
      success: true,
      data: {
        bookings,
        mainBooking: bookings[0],
        totalPrice: bookings.reduce((sum, b) => sum + b.price, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm booking via confirmation token
 */
export const confirmBooking = async (req, res, next) => {
  try {
    const token = req.params.token;
    const result = await confirmBookingByToken(token);
    res.json({
      success: true,
      message: result.message,
      data: result.bookings,
    });
  } catch (error) {
    next(error);
  }
};
