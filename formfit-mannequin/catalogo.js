/* Catálogo del maniquí (spec X03 §2 y §6): lo que QUEREMOS que exista. Lo que ya existe y en qué estado lo dice Blender
   (assets/index.json, lo escribe el exportador). La página sale de juntar los dos:  npm run catalogo  ->  docs/catalogo.html

   movimiento (una página) -> ejercicios (cada uno, UNA acción de Blender) -> ejes -> valores (las variantes)
     accion   id de la acción en Blender, exista o no
     base     tipo de base que tendrá en el visor (stand, hinge, hang, row, cable, seat; bench, split, floor por hacer).
              Mientras sea `libre` en Blender, la página enseña las dos.
     mano     la mano de la biblioteca con que se posa ('' = cada mano distinta, posadas a mano). Si la acción ya existe,
              manda su ff_mano.
     fichas   ids de la ficha en la app (mobile/src/data/exerciseLibrary.js) que enseñan este ejercicio
     ejes     { eje: { valor: origen } }, origen:
                'base'          es la pose del propio ejercicio
                'script'        la sacará el visor de la pose del ejercicio (falta la lógica)
                'hecha'         la saca ya el visor
                'accion'        necesita su propia acción en Blender (aún sin nombre)
                'accion:<id>'   su acción en Blender
              y, opcional, '|<mano>' si esa variante cambia de mano ('hecha|cuerda').
   Los sliders (anchura, profundidad…) no son variantes y no van aquí. */

