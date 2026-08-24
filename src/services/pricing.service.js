import PricingRule from '../models/PricingRule.js';
import Field from '../models/Field.js';
import { isTimeInRange } from '../utils/timeSlots.js';

/**
 * Calculate dynamic price for a specific slot on a given date
 * @param {string} fieldId
 * @param {string} dateString - "YYYY-MM-DD"
 * @param {string} startTime - "18:00"
 * @returns {Promise<{price: number, appliedRule: object | null}>}
 */
export async function calculateSlotPrice(fieldId, dateString, startTime) {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

  // Fetch field for default price
  const field = await Field.findById(fieldId);
  if (!field) {
    throw new Error('الملعب غير موجود');
  }

  // Fetch active rules for this field
  const rules = await PricingRule.find({
    field: fieldId,
    isActive: true,
  }).sort({ priority: -1 }); // Highest priority first

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

  // Fallback to default field day (150) / night (200) price
  const hour = parseInt(startTime.split(':')[0], 10);
  const isNight = hour >= 18 || hour < 6; // 6 PM to 6 AM
  const fallbackPrice = isNight
    ? (field.defaultNightPrice !== undefined ? field.defaultNightPrice : 200)
    : (field.defaultDayPrice !== undefined ? field.defaultDayPrice : 150);

  return {
    price: fallbackPrice,
    appliedRule: {
      id: null,
      name: isNight ? 'السعر الافتراضي (الليل)' : 'السعر الافتراضي (النهار)',
      priority: 0,
    },
  };
}

