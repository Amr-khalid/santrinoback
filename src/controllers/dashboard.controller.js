import Field from '../models/Field.js';
import Booking from '../models/Booking.js';
import PricingRule from '../models/PricingRule.js';
import User from '../models/User.js';
import { getDashboardStats } from '../services/analytics.service.js';
import { createBooking } from '../services/booking.service.js';

// Helper to get owner field
const getOwnerField = async (userId, role) => {
  if (role === 'admin') {
    return await Field.findOne({ isActive: true });
  }
  let field = await Field.findOne({ owner: userId });
  if (!field) {
    // fallback to first field if single-field MVP
    field = await Field.findOne();
  }
  return field;
};

/**
 * Get dashboard stats
 */
export const getStats = async (req, res, next) => {
  try {
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط بهذا الحساب' });
    }

    const stats = await getDashboardStats(field._id);
    res.json({
      success: true,
      data: {
        field,
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
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط' });
    }

    const { date, status, search } = req.query;
    const filter = { field: field._id };

    if (date) {
      filter.dateString = date;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { playerName: { $regex: search, $options: 'i' } },
        { playerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const bookings = await Booking.find(filter).sort({ dateString: -1, startTime: 1 });

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
 * Create manual booking from dashboard (e.g. phone call or walk-in)
 */
export const createManualBooking = async (req, res, next) => {
  try {
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط' });
    }

    const { dateString, startTime, endTime, playerName, playerPhone, price, notes, paymentStatus } = req.body;

    if (!dateString || !startTime || !endTime || !playerName || !playerPhone) {
      return res.status(400).json({ success: false, message: 'بيانات الحجز غير مكتملة' });
    }

    const result = await createBooking({
      fieldId: field._id,
      dateString,
      startTime,
      endTime,
      playerName,
      playerPhone,
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
 * Get pricing rules for field
 */
export const getPricingRules = async (req, res, next) => {
  try {
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط' });
    }

    const rules = await PricingRule.find({ field: field._id }).sort({ priority: -1, createdAt: -1 });

    res.json({
      success: true,
      data: {
        fieldDefaultPrice: field.defaultHourlyPrice || 150,
        defaultDayPrice: field.defaultDayPrice !== undefined ? field.defaultDayPrice : 150,
        defaultNightPrice: field.defaultNightPrice !== undefined ? field.defaultNightPrice : 200,
        rules,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update default Day and Night prices directly
 */
export const updateDefaultPrices = async (req, res, next) => {
  try {
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط' });
    }

    const { defaultDayPrice, defaultNightPrice } = req.body;

    if (defaultDayPrice !== undefined) {
      field.defaultDayPrice = Number(defaultDayPrice);
      field.defaultHourlyPrice = Number(defaultDayPrice);
    }
    if (defaultNightPrice !== undefined) {
      field.defaultNightPrice = Number(defaultNightPrice);
    }

    await field.save();

    res.json({
      success: true,
      message: 'تم تحديث الأسعار الافتراضية بنجاح',
      data: {
        defaultDayPrice: field.defaultDayPrice,
        defaultNightPrice: field.defaultNightPrice,
        fieldDefaultPrice: field.defaultHourlyPrice,
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
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط' });
    }

    const { name, daysOfWeek, startTime, endTime, price, priority } = req.body;

    if (!name || !startTime || !endTime || price === undefined) {
      return res.status(400).json({ success: false, message: 'يرجى ملء جميع حقول قاعدة التسعير' });
    }

    const rule = await PricingRule.create({
      field: field._id,
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
    const rule = await PricingRule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!rule) {
      return res.status(404).json({ success: false, message: 'قاعدة التسعير غير موجودة' });
    }

    res.json({
      success: true,
      message: 'تم تعديل قاعدة التسعير',
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
      message: 'تم حذف قاعدة التسعير',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get customers / users who have booked or registered
 */
export const getCustomers = async (req, res, next) => {
  try {
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط' });
    }

    const { search, filter } = req.query;

    // 1. Fetch registered players
    const registeredUsers = await User.find({ role: 'player' }).select('-password').lean();

    // 2. Fetch all bookings for this field
    const allBookings = await Booking.find({ field: field._id }).sort({ createdAt: -1 }).lean();

    // Group bookings by user ID or phone number
    const customerMap = new Map();

    // First initialize from registered users
    for (const u of registeredUsers) {
      const key = u._id.toString();
      customerMap.set(key, {
        id: key,
        userId: u._id,
        name: u.name,
        phone: u.phone || '',
        email: u.email || '',
        avatar: u.avatar || '',
        role: u.role,
        isRegistered: true,
        totalBookings: 0,
        confirmedBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalSpent: 0,
        lastBookingDate: null,
        createdAt: u.createdAt,
      });
    }

    // Map phone numbers of registered users to their key for quick lookup
    const phoneToKey = new Map();
    for (const [key, cust] of customerMap.entries()) {
      if (cust.phone) {
        phoneToKey.set(cust.phone.trim(), key);
      }
    }

    // Aggregate booking info
    for (const b of allBookings) {
      let key = null;
      if (b.user && customerMap.has(b.user.toString())) {
        key = b.user.toString();
      } else if (b.playerPhone && phoneToKey.has(b.playerPhone.trim())) {
        key = phoneToKey.get(b.playerPhone.trim());
      } else if (b.playerPhone) {
        // Guest or unlinked customer
        const guestKey = `phone_${b.playerPhone.trim()}`;
        if (!customerMap.has(guestKey)) {
          customerMap.set(guestKey, {
            id: guestKey,
            userId: null,
            name: b.playerName,
            phone: b.playerPhone,
            email: '',
            avatar: '',
            role: 'guest',
            isRegistered: false,
            totalBookings: 0,
            confirmedBookings: 0,
            completedBookings: 0,
            cancelledBookings: 0,
            totalSpent: 0,
            lastBookingDate: null,
            createdAt: b.createdAt,
          });
        }
        key = guestKey;
      }

      if (key && customerMap.has(key)) {
        const cust = customerMap.get(key);
        cust.totalBookings += 1;
        if (b.status === 'confirmed') cust.confirmedBookings += 1;
        if (b.status === 'completed') cust.completedBookings += 1;
        if (b.status === 'cancelled' || b.status === 'auto_expired') cust.cancelledBookings += 1;
        if (['confirmed', 'completed'].includes(b.status) || ['paid_cash', 'paid_online'].includes(b.paymentStatus)) {
          cust.totalSpent += (b.price || 0);
        }
        if (!cust.lastBookingDate || new Date(b.dateString) > new Date(cust.lastBookingDate)) {
          cust.lastBookingDate = b.dateString;
        }
      }
    }

    let customers = Array.from(customerMap.values());

    // Apply search
    if (search) {
      const q = search.toLowerCase().trim();
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    // Apply filter
    if (filter === 'frequent') {
      customers = customers.filter((c) => c.totalBookings >= 3);
    } else if (filter === 'active') {
      customers = customers.filter((c) => c.confirmedBookings > 0);
    } else if (filter === 'new') {
      customers = customers.filter((c) => c.totalBookings <= 1);
    }

    // Default sort by total bookings desc, then total spent desc
    customers.sort((a, b) => b.totalBookings - a.totalBookings || b.totalSpent - a.totalSpent);

    // Summary statistics
    const stats = {
      totalCustomers: customers.length,
      activeBookers: customers.filter((c) => c.totalBookings > 0).length,
      totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
      topCustomer: customers.length > 0 && customers[0].totalBookings > 0 ? customers[0] : null,
    };

    res.json({
      success: true,
      data: {
        stats,
        customers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all bookings for a specific customer/user
 */
export const getCustomerBookings = async (req, res, next) => {
  try {
    const field = await getOwnerField(req.user._id, req.user.role);
    if (!field) {
      return res.status(404).json({ success: false, message: 'لا يوجد ملعب مرتبط' });
    }

    const { id } = req.params;
    let filter = { field: field._id };

    if (id.startsWith('phone_')) {
      const phone = id.replace('phone_', '');
      filter.playerPhone = phone;
    } else {
      // It's a User ObjectId
      const user = await User.findById(id).select('-password');
      if (user) {
        filter.$or = [
          { user: user._id },
          ...(user.phone ? [{ playerPhone: user.phone }] : [])
        ];
      } else {
        filter.user = id;
      }
    }

    const bookings = await Booking.find(filter).sort({ dateString: -1, startTime: -1 });

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};