const CATALOGO = [
  { id: 'sentadilla', nombre: 'Sentadilla', ejercicios: [
    { accion: 'back_squat', nombre: 'Sentadilla trasera', base: 'stand', mano: 'barra_espalda',
      fichas: ['squat_barbell', 'pause_squat_barbell', 'box_squat_barbell', 'smith_squat'],
      ejes: { Implemento: { Barra: 'base', Multipower: 'script' }, Cajón: { 'Sin cajón': 'base', 'Con cajón': 'script' } } },
    { accion: 'front_squat', nombre: 'Sentadilla frontal', base: 'stand', mano: 'barra_espalda', fichas: ['front_squat_barbell'] },
    { accion: 'goblet_squat', nombre: 'Sentadilla goblet', base: 'stand', mano: 'goblet', fichas: ['goblet_squat'],
      ejes: { Implemento: { Kettlebell: 'base', Mancuerna: 'script' } } },
    { accion: 'zercher_squat', nombre: 'Sentadilla Zercher', base: 'stand', mano: '', fichas: ['zercher_squat_barbell'] },
    { accion: 'air_squat', nombre: 'Sentadilla sin peso', base: 'stand', mano: 'abierta', fichas: ['air_squat', 'jump_squat'],
      ejes: { Salto: { 'Sin salto': 'base', 'Con salto': 'accion' } } },
    { accion: 'leg_press', nombre: 'Prensa', base: 'seat', mano: '',
      fichas: ['leg_press_standard', 'leg_press_high', 'leg_press_wide', 'single_leg_press'],
      ejes: { Pies: { Normales: 'base', Altos: 'hecha', Anchos: 'hecha' }, Piernas: { Dos: 'base', Una: 'accion' } } },
    { accion: 'hack_squat', nombre: 'Sentadilla hack', base: 'seat', mano: '', fichas: ['hack_squat'] },
    { accion: 'pistol_squat', nombre: 'Sentadilla a una pierna', base: 'stand', mano: 'abierta', fichas: ['pistol_squat', 'pistol_squat_assisted', 'shrimp_squat'],
      ejes: { Asistencia: { Sin: 'base', 'Con apoyo': 'script' } } },
  ] },
  { id: 'zancada', nombre: 'Zancada y una pierna', ejercicios: [
    { accion: 'bulgarian_split_squat', nombre: 'Sentadilla búlgara', base: 'split', mano: '28',
      fichas: ['bulgarian_split_squat', 'split_squat_static'],
      ejes: { Implemento: { Mancuernas: 'base', Barra: 'script', 'Sin peso': 'script' }, 'Pie de atrás': { 'En el banco': 'base', 'En el suelo': 'accion' } } },
    { accion: 'reverse_lunge', nombre: 'Zancada atrás', base: 'split', mano: '28',
      fichas: ['reverse_lunge_db', 'walking_lunge', 'walking_lunge_barbell', 'jumping_lunge'],
      ejes: { Implemento: { Mancuernas: 'base', Barra: 'script', 'Sin peso': 'script' }, Paso: { Atrás: 'base', Andando: 'accion', 'Con salto': 'accion' } } },
    { accion: 'lateral_lunge', nombre: 'Zancada lateral', base: 'stand', mano: 'abierta', fichas: ['lateral_lunge', 'cossack_squat'] },
    { accion: 'step_up', nombre: 'Subida al cajón', base: 'split', mano: '28', fichas: ['step_up_db'] },
  ] },
  { id: 'bisagra', nombre: 'Peso muerto', ejercicios: [
    { accion: 'deadlift', nombre: 'Peso muerto convencional', base: 'hinge', mano: 'barra_pm', fichas: ['deadlift_conventional', 'trap_bar_deadlift'],
      ejes: { Implemento: { Barra: 'base', Kettlebell: 'hecha|40', 'Dos kettlebells': 'hecha|40', 'Barra hexagonal': 'script' } } },
    { accion: 'romanian_deadlift', nombre: 'Peso muerto rumano', base: 'hinge', mano: 'barra_pm', fichas: ['romanian_deadlift', 'romanian_deadlift_db'],
      ejes: { Implemento: { Barra: 'base', Mancuernas: 'hecha|28', 'Mancuernas a los lados': 'hecha|28', Kettlebells: 'hecha|40' } } },
    { accion: 'sumo_deadlift', nombre: 'Peso muerto sumo', base: 'hinge', mano: 'barra_pm', fichas: ['sumo_deadlift_barbell'] },
    { accion: 'good_morning', nombre: 'Buenos días', base: 'hinge', mano: 'barra_espalda', fichas: ['good_morning', 'good_morning_db'],
      ejes: { Implemento: { Barra: 'base', Mancuerna: 'script' } } },
    { accion: 'single_leg_rdl', nombre: 'Peso muerto a una pierna', base: 'hinge', mano: '28', fichas: ['single_leg_rdl_db'] },
    { accion: 'kettlebell_swing', nombre: 'Swing con kettlebell', base: 'hinge', mano: '40', fichas: ['kettlebell_swing', 'kettlebell_swing_american'] },
  ] },
  { id: 'puente', nombre: 'Puente de cadera', ejercicios: [
    { accion: 'hip_thrust', nombre: 'Hip thrust', base: 'bench', mano: 'barra_pm', fichas: ['hip_thrust', 'hip_thrust_db', 'single_leg_hip_thrust'],
      ejes: { Implemento: { Barra: 'base', Mancuerna: 'script', 'Sin peso': 'script' }, Piernas: { Dos: 'base', Una: 'accion' } } },
    { accion: 'glute_bridge', nombre: 'Puente de glúteo', base: 'floor', mano: 'abierta', fichas: ['glute_bridge', 'glute_bridge_barbell', 'glute_bridge_unilateral'],
      ejes: { Implemento: { 'Sin peso': 'base', Barra: 'script' }, Piernas: { Dos: 'base', Una: 'accion' } } },
  ] },
  { id: 'empuje_h', nombre: 'Press horizontal', ejercicios: [
    { accion: 'bench_press', nombre: 'Press de banca', base: 'bench', mano: 'barra_press',
      fichas: ['bench_press_barbell', 'bench_press_db', 'close_grip_bench_press', 'smith_bench_press', 'incline_bench_press_barbell', 'incline_press_db', 'decline_bench_press_barbell'],
      ejes: { Implemento: { Barra: 'base', Mancuernas: 'script|28', Multipower: 'script' }, Agarre: { Normal: 'base', Cerrado: 'script' },
              Banco: { Plano: 'base', Inclinado: 'accion', Declinado: 'accion' } } },
    { accion: 'push_up', nombre: 'Flexiones', base: 'floor', mano: 'palma_plana',
      fichas: ['push_up', 'knee_push_up', 'incline_push_up', 'decline_push_up', 'diamond_push_up', 'weighted_push_up'],
      ejes: { Apoyo: { Pies: 'base', Rodillas: 'script' }, Altura: { 'En el suelo': 'base', 'Manos elevadas': 'script', 'Pies elevados': 'script' },
              Manos: { Normales: 'base', 'Juntas (diamante)': 'script' }, Lastre: { Sin: 'base', 'Con lastre': 'script' } } },
    { accion: 'dip', nombre: 'Fondos en paralelas', base: 'hang', mano: 'barra_press', fichas: ['dip', 'dip_assisted'],
      ejes: { Asistencia: { Sin: 'base', 'Con goma': 'script' } } },
  ] },
  { id: 'empuje_v', nombre: 'Press vertical', ejercicios: [
    { accion: 'overhead_press', nombre: 'Press militar', base: 'stand', mano: 'barra_press', fichas: ['overhead_press_barbell', 'shoulder_press_db', 'smith_overhead_press'],
      ejes: { Implemento: { Barra: 'base', Mancuernas: 'script|28', Multipower: 'script' } } },
    { accion: 'push_press', nombre: 'Push press', base: 'stand', mano: 'barra_press', fichas: ['push_press_barbell', 'push_press_db'],
      ejes: { Implemento: { Barra: 'base', Mancuernas: 'script|28' } } },
    { accion: 'pike_push_up', nombre: 'Flexiones en pica', base: 'floor', mano: 'palma_plana', fichas: ['pike_push_up', 'pike_push_up_elevated'] },
  ] },
  { id: 'traccion_v', nombre: 'Tracción vertical', ejercicios: [
    { accion: 'pullup', nombre: 'Dominada', base: 'hang', mano: 'colgado_prono', fichas: ['pull_up', 'pull_up_supine', 'pull_up_negative', 'pull_up_assisted'],
      ejes: { Agarre: { Prono: 'base', Supino: 'accion:Chinup|colgado_supino', Neutro: 'hecha' }, Asistencia: { Sin: 'base', 'Con goma': 'script' } } },
    { accion: 'chest_to_bar_pull_up', nombre: 'Dominada al pecho', base: 'hang', mano: 'colgado_prono', fichas: ['chest_to_bar_pull_up'] },
    { accion: 'lat_pulldown', nombre: 'Jalón al pecho', base: 'cable', mano: 'colgado_prono', fichas: ['pulldown'],
      // la anchura de agarre será un ajuste (slider), no una variante
      ejes: { Agarre: { Prono: 'base', Supino: 'accion:lat_pulldown_supino|colgado_supino', Neutro: 'accion:lat_pulldown_neutro|colgado_neutro' } } },
    { accion: 'straight_arm_pulldown', nombre: 'Jalón con brazos rectos', base: 'cable', mano: 'barra_recta', fichas: ['straight_arm_pulldown'] },
  ] },
  { id: 'remo', nombre: 'Remo', ejercicios: [
    { accion: 'barbell_row', nombre: 'Remo con barra', base: 'row', mano: 'barra_pm', fichas: ['barbell_row'],
      ejes: { Agarre: { Prono: 'base', Supino: 'accion:barbell_row_supino' }, Implemento: { Barra: 'base', Mancuernas: 'hecha|28', Kettlebells: 'hecha|40' } } },
    { accion: 'cable_row', nombre: 'Remo en polea sentado', base: 'cable', mano: 'triangulo', fichas: ['cable_row', 'high_cable_row'],
      ejes: { Maneral: { Triángulo: 'base', 'Barra recta': 'hecha|barra_recta', Cuerda: 'hecha|cuerda' }, Polea: { Baja: 'base', Alta: 'accion' } } },
    { accion: 'cable_row_one_arm', nombre: 'Remo en polea a un brazo', base: 'cable', mano: '', fichas: ['single_arm_cable_row'] },
    { accion: 'db_row_unilateral', nombre: 'Remo con mancuerna a una mano', base: 'row', mano: '', fichas: ['db_row_unilateral'] },
    { accion: 'face_pull', nombre: 'Face pull', base: 'cable', mano: 'cuerda', fichas: ['face_pull'] },
    { accion: 'australian_row', nombre: 'Remo invertido', base: 'hang', mano: 'colgado_prono', fichas: ['australian_row', 'ring_row'] },
  ] },
  { id: 'core', nombre: 'Core', ejercicios: [
    { accion: 'plank', nombre: 'Plancha', base: 'floor', mano: 'palma_plana', fichas: ['plank', 'weighted_plank', 'plank_shoulder_tap'] },
    { accion: 'side_plank', nombre: 'Plancha lateral', base: 'floor', mano: '', fichas: ['side_plank', 'copenhagen_plank'] },
    { accion: 'hanging_knee_raise', nombre: 'Rodillas al pecho colgado', base: 'hang', mano: 'colgado_prono', fichas: ['hanging_knee_raise', 'hanging_leg_raise', 'toes_to_bar'],
      ejes: { Piernas: { 'Rodillas al pecho': 'base', Rectas: 'accion', 'Pies a la barra': 'accion' } } },
  ] },
];

// manos que el catálogo pide y aún no están en la biblioteca del .blend (nombre para la página)
const MANOS_NUEVAS = { colgado_neutro: 'Colgado, neutro', goblet: 'Goblet (copa)', barra_press: 'Barra de press', palma_plana: 'Palma plana (apoyo)' };

// fichas de la app sin maniquí a propósito: cíclicas o de desplazamiento (spec X03 §13)
const FUERA = ['ski_erg', 'row_erg', 'air_bike', 'run', 'jump_rope', 'double_under', 'jumping_jack', 'high_knees', 'battle_rope_wave',
  'sled_push', 'sled_drag', 'bear_crawl', 'mountain_climber', 'farmer_walk_db', 'suitcase_carry'];

module.exports = { CATALOGO, MANOS_NUEVAS, FUERA };
