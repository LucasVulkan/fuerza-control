const DAY_MS = 86400000;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Status of each day (Monday→Sunday) of the week containing `now`, derived
 * from workoutLog: "entrenó" = any log entry (including free sessions) that
 * calendar day. `today` is split into two sub-statuses so the UI can show a
 * distinct ring-only vs. ring-with-center-dot look.
 *
 * Returns 7 `{ date, status }`, status ∈ 'trained' | 'todayTrained' | 'today'
 * | 'past' | 'future'.
 */
export function getWeekStatuses(workoutLog, now = Date.now()) {
  const today = startOfDay(now);
  const monday = today - ((new Date(today).getDay() + 6) % 7) * DAY_MS;
  const trainedDays = new Set(workoutLog.map((e) => startOfDay(e.timestamp)));

  return Array.from({ length: 7 }, (_, i) => {
    const date    = monday + i * DAY_MS;
    const trained = trainedDays.has(date);
    const isToday = date === today;
    const status  = isToday
      ? (trained ? 'todayTrained' : 'today')
      : (trained ? 'trained' : (date > today ? 'future' : 'past'));
    return { date, status };
  });
}
