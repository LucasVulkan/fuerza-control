
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
/**
 * El lunes de la semana de `ts`, avanzando con `setDate` y no restando
 * múltiplos de 86 400 000: donde el cambio de hora cae a medianoche (Chile,
 * Brasil histórico, Lord Howe) la aritmética fija desplaza la semana entera y
 * ningún día coincide con `startOfDay(e.timestamp)` — la tira sale toda sin
 * entrenar. `trainingLoad.js` y `adherence.js` ya lo hacen así.
 */
function startOfWeek(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function getWeekStatuses(workoutLog, now = Date.now()) {
  const today = startOfDay(now);
  const monday = startOfWeek(now);
  const trainedDays = new Set(workoutLog.map((e) => startOfDay(e.timestamp)));

  return Array.from({ length: 7 }, (_, i) => {
    const cursor = new Date(monday);
    cursor.setDate(cursor.getDate() + i);
    const date    = cursor.getTime();
    const trained = trainedDays.has(date);
    const isToday = date === today;
    const status  = isToday
      ? (trained ? 'todayTrained' : 'today')
      : (trained ? 'trained' : (date > today ? 'future' : 'past'));
    return { date, status };
  });
}
