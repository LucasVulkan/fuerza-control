// Capturas para revisión visual: node tests/screenshots.js [carpeta] [regex del nombre]
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
    ['cable_high_start_side', 'cable_row', 0, 'side', {}, { pulleyH: 80 }], ['cable_still_start_side', 'cable_row', 0, 'side', {}, { trunk0: 10, trunk1: 10 }],
    ['cable_bar_end_45', 'cable_row', 1, 'three', {}, { impl: 'barra_recta' }], ['cable_bar_q_front', 'cable_row', 0.3, 'front', {}, { impl: 'barra_recta' }], ['cable_tri_q_front', 'cable_row', 0.3, 'front', {}, {}], ['cable_rope_end_45', 'cable_row', 1, 'three', {}, { impl: 'cuerda' }],
    ['cable_knees_start_side', 'cable_row', 0, 'side', {}, { knees: 40 }],
    ['one_start_45', 'cable_row_one_arm', 0, 'three', {}, {}], ['one_end_45', 'cable_row_one_arm', 1, 'three', {}, {}], ['one_end_front', 'cable_row_one_arm', 1, 'front', {}, {}],
    ['one_high_start_45', 'cable_row_one_arm', 0, 'three', {}, { pulleyH: 60 }], ['one_knees_side', 'cable_row_one_arm', 0.5, 'side', {}, { knees: 40 }],
    ['one_straight_side', 'cable_row_one_arm', 0.5, 'side', {}, { knees: -20 }], ['cable_high_end_side', 'cable_row', 1, 'side', {}, { pulleyH: 60 }], ['cable_mid_side', 'cable_row', 0.5, 'side', {}, {}], ['cable_mid_wrist_blender_side', 'cable_row', 0.5, 'side', {}, { wrist: 'autorada' }],
    ['lat_pulldown_start_side', 'lat_pulldown', 0, 'side', {}, {}], ['lat_pulldown_end_side', 'lat_pulldown', 1, 'side', {}, {}], ['lat_pulldown_mid_45', 'lat_pulldown', 0.5, 'three', {}, {}],
    ['lat_pulldown_curv_side', 'lat_pulldown', 1, 'side', {}, { curv: 15 }], ['lat_pulldown_supine_45', 'lat_pulldown', 0.5, 'three', {}, { gripType: 'supino' }],
    // X03-22 / X03-23: maneral por el cable, jalón por delante, agarre y juego escapular
    ['cable_still_035_side', 'cable_row', 0.35, 'side', {}, { trunk0: 10, trunk1: 10 }], ['cable_still_07_side', 'cable_row', 0.7, 'side', {}, { trunk0: 10, trunk1: 10 }],
    ['cable_swing_start_side', 'cable_row', 0, 'side', {}, { trunk0: 35, trunk1: -10 }], ['cable_swing_end_side', 'cable_row', 1, 'side', {}, { trunk0: 35, trunk1: -10 }],
    ['lat_pulldown_start_side_x22', 'lat_pulldown', 0, 'side', {}, {}], ['lat_pulldown_start_45', 'lat_pulldown', 0, 'three', {}, {}],
    ['lat_pulldown_pulleyF15_side', 'lat_pulldown', 0, 'side', {}, { pulleyF: 15 }], ['lat_pulldown_grip14_front', 'lat_pulldown', 0, 'front', {}, { grip: 1.4 }],
    ['lat_pulldown_scap0_start_side', 'lat_pulldown', 0, 'side', {}, { scap0: 0 }], ['cable_scap0_side', 'cable_row', 0, 'side', {}, { scap0: 0 }],
    // X03-02: acciones `libre` (la animación de Blender tal cual), inicio y final, de lado y a 45°
    ...['bulgarian_split_squat', 'bench_press', 'hip_thrust', 'push_up'].flatMap(ex => [[`libre_${ex}_start_side`, ex, 0, 'side', {}, {}], [`libre_${ex}_end_side`, ex, 1, 'side', {}, {}],
      [`libre_${ex}_start_45`, ex, 0, 'three', {}, {}], [`libre_${ex}_end_45`, ex, 1, 'three', {}, {}]]),
    // X03-07 · floor (flexiones): cada ajuste en sus dos extremos, arriba y abajo
    ...[['hands70', { hands: 70 }, 'front'], ['hands170', { hands: 170 }, 'front'], ['handPos25', { handPos: 25 }, 'side'], ['handPosM20', { handPos: -20 }, 'side'], ['rot45', { handRot: 45 }, 'three'], ['rotM45', { handRot: -45 }, 'three'],
      ['push6', { push: 6 }, 'side'], ['pushM5', { push: -5 }, 'side']].flatMap(([n, prm, v]) => [[`floor_${n}_start_${v}`, 'push_up', 0, v, {}, prm], [`floor_${n}_end_${v}`, 'push_up', 1, v, {}, prm]]),
    // X03-07 · bench (press de banca y hip thrust) y split (búlgara): cada ajuste en sus dos extremos, inicio y final
    ...[['grip70', { grip: 70 }, 'front'], ['grip160', { grip: 160 }, 'front'], ['touchM6', { touch: -6 }, 'side'], ['touch8', { touch: 8 }, 'side'], ['elbowsM30', { elbows: -30 }, 'three'], ['elbows30', { elbows: 30 }, 'three'],
      ['stance60', { stance: 60 }, 'front'], ['stance160', { stance: 160 }, 'front']].flatMap(([n, prm, v]) => [[`bench_press_${n}_start_${v}`, 'bench_press', 0, v, {}, prm], [`bench_press_${n}_end_${v}`, 'bench_press', 1, v, {}, prm]]),
    ...[['feetM15', { feet: -15 }, 'side'], ['feet25', { feet: 25 }, 'side'], ['benchHM10', { benchH: -10 }, 'side'], ['benchH10', { benchH: 10 }, 'side'], ['stance60', { stance: 60 }, 'front'], ['stance200', { stance: 200 }, 'front']]
      .flatMap(([n, prm, v]) => [[`hip_thrust_${n}_start_${v}`, 'hip_thrust', 0, v, {}, prm], [`hip_thrust_${n}_end_${v}`, 'hip_thrust', 1, v, {}, prm]]),
    ...[['strideM15', { stride: -15 }, 'side', {}], ['stride20', { stride: 20 }, 'side', {}], ['benchHM20', { benchH: -20 }, 'side', {}], ['benchH15', { benchH: 15 }, 'side', {}], ['trunkM10', { trunk: -10 }, 'side', {}], ['trunk25', { trunk: 25 }, 'side', {}],
      ['stance60', { stance: 60 }, 'front', {}], ['stance200', { stance: 200 }, 'front', {}], ['dorsi45', {}, 'side', { dorsi: 45 }], ['dorsi15', {}, 'side', { dorsi: 15 }]]
      .flatMap(([n, prm, v, body]) => [[`split_${n}_start_${v}`, 'bulgarian_split_squat', 0, v, body, prm], [`split_${n}_end_${v}`, 'bulgarian_split_squat', 1, v, body, prm]]),
    // X03-14 / X03-21: capas de fuerza (apoyos con su rozamiento) y cifras, de lado y a 45°
    ...['bulgarian_split_squat', 'bench_press', 'hip_thrust', 'push_up'].flatMap(ex => [[`libre_fuerzas_${ex}_start_side`, ex, 0, 'side', {}, {}, { lyNum: true }], [`libre_fuerzas_${ex}_end_side`, ex, 1, 'side', {}, {}, { lyNum: true }],
      [`libre_fuerzas_${ex}_end_45`, ex, 1, 'three', {}, {}, { lyNum: true }]]),
    // X03-26 · jalón sobre Blender: tres agarres de lado y de frente en 5 puntos y, en 0, 0,5 y 1, cada ajuste en sus extremos; remo en polea con tronco y escápulas quietos
    ...['prono', 'supino', 'neutro'].flatMap(g => ['side', 'front'].flatMap(v => [0, 0.25, 0.5, 0.75, 1].map(s => [`jalon_${g}_s${String(s * 100).padStart(3, '0')}_${v}`, 'lat_pulldown', s, v, {}, { gripType: g }]))),
    ...[['pulleyF8', { pulleyF: 8 }, 'side'], ['pulleyFM12', { pulleyF: -12 }, 'side'], ['grip70', { grip: 0.7 }, 'front'], ['grip140', { grip: 1.4 }, 'front'], ['trunkQuieto', { trunk0: -15, trunk1: -15 }, 'side'],
      ['trunk0_22_trunk1_M25', { trunk0: 22, trunk1: -25 }, 'side'], ['scap0', { scap0: 0, scap1: 0 }, 'side'], ['dest8', { dest: 8 }, 'side'], ['destM20', { dest: -20 }, 'side'], ['elbows45', { elbows0: 45, elbows1: 45 }, 'three']]
      .flatMap(([n, prm, v]) => [0, 0.5, 1].map(s => [`jalon_${n}_s${String(s * 100).padStart(3, '0')}_${v}`, 'lat_pulldown', s, v, {}, prm])),
    ...[0, 0.5, 1].flatMap(s => [[`polea_trunkQuieto_s${s * 100}`, 'cable_row', s, 'side', {}, { trunk0: 10, trunk1: 10 }], [`polea_scapQuietas_s${s * 100}`, 'cable_row', s, 'side', {}, { scap0: 0, scap1: 0 }]]),
  ];
  const only = process.argv[3] && new RegExp(process.argv[3]);   // node tests/screenshots.js carpeta regex: solo las capturas cuyo nombre case
  for (const [name, ex, s, view, body, prm, st] of shots.filter(x => !only || only.test(x[0]))) {
    await page.evaluate(([ex, s, view, body, prm, st]) => { const S = __dbg.state; S.playing = false; Object.assign(S, { lyRes: true, lySup: true, lyArm: true, lyBal: false, lyPath: false, lyNum: false }, st);
      document.querySelectorAll('#exSeg button')[Object.keys(__dbg.EXERCISES).filter(k => !__dbg.POSES.exercises[k]?.meta?.of).indexOf(ex)].click();   // las variantes no tienen botón
      Object.assign(S.body, { height: 180, femur: 100, tibia: 100, torso: 100, dorsi: 35 }, body); if (__dbg.EXERCISES[ex].base === 'hinge') Object.assign(S.per[ex], { knees: 0, depth: 0, plates: 0, feet: 0, impl: 'barra', load: 150 });
      if (__dbg.EXERCISES[ex].base === 'cable') Object.assign(S.per[ex], { impl: 'triangulo', gripType: 'prono', pulleyH: 0, dest: 0, knees: 0, grip: 1, stance: 1, wrist: 'polea', elbows: 0, bottom: 0, top: 100, curv: 0, pulleyF: 0 });
      if (__dbg.EXERCISES[ex].base === 'row') Object.assign(S.per[ex], { impl: 'barra', gripType: 'prono', trunk: 0, dest: 0, grip: 1 });
      if (__dbg.EXERCISES[ex].base === 'hang') Object.assign(S.per[ex], { gripType: 'prono', grip: 1, top: 100, bottom: 0 });   // la captura anterior no se cuela
      if (['floor', 'split', 'bench', 'cable'].includes(__dbg.EXERCISES[ex].base)) for (const p of __dbg.PSET(ex)) S.per[ex][p.id] = __dbg.pdef(ex, p);   // X03-07: valores por defecto antes de cada captura
      Object.assign(S.per[ex], prm); S.s = s;
      document.querySelector(`[data-view=${view}]`).click(); }, [ex, s, view, body, prm, st || {}]);
    await page.waitForTimeout(1600); await page.screenshot({ path: path.join(dir, name + '.png') }); console.log(name);
  }
  await close(); })();
