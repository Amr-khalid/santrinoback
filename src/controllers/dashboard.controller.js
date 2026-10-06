import Venue from '../models/Venue.js';
import Facility from '../models/Facility.js';
import Field from '../models/Field.js';
import Booking from '../models/Booking.js';
import PricingRule from '../models/PricingRule.js';
import User from '../models/User.js';
import { getDashboardStats } from '../services/analytics.service.js';
import { createBooking } from '../services/booking.service.js';

// Helper to get owner's venue and facilities
const getOwnerContext = async (userId, role) => {
  let venue = await Venue.findOne({ owner: userId });

  // If superadmin or admin and no personal venue found, take the first venue
  if (!venue && (role === 'admin' || role === 'superadmin')) {
    venue = await Venue.findOne();
  }

  let facilities = [];
  if (venue) {
    facilities = await Facility.find({ venue: venue._id });
  }

  // Also check legacy field
  let field = await Field.findOne({ owner: userId });
  if (!field && (role === 'admin' || role === 'superadmin')) {
    field = await Field.findOne();
  }

  return {
    venue,
    facilities,
    field,
    facilityIds: facilities.map((f) => f._id),
  };
};

/**
 * Get dashboard stats
 */
export const getStats = async (req, res, next) => {
  try {
    const { venue, facilities, field, facilityIds } = await getOwnerContext(req.user._id, req.user.role);

    if (!venue && !field) {
      return res.status(404).json({ success: false, message: 'لا توجد منشأة أو ملاعب مرتبطة بهذا الحساب' });
    }

    const stats = await getDashboardStats({
      venueId: venue ? venue._id : null,
      facilityIds,
      fieldId: field ? field._id : null,
    });

    res.json({
      success: true,
      data: {
        venue,
        facilities,
        field: field || facilities[0],
        ...stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get bookings for dashboard with filters
 */
export const getBookings = async (req, res, next) => {
  try {
    const { venue, facilities, field, facilityIds } = await getOwnerContext(req.user._id, req.user.role);

    const { date, status, search, facilityId, activityType } = req.query;

    const orConditions = [];
    if (facilityId) {
      orConditions.push({ facility: facilityId });
    } else {
      if (venue) orConditions.push({ venue: venue._id });
      if (facilityIds.length > 0) orConditions.push({ facility: { $in: facilityIds } });
      if (field) orConditions.push({ field: field._id });
    }

    const filter = orConditions.length > 0 ? { $or: orConditions } : {};

    if (date) {
      filter.dateString = date;
    }

    if (activityType && activityType !== 'all') {
      filter.activityType = activityType;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { playerName: { $regex: search, $options: 'i' } },
          { playerPhone: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const bookings = await Booking.find(filter)
      .populate('venue', 'name')
      .populate('facility', 'name activityType bookingType')
      .sort({ dateString: -1, startTime: 1 });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update booking status or payment
 */
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { status, paymentStatus, notes } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
    }

    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;
    if (notes !== undefined) booking.notes = notes;

    await booking.save();

    res.json({
      success: true,
      message: 'تم تحديث حالة الحجز',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create manual booking from dashboard (for phone or walk-in customers)
 */
export const createManualBooking = async (req, res, next) => {
  try {
    const { venue, facilities, field } = await getOwnerContext(req.user._id, req.user.role);

    const {
      facilityId,
      fieldId,
      dateString,
      startTime,
      endTime,
      playerName,
      playerPhone,
      participantsCount = 1,
      notes,
      paymentStatus,
    } = req.body;

    if (!dateString || !startTime || !endTime || !playerName || !playerPhone) {
      return res.status(400).json({ success: false, message: 'بيانات الحجز غير مكتملة' });
    }

    const targetFacilityId = facilityId || (facilities.length > 0 ? facilities[0]._id : null);
    const targetFieldId = fieldId || (field ? field._id : null);

    if (!targetFacilityId && !targetFieldId) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد المنشأة أو الملعب المراد حجزه' });
    }

    const result = await createBooking({
      facilityId: targetFacilityId,
      fieldId: targetFieldId,
      dateString,
      startTime,
      endTime,
      playerName,
      playerPhone,
      participantsCount,
      userId: req.user._id,
      bookingSource: 'dashboard_manual',
      notes,
    });

    if (paymentStatus) {
      result.booking.paymentStatus = paymentStatus;
      await result.booking.save();
    }

    res.status(201).json({
      success: true,
      message: 'تم تسجيل الحجز اليدوي بنجاح',
      data: result.booking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pricing rules for owner's facilities
 */
export const getPricingRules = async (req, res, next) => {
  try {
    const { facilities, field, facilityIds } = await getOwnerContext(req.user._id, req.user.role);

    const query = {
      $or: [
        { facility: { $in: facilityIds } },
        ...(field ? [{ field: field._id }] : []),
      ],
    };

    const rules = await PricingRule.find(query)
      .populate('facility', 'name activityType')
      .sort({ priority: -1, createdAt: -1 });

    const primaryFacility = facilities[0] || field;

    res.json({
      success: true,
      data: {
        fieldDefaultPrice: primaryFacility?.defaultHourlyPrice || 200,
        defaultDayPrice: primaryFacility?.defaultDayPrice !== undefined ? primaryFacility.defaultDayPrice : 180,
        defaultNightPrice: primaryFacility?.defaultNightPrice !== undefined ? primaryFacility.defaultNightPrice : 250,
        rules,
        facilities,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update default Day and Night prices
 */
export const updateDefaultPrices = async (req, res, next) => {
  try {
    const { facilities, field } = await getOwnerContext(req.user._id, req.user.role);
    const { facilityId, defaultDayPrice, defaultNightPrice } = req.body;

    const target = facilityId
      ? await Facility.findById(facilityId)
      : facilities[0] || field;

    if (!target) {
      return res.status(404).json({ success: false, message: 'المنشأة غير موجودة' });
    }

    if (defaultDayPrice !== undefined) {
      target.defaultDayPrice = Number(defaultDayPrice);
      target.defaultHourlyPrice = Number(defaultDayPrice);
    }
    if (defaultNightPrice !== undefined) {
      target.defaultNightPrice = Number(defaultNightPrice);
    }

    await target.save();

    res.json({
      success: true,
      message: 'تم تحديث الأسعار الافتراضية بنجاح',
      data: {
        defaultDayPrice: target.defaultDayPrice,
        defaultNightPrice: target.defaultNightPrice,
        fieldDefaultPrice: target.defaultHourlyPrice,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create pricing rule
 */
export const createPricingRule = async (req, res, next) => {
  try {
    const { facilities, field } = await getOwnerContext(req.user._id, req.user.role);
    const { facilityId, name, daysOfWeek, startTime, endTime, price, priority } = req.body;

    if (!name || !startTime || !endTime || price === undefined) {
      return res.status(400).json({ success: false, message: 'يرجى ملء جميع حقول قاعدة التسعير' });
    }

    const targetFacility = facilityId ? await Facility.findById(facilityId) : facilities[0];

    const rule = await PricingRule.create({
      facility: targetFacility ? targetFacility._id : null,
      field: field ? field._id : null,
      name,
      daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      startTime,
      endTime,
      price: Number(price),
      priority: priority !== undefined ? Number(priority) : 1,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة قاعدة التسعير بنجاح',
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update pricing rule
 */
export const updatePricingRule = async (req, res, next) => {
  try {
    const rule = await PricingRule.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, message: 'قاعدة التسعير غير موجودة' });
    }

    res.json({
      success: true,
      message: 'تم تحديث قاعدة التسعير بنجاح',
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete pricing rule
 */
export const deletePricingRule = async (req, res, next) => {
  try {
    const rule = await PricingRule.findByIdAndDelete(req.params.id);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'قاعدة التسعير غير موجودة' });
    }

    res.json({
      success: true,
      message: 'تم حذف قاعدة التسعير بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get customers list
 */
export const getCustomers = async (req, res, next) => {
  try {
    const { venue, facilityIds, field } = await getOwnerContext(req.user._id, req.user.role);

    const orConditions = [];
    if (venue) orConditions.push({ venue: venue._id });
    if (facilityIds.length > 0) orConditions.push({ facility: { $in: facilityIds } });
    if (field) orConditions.push({ field: field._id });

    const baseFilter = orConditions.length > 0 ? { $or: orConditions } : {};

    const customers = await Booking.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$playerPhone',
          playerName: { $last: '$playerName' },
          totalBookings: { $sum: 1 },
          totalSpent: { $sum: '$price' },
          lastBookingDate: { $max: '$dateString' },
        },
      },
      { $sort: { totalBookings: -1 } },
    ]);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get customer specific bookings
 */
export const getCustomerBookings = async (req, res, next) => {
  try {
    const { id } = req.params; // Phone number or userId
    const bookings = await Booking.find({
      $or: [{ playerPhone: id }, { user: id }],
    })
      .populate('venue', 'name')
      .populate('facility', 'name activityType')
      .sort({ dateString: -1, startTime: 1 });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};
