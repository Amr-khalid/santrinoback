import Booking from '../models/Booking.js';
import Facility from '../models/Facility.js';
import Field from '../models/Field.js';
import { generateTimeSlots } from '../utils/timeSlots.js';

/**
 * Get dashboard overview statistics across owner's facilities / venue
 */
export async function getDashboardStats({ venueId, facilityIds = [], fieldId = null }) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Build query to catch any booking under this venue or facilities or legacy field
  const orConditions = [];
  if (venueId) orConditions.push({ venue: venueId });
  if (facilityIds.length > 0) orConditions.push({ facility: { $in: facilityIds } });
  if (fieldId) orConditions.push({ field: fieldId });

  const baseFilter = orConditions.length > 0 ? { $or: orConditions } : {};

  // Today's bookings
  const todayBookings = await Booking.find({
    ...baseFilter,
    dateString: todayStr,
    status: { $ne: 'cancelled' },
  });

  const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const todayCount = todayBookings.length;

  // Calculate total slots per day across all active facilities
  let totalDailySlots = 0;
  if (facilityIds.length > 0) {
    const facilities = await Facility.find({ _id: { $in: facilityIds }, isActive: true });
    facilities.forEach((f) => {
      const slots = generateTimeSlots(
        f.operatingHours?.open || '08:00',
        f.operatingHours?.close || '24:00',
        f.slotDurationMinutes || 60
      );
      totalDailySlots += slots.length;
    });
  } else if (fieldId) {
    const field = await Field.findById(fieldId);
    if (field) {
      totalDailySlots = generateTimeSlots(
        field.operatingHours?.open || '08:00',
        field.operatingHours?.close || '24:00',
        field.slotDurationMinutes || 60
      ).length;
    }
  }

  if (totalDailySlots === 0) totalDailySlots = 12;

  const todayOccupancy = Math.min(100, Math.round((todayCount / totalDailySlots) * 100));

  // All time stats
  const allBookings = await Booking.find({
    ...baseFilter,
    status: { $ne: 'cancelled' },
  });

  const totalRevenue = allBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const totalBookingsCount = allBookings.length;

  // 7-day revenue and booking breakdown
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const dayNameAr = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(d);

    const dayBookings = allBookings.filter((b) => b.dateString === dStr);
    const dayRev = dayBookings.reduce((sum, b) => sum + (b.price || 0), 0);

    last7Days.push({
      dateString: dStr,
      dayName: dayNameAr,
      bookingsCount: dayBookings.length,
      revenue: dayRev,
    });
  }

  // Recent 10 bookings
  const recentBookings = await Booking.find(baseFilter)
    .populate('venue', 'name')
    .populate('facility', 'name activityType')
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    today: {
      dateString: todayStr,
      bookingsCount: todayCount,
      revenue: todayRevenue,
      occupancyRate: todayOccupancy,
      totalSlots: totalDailySlots,
    },
    total: {
      bookingsCount: totalBookingsCount,
      revenue: totalRevenue,
    },
    chartData: last7Days,
    recentBookings,
  };
}
