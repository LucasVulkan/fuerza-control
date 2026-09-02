import { describe, test, expect } from 'vitest';
import { splitClientLogEntries, mergeClientLog, reidProgramFile } from './clientLogs';

describe('splitClientLogEntries', () => {
  const programs = {
    prog_a:  { id: 'prog_a',  owner: 'cli_1', days: [{ sessionTemplateId: 'tpl_a1' }, { sessionTemplateId: 'tpl_a2' }] },
    prog_b:  { id: 'prog_b',  owner: 'cli_2', stages: [{ days: [{ sessionTemplateId: 'tpl_b1' }] }] },
    prog_me: { id: 'prog_me', owner: 'me',    days: [{ sessionTemplateId: 'tpl_me' }] },
  };
  const workoutLog = [
    { id: 'e1', sessionTemplateId: 'tpl_a1', timestamp: 100 },
    { id: 'e2', sessionTemplateId: 'tpl_me', timestamp: 200 },   // trainer's own
    { id: 'e3', sessionTemplateId: 'tpl_b1', timestamp: 300 },
    { id: 'e4', sessionTemplateId: 'tpl_a2', timestamp: 50  },
    { id: 'e5', sessionTemplateId: '__free__', timestamp: 400 }, // personal free session
  ];

  test('routes each entry to its owning client; rest stays personal', () => {
    const { personalLog, clientEntries } = splitClientLogEntries(workoutLog, programs);
    expect(personalLog.map((e) => e.id)).toEqual(['e2', 'e5']);
    expect(clientEntries.cli_1.map((e) => e.id)).toEqual(['e1', 'e4']);
    expect(clientEntries.cli_2.map((e) => e.id)).toEqual(['e3']);
  });

  // Dos programas distintos que comparten plantillas (datos antiguos: hoy el
  // re-ID lo impide). La entrada va a los dos dueños, no a uno arbitrario.
  test('shared templates: the entry is copied to BOTH owning clients', () => {
    const shared = { ...programs, prog_c: { id: 'prog_c', owner: 'cli_3', days: [{ sessionTemplateId: 'tpl_a1' }, { sessionTemplateId: 'tpl_a2' }] } };
    const { clientEntries } = splitClientLogEntries(workoutLog, shared);
    expect(clientEntries.cli_1.map((e) => e.id)).toEqual(['e1', 'e4']);
    expect(clientEntries.cli_3.map((e) => e.id)).toEqual(['e1', 'e4']);
  });

  test('safe on empty / undefined input', () => {
    expect(splitClientLogEntries(undefined, undefined))
      .toEqual({ personalLog: [], clientEntries: {} });
  });
});

describe('mergeClientLog', () => {
  test('dedupes by id, drops entries without id, sorts by timestamp', () => {
    const existing = [{ id: 'e1', timestamp: 100 }, { id: 'e9', timestamp: 900 }];
    const incoming = [{ id: 'e1', timestamp: 100 }, { id: 'e2', timestamp: 200 }, { id: null, timestamp: 5 }];
    expect(mergeClientLog(existing, incoming).map((e) => e.id)).toEqual(['e1', 'e2', 'e9']);
  });

  test('returns the same array reference when nothing new (no needless re-render)', () => {
    const existing = [{ id: 'e1', timestamp: 100 }];
    expect(mergeClientLog(existing, [{ id: 'e1' }])).toBe(existing);
  });

  test('safe on undefined', () => {
    expect(mergeClientLog(undefined, undefined)).toEqual([]);
  });
});

describe('reidProgramFile', () => {
  const data = {
    program: {
      id: 'prog_orig', name: 'Fuerza 3d', clientId: 'cli_A', mode: 'managed',
      days: [{ sessionTemplateId: 'tpl_1', label: 'A' }, { sessionTemplateId: 'tpl_2', label: 'B' }],
      stages: [
        { name: 'Base', days: [{ sessionTemplateId: 'tpl_1', label: 'A' }, { sessionTemplateId: 'tpl_2', label: 'B' }] },
        { name: 'Pico', days: [{ sessionTemplateId: 'tpl_3', label: 'A' }] },
      ],
    },
    sessionTemplates: {
      tpl_1:     { id: 'tpl_1', programId: 'prog_orig', name: 'A', exercises: [{ exerciseId: 'squat' }] },
      tpl_2:     { id: 'tpl_2', programId: 'prog_orig', name: 'B', exercises: [] },
      tpl_3:     { id: 'tpl_3', programId: 'prog_orig', name: 'Pico', exercises: [] },
      tpl_other: { id: 'tpl_other', programId: 'prog_zzz', name: 'Ajena', exercises: [] },
    },
    userPrograms: {},
    workoutLog: [
      { id: 'e1', sessionTemplateId: 'tpl_1', timestamp: 100 },
      { id: 'e2', sessionTemplateId: 'tpl_3', timestamp: 200 },
      { id: 'e3', sessionTemplateId: '__free__', timestamp: 300 },
    ],
  };

  test('assigns a fresh program id', () => {
    const out = reidProgramFile(data);
    expect(out.program.id).not.toBe('prog_orig');
  });

  test('remaps template ids consistently across flat days and stages', () => {
    const out = reidProgramFile(data);
    const newTpl1 = out.program.days[0].sessionTemplateId;
    expect(newTpl1).not.toBe('tpl_1');
    // same template referenced from flat days and stage 1 must map to the same new id
    expect(out.program.stages[0].days[0].sessionTemplateId).toBe(newTpl1);
    // the remapped template exists and points at the new program
    expect(out.sessionTemplates[newTpl1].programId).toBe(out.program.id);
  });

  test('templates not referenced by this program are left untouched', () => {
    const out = reidProgramFile(data);
    expect(out.sessionTemplates.tpl_other).toBeDefined();
  });

  test('remaps history entries, leaving free sessions alone', () => {
    const out = reidProgramFile(data);
    const newTpl1 = out.program.days[0].sessionTemplateId;
    expect(out.workoutLog[0].sessionTemplateId).toBe(newTpl1);
    expect(out.workoutLog[2].sessionTemplateId).toBe('__free__');
  });

  test('does not mutate the original payload', () => {
    reidProgramFile(data);
    expect(data.program.id).toBe('prog_orig');
    expect(data.workoutLog[0].sessionTemplateId).toBe('tpl_1');
  });
});
