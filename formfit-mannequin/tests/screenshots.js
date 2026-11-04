// Capturas para revisión visual: node tests/screenshots.js [carpeta]
const { open, ROOT } = require('./harness'); const path = require('path'), fs = require('fs');
(async () => { const dir = process.argv[2] || path.join(ROOT, 'tests', 'shots'); fs.mkdirSync(dir, { recursive: true });
  const { page, close } = await open();
  const shots = [
    ['back_squat_end_45', 'back_squat', 1, 'three', {}, {}], ['back_squat_end_side', 'back_squat', 1, 'side', {}, {}],
    ['back_squat_quarter_side', 'back_squat', 0.25, 'side', {}, {}], ['back_squat_mid_side', 'back_squat', 0.5, 'side', {}, {}],
    ['front_squat_end_side', 'front_squat', 1, 'side', {}, {}], ['front_squat_stiff_ankle', 'front_squat', 1, 'side', { dorsi: 20 }, {}],
    ['leg_press_start', 'leg_press', 0, 'side', {}, {}], ['leg_press_end', 'leg_press', 1, 'side', {}, {}],
    ['deadlift_start_side', 'deadlift', 0, 'side', {}, {}], ['deadlift_start_45', 'deadlift', 0, 'three', {}, {}],
    ['deadlift_mid_side', 'deadlift', 0.5, 'side', {}, {}], ['deadlift_end_side', 'deadlift', 1, 'side', {}, {}],
    ['deadlift_start_femur', 'deadlift', 0, 'side', { femur: 112, tibia: 98, torso: 95 }, {}],
    ['deadlift_deficit', 'deadlift', 0, 'three', {}, { feet: 8, plates: 0 }], ['deadlift_blocks', 'deadlift', 0, 'three', {}, { feet: 0, plates: 12 }],
    ['rdl_top_side', 'romanian_deadlift', 0, 'side', {}, {}], ['rdl_bottom_side', 'romanian_deadlift', 1, 'side', {}, {}],
    ['rdl_bottom_45', 'romanian_deadlift', 1, 'three', {}, {}], ['rdl_mid_side', 'romanian_deadlift', 0.5, 'side', {}, {}],
    ['rdl_shallow_side', 'romanian_deadlift', 1, 'side', {}, { depth: 15 }], ['deadlift_deficit_side', 'deadlift', 0, 'side', {}, { feet: 8 }],
    ['rdl_as_conventional', 'romanian_deadlift', 1, 'side', {}, { knees: 8, depth: -40 }],
    ['rdl_deficit_side', 'romanian_deadlift', 1, 'side', {}, { knees: 0, depth: -10, feet: 10 }],
    ['deadlift_stiff_side', 'deadlift', 0, 'side', {}, { knees: -30 }],
    ['rdl_stiff_mid_side', 'romanian_deadlift', 0.6, 'side', {}, { knees: -40 }], ['deadlift_k20_d20_side', 'deadlift', 0, 'side', {}, { knees: -20, depth: 20 }],
    ['deadlift_noload_side', 'deadlift', 0, 'side', {}, { load: 0 }],
    ['deadlift_db_45', 'deadlift', 0, 'three', {}, { impl: 'mancuernas' }], ['deadlift_db_lado_side', 'deadlift', 0.5, 'side', {}, { impl: 'mancuernas_lado' }],
    ['deadlift_kb_45', 'deadlift', 0, 'three', {}, { impl: 'kettlebell' }], ['rdl_db_45', 'romanian_deadlift', 1, 'three', {}, { impl: 'mancuernas' }]];
  for (const [name, ex, s, view, body, prm] of shots) {
    await page.evaluate(([ex, s, view, body, prm]) => { const S = __dbg.state; S.playing = false;
      document.querySelectorAll('#exSeg button')[Object.keys(__dbg.EXERCISES).indexOf(ex)].click();
      Object.assign(S.body, { height: 180, femur: 100, tibia: 100, torso: 100, dorsi: 35 }, body); if (__dbg.EXERCISES[ex].base === 'hinge') Object.assign(S.per[ex], { knees: 0, depth: 0, plates: 0, feet: 0, impl: 'barra', load: 150 });   // la captura anterior no se cuela
      Object.assign(S.per[ex], prm); S.s = s;
      document.querySelector(`[data-view=${view}]`).click(); }, [ex, s, view, body, prm]);
    await page.waitForTimeout(1600); await page.screenshot({ path: path.join(dir, name + '.png') }); console.log(name);
  }
  await close(); })();
