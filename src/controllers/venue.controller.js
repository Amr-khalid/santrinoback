import Venue from '../models/Venue.js';
import Facility from '../models/Facility.js';

/**
 * Get all venues with optional filters
 * Query params: activity, city, search, featured
 */
export const getVenues = async (req, res, next) => {
  try {
    const { activity, city, search, featured } = req.query;

    const query = { isActive: true };

    if (featured === 'true') {
      query.featured = true;
    }

    if (city) {
      query['location.city'] = { $regex: new RegExp(city, 'i') };
    }

    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { 'location.address': { $regex: new RegExp(search, 'i') } },
        { 'location.city': { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } },
      ];
    }

    if (activity) {
      query.activities = activity;
    }

    const venues = await Venue.find(query).sort({ rating: -1, createdAt: -1 });

    // Populate facilities summary for each venue
    const enrichedVenues = await Promise.all(
      venues.map(async (v) => {
        const facilities = await Facility.find({ venue: v._id, isActive: true }).select(
          'name activityType bookingType defaultHourlyPrice defaultDayPrice defaultNightPrice capacity'
        );

        const prices = facilities.map((f) => f.defaultDayPrice || f.defaultHourlyPrice || 150);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 150;

        // Distinct activities in actual facilities
        const activeActivities = Array.from(new Set(facilities.map((f) => f.activityType)));

        return {
          ...v.toObject(),
          facilitiesCount: facilities.length,
          startingPrice: minPrice,
          availableActivities: activeActivities.length > 0 ? activeActivities : v.activities,
          facilities,
        };
      })
    );

    res.json({
      success: true,
      data: enrichedVenues,
      count: enrichedVenues.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single venue by ID or slug, populated with all its facilities
 */
export const getVenueById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let venue = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      venue = await Venue.findById(id).populate('owner', 'name phone email');
    } else {
      venue = await Venue.findOne({ slug: id, isActive: true }).populate('owner', 'name phone email');
    }

    if (!venue) {
      return res.status(404).json({ success: false, message: 'المنشأة الرياضية غير موجودة' });
    }

    // Fetch all facilities under this venue
    const facilities = await Facility.find({ venue: venue._id, isActive: true }).sort({ createdAt: 1 });

    const prices = facilities.map((f) => f.defaultDayPrice || f.defaultHourlyPrice || 150);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 150;
    const activeActivities = Array.from(new Set(facilities.map((f) => f.activityType)));

    res.json({
      success: true,
      data: {
        ...venue.toObject(),
        facilities,
        startingPrice: minPrice,
        availableActivities: activeActivities.length > 0 ? activeActivities : venue.activities,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my venue (for authenticated Owner)
 */
export const getMyVenue = async (req, res, next) => {
  try {
    let venue = await Venue.findOne({ owner: req.user._id });
    if (!venue) {
      // If superadmin or admin, return the first venue
      if (req.user.role === 'superadmin' || req.user.role === 'admin') {
        venue = await Venue.findOne();
      }
    }

    if (!venue) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على منشأة لهذا الحساب' });
    }

    const facilities = await Facility.find({ venue: venue._id });

    res.json({
      success: true,
      data: {
        ...venue.toObject(),
        facilities,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new venue
 */
export const createVenue = async (req, res, next) => {
  try {
    const {
      name,
      description,
      shortDescription,
      location,
      phone,
      amenities,
      images,
      activities,
    } = req.body;

    if (!name || !location?.address) {
      return res.status(400).json({ success: false, message: 'اسم المنشأة وعنوانها مطلوبان' });
    }

    const newVenue = await Venue.create({
      name,
      owner: req.user._id,
      description: description || '',
      shortDescription: shortDescription || '',
      location: {
        address: location.address,
        city: location.city || 'القاهرة الجديدة',
        mapUrl: location.mapUrl || 'https://maps.google.com',
      },
      phone: phone || req.user.phone,
      amenities: amenities || [],
      images: images || [],
      activities: activities || ['football', 'padel'],
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المنشأة الرياضية بنجاح',
      data: newVenue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update venue
 */
export const updateVenue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const venue = await Venue.findById(id);

    if (!venue) {
      return res.status(404).json({ success: false, message: 'المنشأة غير موجودة' });
    }

    // Verify ownership or superadmin
    if (venue.owner.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل هذه المنشأة' });
    }

    const updated = await Venue.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });

    res.json({
      success: true,
      message: 'تم تحديث بيانات المنشأة بنجاح',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
