/**
 * Generate time slots between open and close hours
 * Handles overnight hours (e.g. open at 14:00 and close at 02:00 next day)
 * @param {string} openStr - "14:00"
 * @param {string} closeStr - "02:00"
 * @param {number} durationMinutes - 60
 * @returns {Array<{startTime: string, endTime: string, isNextDay: boolean}>}
 */
export function generateTimeSlots(openStr = '14:00', closeStr = '02:00', durationMinutes = 60) {
  const [openHour, openMin] = openStr.split(':').map(Number);
  const [closeHour, closeMin] = closeStr.split(':').map(Number);

  let startTotalMinutes = openHour * 60 + openMin;
  let endTotalMinutes = closeHour * 60 + closeMin;

  // If close time is less than or equal to start time, it closes the next day
  if (endTotalMinutes <= startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  const slots = [];
  let currentMinutes = startTotalMinutes;

  while (currentMinutes + durationMinutes <= endTotalMinutes) {
    const slotStart = formatMinutesToTime(currentMinutes % (24 * 60));
    const slotEnd = formatMinutesToTime((currentMinutes + durationMinutes) % (24 * 60));

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      displayTime: `${formatTimeAr(slotStart)} - ${formatTimeAr(slotEnd)}`,
      isOvernight: currentMinutes >= 24 * 60,
    });

    currentMinutes += durationMinutes;
  }

  return slots;
}

/**
 * Format total minutes of day to "HH:MM"
 */
export function formatMinutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format 24h time to 12h Arabic string (e.g. 18:00 -> "6:00 م")
 */
export function formatTimeAr(timeStr) {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'م' : 'ص';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${period}`;
}

/**
 * Check if a slot time falls within a rule time range
 */
export function isTimeInRange(slotStartTime, ruleStartTime, ruleEndTime) {
  const [sH, sM] = slotStartTime.split(':').map(Number);
  const [rH1, rM1] = ruleStartTime.split(':').map(Number);
  const [rH2, rM2] = ruleEndTime.split(':').map(Number);

  let slotMin = sH * 60 + sM;
  let ruleMin1 = rH1 * 60 + rM1;
  let ruleMin2 = rH2 * 60 + rM2;

  // Handle overnight range for rule (e.g. 20:00 to 02:00)
  if (ruleMin2 <= ruleMin1) {
    ruleMin2 += 24 * 60;
    if (slotMin < ruleMin1 && slotMin + 24 * 60 < ruleMin2) {
      slotMin += 24 * 60;
    }
  }

  return slotMin >= ruleMin1 && slotMin < ruleMin2;
}
