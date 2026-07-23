import { describe, it, expect } from 'vitest';
import { getWeekStatuses } from './weekProgress';

// Thursday 2024-01-11 → week runs Mon 2024-01-08 .. Sun 2024-01-14.
const THURSDAY = new Date(2024, 0, 11, 15, 30).getTime();
const MONDAY   = new Date(2024, 0, 8).getTime();

describe('getWeekStatuses', () => {
  it('starts the week on Monday regardless of what day "now" is', () => {
    const days = getWeekStatuses([], THURSDAY);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe(MONDAY);
  });

  it('marks a day with no log entries as past/today/future correctly', () => {
    const days = getWeekStatuses([], THURSDAY);
    expect(days[0].status).toBe('past');   // Monday
    expect(days[3].status).toBe('today');  // Thursday, not trained
    expect(days[4].status).toBe('future'); // Friday
  });

  it('marks a day with any logged session (including free sessions) as trained', () => {
    const workoutLog = [
      { id: '1', sessionTemplateId: 'a', timestamp: new Date(2024, 0, 8, 9).getTime() },
      { id: '2', sessionTemplateId: '__free__', timestamp: THURSDAY },
    ];
    const days = getWeekStatuses(workoutLog, THURSDAY);
    expect(days[0].status).toBe('trained');      // Monday, logged
    expect(days[3].status).toBe('todayTrained'); // Thursday, logged today
  });
});
