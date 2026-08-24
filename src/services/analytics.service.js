import Booking from '../models/Booking.js';
import Field from '../models/Field.js';
import { generateTimeSlots } from '../utils/timeSlots.js';

/**
 * Get dashboard overview statistics for an owner's field
 */
export async function getDashboardStats(fieldId) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Today's bookings
  const todayBookings = await Booking.find({
    field: fieldId,
    dateString: todayStr,
    status: { $ne: 'cancelled' },
  });

  const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const todayCount = todayBookings.length;

  // Calculate field total slots per day
  const field = await Field.findById(fieldId);
  const totalSlotsPerDay = field
    ? generateTimeSlots(field.operatingHours.open, field.operatingHours.close, field.slotDurationMinutes).length
    : 12;

  const todayOccupancy = totalSlotsPerDay > 0 ? Math.round((todayCount / totalSlotsPerDay) * 100) : 0;

  // All time / Month stats
  const allBookings = await Booking.find({
    field: fieldId,
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
  const recentBookings = await Booking.find({ field: fieldId })
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    today: {
      dateString: todayStr,
      bookingsCount: todayCount,
      revenue: todayRevenue,
      occupancyRate: todayOccupancy,
      totalSlots: totalSlotsPerDay,
    },
    total: {
      bookingsCount: totalBookingsCount,
      revenue: totalRevenue,
    },
    chartData: last7Days,
    recentBookings,
  };
}
