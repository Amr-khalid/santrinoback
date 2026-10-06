import Facility from '../models/Facility.js';
import Venue from '../models/Venue.js';
import Booking from '../models/Booking.js';
import { getSlotsWithAvailability } from '../services/booking.service.js';

/**
 * Get all facilities with optional filters
 */
export const getFacilities = async (req, res, next) => {
  try {
    const { venueId, activityType, bookingType } = req.query;

    const query = { isActive: true };
    if (venueId) query.venue = venueId;
    if (activityType) query.activityType = activityType;
    if (bookingType) query.bookingType = bookingType;

    const facilities = await Facility.find(query).populate('venue', 'name location phone images rating');

    res.json({
      success: true,
      data: facilities,
      count: facilities.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single facility with its venue details
 */
export const getFacilityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const facility = await Facility.findById(id).populate('venue');

    if (!facility) {
      return res.status(404).json({ success: false, message: 'المنشأة غير موجودة' });
    }

    res.json({
      success: true,
      data: facility,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get facility availability for a given date
 */
export const getFacilityAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { date } = req.query;

    if (!date) {
      date = new Date().toISOString().split('T')[0];
    }

    const data = await getSlotsWithAvailability(id, date);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new facility under an owner's venue
 */
export const createFacility = async (req, res, next) => {
  try {
    let {
      venueId,
      name,
      activityType,
      subType,
      description,
      images,
      amenities,
      bookingType,
      capacity,
      slotDurationMinutes,
      operatingHours,
      defaultHourlyPrice,
      defaultDayPrice,
      defaultNightPrice,
    } = req.body;

    if (!name || !activityType) {
      return res.status(400).json({ success: false, message: 'اسم المنشأة ونوع النشاط مطلوبان' });
    }

    // Resolve venue
    let venue = null;
    if (venueId) {
      venue = await Venue.findById(venueId);
    } else {
      venue = await Venue.findOne({ owner: req.user._id });
    }

    if (!venue) {
      return res.status(400).json({
        success: false,
        message: 'يجب إنشاء وتحديد منشأة (Venue) أولاً قبل إضافة الملاعب والأنشطة',
      });
    }

    // Verify ownership or superadmin
    if (venue.owner.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بإضافة ملاعب لهذه المنشأة' });
    }

    const facility = await Facility.create({
      venue: venue._id,
      name,
      activityType,
      subType: subType || '',
      description: description || '',
      images: images || [],
      amenities: amenities || [],
      bookingType: bookingType || 'time_slot',
      capacity: bookingType === 'session' ? (parseInt(capacity, 10) || 20) : 1,
      slotDurationMinutes: parseInt(slotDurationMinutes, 10) || 60,
      operatingHours: operatingHours || { open: '08:00', close: '02:00' },
      defaultHourlyPrice: parseFloat(defaultHourlyPrice) || 200,
      defaultDayPrice: parseFloat(defaultDayPrice) || parseFloat(defaultHourlyPrice) || 180,
      defaultNightPrice: parseFloat(defaultNightPrice) || parseFloat(defaultHourlyPrice) || 250,
      isActive: true,
    });

    // Update venue's activities list if new activity
    if (!venue.activities.includes(activityType)) {
      venue.activities.push(activityType);
      await venue.save();
    }

    res.status(201).json({
      success: true,
      message: 'تم إضافة المنشأة / الملعب بنجاح',
      data: facility,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update facility
 */
export const updateFacility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const facility = await Facility.findById(id).populate('venue');

    if (!facility) {
      return res.status(404).json({ success: false, message: 'المنشأة غير موجودة' });
    }

    // Verify ownership
    if (facility.venue.owner.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل هذه المنشأة' });
    }

    const updated = await Facility.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'تم تحديث المنشأة بنجاح',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle facility active status (Pause / Activate)
 */
export const toggleFacilityStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const facility = await Facility.findById(id).populate('venue');

    if (!facility) {
      return res.status(404).json({ success: false, message: 'المنشأة غير موجودة' });
    }

    if (facility.venue.owner.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بإجراء هذا التعديل' });
    }

    facility.isActive = !facility.isActive;
    await facility.save();

    res.json({
      success: true,
      message: facility.isActive ? 'تم تفعيل المنشأة واستقبال الحجوزات' : 'تم إيقاف المنشأة مؤقتاً',
      data: facility,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete facility
 */
export const deleteFacility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const facility = await Facility.findById(id).populate('venue');

    if (!facility) {
      return res.status(404).json({ success: false, message: 'المنشأة غير موجودة' });
    }

    if (facility.venue.owner.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بحذف هذه المنشأة' });
    }

    // Soft delete or remove
    await Facility.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'تم حذف المنشأة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};
