import PricingRule from '../models/PricingRule.js';
import Facility from '../models/Facility.js';
import Field from '../models/Field.js';
import { isTimeInRange } from '../utils/timeSlots.js';

/**
 * Calculate dynamic price for a specific slot/session on a given date
 * @param {string} targetId - Facility ID or Field ID
 * @param {string} dateString - "YYYY-MM-DD"
 * @param {string} startTime - "18:00"
 * @returns {Promise<{price: number, appliedRule: object | null}>}
 */
export async function calculateSlotPrice(targetId, dateString, startTime) {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

  // Check Facility first, then fallback to Field
  let target = await Facility.findById(targetId);
  if (!target) {
    target = await Field.findById(targetId);
  }

  if (!target) {
    throw new Error('المنشأة أو الملعب غير موجود');
  }

  // Fetch active rules for this facility / field
  const rules = await PricingRule.find({
    $or: [{ facility: targetId }, { field: targetId }],
    isActive: true,
  }).sort({ priority: -1 });

  for (const rule of rules) {
    // Check if day matches
    if (rule.daysOfWeek.includes(dayOfWeek)) {
      // Check if time matches
      if (isTimeInRange(startTime, rule.startTime, rule.endTime)) {
        return {
          price: rule.price,
          appliedRule: {
            id: rule._id,
            name: rule.name,
            priority: rule.priority,
          },
        };
      }
    }
  }

  // Fallback to default day / night price
  const hour = parseInt(startTime.split(':')[0], 10);
  const isNight = hour >= 18 || hour < 6; // 6 PM to 6 AM
  const fallbackPrice = isNight
    ? (target.defaultNightPrice !== undefined ? target.defaultNightPrice : (target.defaultHourlyPrice || 200))
    : (target.defaultDayPrice !== undefined ? target.defaultDayPrice : (target.defaultHourlyPrice || 150));

  return {
    price: fallbackPrice,
    appliedRule: {
      id: null,
      name: isNight ? 'السعر الافتراضي (الليل)' : 'السعر الافتراضي (النهار)',
      priority: 0,
    },
  };
}
