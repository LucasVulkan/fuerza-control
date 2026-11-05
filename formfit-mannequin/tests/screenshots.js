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
    ['deadlift_kb_45', 'deadlift', 0, 'three', {}, { impl: 'kettlebell' }], ['deadlift_2kb_45', 'deadlift', 0, 'three', {}, { impl: 'kettlebells' }],
    ['rdl_db_45', 'romanian_deadlift', 1, 'three', {}, { impl: 'mancuernas' }], ['rdl_db_front', 'romanian_deadlift', 0.4, 'front', {}, { impl: 'mancuernas' }],
    ['rdl_db_lado_side', 'romanian_deadlift', 0.5, 'side', {}, { impl: 'mancuernas_lado' }],
    ['pullup_bottom_side', 'pullup', 0, 'side', {}, {}], ['pullup_top_side', 'pullup', 1, 'side', {}, {}], ['pullup_top_front', 'pullup', 1, 'front', {}, {}],
    ['pullup_supine_45', 'pullup', 0.6, 'three', {}, { gripType: 'supino' }], ['pullup_neutral_45', 'pullup', 0.6, 'three', {}, { gripType: 'neutro' }],
    ['pullup_wide_front', 'pullup', 1, 'front', {}, { grip: 1.35 }],
    ['row_bottom_side', 'barbell_row', 0, 'side', {}, {}], ['row_top_side', 'barbell_row', 1, 'side', {}, {}], ['row_top_45', 'barbell_row', 1, 'three', {}, {}],
    ['row_upright_top_side', 'barbell_row', 1, 'side', {}, { trunk: -30 }], ['row_flat_top_side', 'barbell_row', 1, 'side', {}, { trunk: 25 }],
    ['row_chest_top_side', 'barbell_row', 1, 'side', {}, { dest: -15 }], ['row_supine_top_45', 'barbell_row', 1, 'three', {}, { gripType: 'supino' }],
    ['row_db_top_45', 'barbell_row', 1, 'three', {}, { impl: 'mancuernas' }], ['row_db_supine_top_45', 'barbell_row', 1, 'three', {}, { impl: 'mancuernas', gripType: 'supino' }],
    ['row_flat_chest_top_side', 'barbell_row', 1, 'side', {}, { trunk: 25, dest: -20 }], ['row_kb_wide_top_front', 'barbell_row', 1, 'front', {}, { impl: 'kettlebells', grip: 1.3 }],
    ['cable_start_side', 'cable_row', 0, 'side', {}, {}], ['cable_end_side', 'cable_row', 1, 'side', {}, {}], ['cable_mid_45', 'cable_row', 0.5, 'three', {}, {}],
    ['cable_high_start_side', 'cable_row', 0, 'side', {}, { pulleyH: 80 }], ['cable_still_start_side', 'cable_row', 0, 'side', {}, { swing: 0 }],
    ['cable_bar_end_45', 'cable_row', 1, 'three', {}, { impl: 'barra_recta' }], ['cable_rope_end_45', 'cable_row', 1, 'three', {}, { impl: 'cuerda' }],
    ['cable_knees_start_side', 'cable_row', 0, 'side', {}, { knees: 40 }],
    ['one_start_45', 'cable_row_one_arm', 0, 'three', {}, {}], ['one_end_45', 'cable_row_one_arm', 1, 'three', {}, {}], ['one_end_front', 'cable_row_one_arm', 1, 'front', {}, {}],
    ['one_high_start_45', 'cable_row_one_arm', 0, 'three', {}, { pulleyH: 60 }], ['one_knees_side', 'cable_row_one_arm', 0.5, 'side', {}, { knees: 40 }],
    ['one_straight_side', 'cable_row_one_arm', 0.5, 'side', {}, { knees: -20 }], ['cable_high_end_side', 'cable_row', 1, 'side', {}, { pulleyH: 60 }], ['cable_mid_side', 'cable_row', 0.5, 'side', {}, {}], ['cable_mid_wrist_blender_side', 'cable_row', 0.5, 'side', {}, { wrist: 'autorada' }]];
  for (const [name, ex, s, view, body, prm] of shots) {
    await page.evaluate(([ex, s, view, body, prm]) => { const S = __dbg.state; S.playing = false;
      document.querySelectorAll('#exSeg button')[Object.keys(__dbg.EXERCISES).filter(k => !__dbg.POSES.exercises[k]?.meta?.of).indexOf(ex)].click();   // las variantes no tienen botón
      Object.assign(S.body, { height: 180, femur: 100, tibia: 100, torso: 100, dorsi: 35 }, body); if (__dbg.EXERCISES[ex].base === 'hinge') Object.assign(S.per[ex], { knees: 0, depth: 0, plates: 0, feet: 0, impl: 'barra', load: 150 });
      if (__dbg.EXERCISES[ex].base === 'cable') Object.assign(S.per[ex], { impl: 'triangulo', gripType: 'prono', pulleyH: 0, trunk: 0, swing: 100, dest: 0, knees: 0, grip: 1, stance: 1, wrist: 'polea', bottom: 0, top: 100 });
      if (__dbg.EXERCISES[ex].base === 'row') Object.assign(S.per[ex], { impl: 'barra', gripType: 'prono', trunk: 0, dest: 0, grip: 1 });
      if (__dbg.EXERCISES[ex].base === 'hang') Object.assign(S.per[ex], { gripType: 'prono', grip: 1, top: 100, bottom: 0 });   // la captura anterior no se cuela
      Object.assign(S.per[ex], prm); S.s = s;
      document.querySelector(`[data-view=${view}]`).click(); }, [ex, s, view, body, prm]);
    await page.waitForTimeout(1600); await page.screenshot({ path: path.join(dir, name + '.png') }); console.log(name);
  }
  await close(); })();
