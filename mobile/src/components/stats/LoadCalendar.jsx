/**
 * LoadCalendar — el mes, con cada día teñido por su carga interna.
 *
 * Vivía en la cabecera del Historial, y ahí estaba en el sitio equivocado: lo
 * que pinta es `internalLoad`, la misma util que sostiene el resto de esta
 * pestaña. No dice «qué hice» —eso es la lista de sesiones— sino «cuánto me
 * machaqué», que es la pregunta de Carga (spec tab-programa.md §5.1).
 *
 * Al mudarse pierde el filtro por día: seleccionar un día servía para filtrar
 * la lista del historial, y aquí no hay lista que filtrar. Era además un gesto
 * que no se anunciaba (solo respondían los días entrenados) y que nadie
 * descubría.
 *
 * Y encoge. La celda baja de 30 a 24: en el Historial era la cabecera de la
 * pantalla y podía ocupar; aquí es un bloque más entre otros seis. El NÚMERO no
 * baja — subió de 10 a 12 en QA a propósito, para que el calendario dejara de
 * pedir que lo mires de cerca.
 */
import { useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, PixelRatio } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '../ui/Text';
import { useStore } from '../../../store/useStore';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { internalLoad } from '../../utils/trainingLoad';

// ── Constantes de la rejilla ──────────────────────────────────────────────────
const CELL_H  = 24;
const CELL_GAP = 3;

// ── Mapa de calor ──────────────────────────────────────────────────────────────
// Cuatro escalones, no un degradado continuo: en celdas de 30 px nadie
// distingue un 0,42 de un 0,55 de opacidad, y cuatro pasos sí se comparan de un
// vistazo.
//
// El techo es 0.5 a propósito: por encima de ahí el relleno se acerca demasiado
// al accent puro y el número del día dejaba de leerse, lo que obligaba a
// invertir su color a mitad de la escala. Con el tope bajo, `colors.text` se lee
// sobre los cuatro escalones en todos los temas (accent claro sobre fondo
// oscuro en FormaFit, accent oscuro sobre fondo claro en Space), así que el
// texto es siempre el mismo y solo cambia el fondo.
const HEAT_STEPS = [0.10, 0.21, 0.31, 0.42];

/** Escalón de un día según los cortes de cuartil del propio usuario. */
function heatLevel(load, cuts) {
  if (!(load > 0) || !cuts?.length) return 0;
  return Math.min(HEAT_STEPS.length - 1, cuts.filter((c) => load >= c).length);
}

/**
 * Carga interna por día del log completo, y los cortes de la escala.
 *
 * Los cortes son **cuartiles del propio usuario**, no fracciones de un máximo.
 * Con una escala lineal desde cero el escalón más flojo no se usaba nunca: una
 * sesión de entrenamiento jamás está cerca de cero, así que la mitad baja de la
 * paleta quedaba muerta (verificado con datos reales: 0/6/22/13 días por
 * escalón). Por cuartiles, el color ordena los días entre sí, que es justo la
 * pregunta — "¿cuáles fueron mis días duros?".
 *
 * Se calculan sobre TODO el historial, no sobre el mes visible: si no,
 * cambiarían al pasar de mes y un mes de descarga se pintaría tan intenso como
 * uno duro.
 *
 * `internalLoad` es puro por entrada (sRPE × minutos acotados), así que esto no
 * necesita ni la librería de ejercicios ni el peso corporal.
 */
function getLoadHeat(workoutLog) {
  const byDay = new Map();
  for (const entry of workoutLog ?? []) {
    const d = new Date(entry.timestamp);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const load = internalLoad(entry);
    const cur = byDay.get(key) ?? { load: null, sessions: 0 };
    if (load != null) cur.load = (cur.load ?? 0) + load;
    cur.sessions += 1;
    byDay.set(key, cur);
  }
  const values = [...byDay.values()].map((v) => v.load).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))];
  const cuts = values.length ? [q(0.25), q(0.5), q(0.75)] : [];
  return { byDay, cuts };
}

// Pure helper — computes grid weeks + trained-day map for any year/month
function getMonthData(y, m, heat) {
  const daysInM = new Date(y, m + 1, 0).getDate();
  let   startDow = new Date(y, m, 1).getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon-aligned
  const cells = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInM }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);
  const weeks = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  // day → { load: number|null, sessions }. `load: null` con sessions > 0 =
  // entrenó pero no contestó el sRPE: no hay carga que pintar.
  const trainedDays = {};
  for (let day = 1; day <= daysInM; day++) {
    const hit = heat.byDay.get(`${y}-${m}-${day}`);
    if (hit) trainedDays[day] = hit;
  }
  return { weeks, trainedDays };
}
// ── WorkoutCalendar ────────────────────────────────────────────────────────────

export default function LoadCalendar() {
  const { t }            = useTranslation();
  const cal              = useThemedStyles(makeCal);
  const th               = useTheme();
  const workoutLog       = useStore((s) => s.workoutLog);

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  // Ancho de celda medido, no `flex: 1`: con flex, Yoga reparte los píxeles
  // sobrantes de la fila entre unas columnas sí y otras no, y esas quedaban 1 px
  // más anchas — con el número descentrado respecto al resto del grid. Se
  // trunca al píxel físico para que 7 celdas + 6 huecos nunca desborden, y el
  // resto (< 1 px) se lo queda `space-between` en los huecos, donde no se ve.
  const [cellW, setCellW] = useState(0);
  function measureGrid(e) {
    const px = PixelRatio.get();
    setCellW(Math.floor(((e.nativeEvent.layout.width - CELL_GAP * 6) / 7) * px) / px);
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else               setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else               setMonth((m) => m + 1);
  }

  // La escala se calcula sobre TODO el log, no sobre el mes visible.
  const heat = useMemo(() => getLoadHeat(workoutLog), [workoutLog]);
  const { weeks, trainedDays } = useMemo(
    () => getMonthData(year, month, heat),
    [year, month, heat],
  );

  return (
    <View style={cal.wrap}>
      {/* Navigation */}
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={12} style={cal.navBtn}>
          <Text style={cal.navIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{`${(t('months', { returnObjects: true }))[month]} ${year}`}</Text>
        <TouchableOpacity
          onPress={nextMonth}
          hitSlop={12}
          style={[cal.navBtn, isCurrentMonth && cal.navBtnOff]}
          disabled={isCurrentMonth}
        >
          <Text style={[cal.navIcon, isCurrentMonth && cal.navIconOff]}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={cal.header}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <Text key={d} style={[cal.hDay, { width: cellW }]}>{d}</Text>
        ))}
      </View>

      {/* Grid — trim trailing empty rows */}
      <View style={cal.grid} onLayout={measureGrid}>
        {weeks.filter((week) => week.some((d) => d !== null)).map((week, wi) => (
          <View key={wi} style={cal.week}>
            {week.map((day, di) => {
              if (day === null) return <View key={di} style={[cal.cellBlank, { width: cellW }]} />;
              const hit     = trainedDays[day];
              const trained = !!hit;
              // Entrenó pero sin sRPE: no hay carga que pintar. Va en contorno,
              // NO en el tono más flojo — ese diría "sesión suave", cuando lo
              // que dice el dato es "no contestaste".
              const noRpe   = trained && hit.load == null;
              const level   = trained && !noRpe ? heatLevel(hit.load, heat.cuts) : -1;
              const isToday = isCurrentMonth && day === today.getDate();
              return (
                <View
                  key={di}
                  style={[
                    cal.cell,
                    { width: cellW },
                    level >= 0 && { backgroundColor: withOpacity(th.colors.accent, HEAT_STEPS[level]) },
                    noRpe   && cal.cellNoRpe,
                    isToday && !trained && cal.cellToday,
                  ]}
                >
                  <Text
                    style={[
                      cal.dayNum,
                      level >= 0 && cal.dayNumOnHeat,
                      noRpe   && cal.dayNumNoRpe,
                      isToday && !trained && cal.dayNumToday,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Leyenda — tres estados que no se deducen del color solo */}
      <View style={cal.legend}>
        <Text style={cal.legendLabel}>{t('history.heatLegend')}</Text>
        <View style={cal.legendScale}>
          {HEAT_STEPS.map((a) => (
            <View key={a} style={[cal.legendSwatch, { backgroundColor: withOpacity(th.colors.accent, a) }]} />
          ))}
        </View>
        <Text style={cal.legendLabel}>{t('history.heatMore')}</Text>
        <View style={cal.legendSpacer} />
        <View style={[cal.legendSwatch, cal.cellNoRpe]} />
        <Text style={cal.legendLabel}>{t('history.heatNoRpe')}</Text>
      </View>
    </View>
  );
}

const makeCal = (th) => StyleSheet.create({
  // La anatomía de tarjeta del resto de la pestaña, no la de cabecera de lista
  // que tenía en el Historial (con su filete inferior a sangre).
  wrap: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg,
    // Menos aire arriba que abajo: los chevrones de mes miden 28 de alto contra
    // una etiqueta de 12, así que la fila ya trae su propio hueco por dentro y
    // con el padding entero el nombre del mes se sentaba bajo.
    paddingTop:      spacing.sm2,
  },

  // Navigation row
  nav: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  navBtn:     { padding: 4 },
  navBtnOff:  { opacity: 0.25 },
  navIcon:    { ...textStyles.title, color: th.colors.muted, lineHeight: 28 },
  navIconOff: { color: th.colors.muted2 },
  monthLabel: { ...textStyles.labelStrong, color: th.colors.text },

  // Day-of-week header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  // Subida de brillo y peso: en muted2 a 9 px la fila de días se perdía y el
  // calendario quedaba sin sus ejes.
  hDay: {
    ...textStyles.caps,
    textAlign: 'center',
    color:     th.colors.mutedLight,
  },

  // Grid
  grid: { gap: CELL_GAP },
  week: { flexDirection: 'row', justifyContent: 'space-between' },

  cellBlank: { height: CELL_H },

  cell: {
    height:         CELL_H,
    borderRadius:   th.radius.xs + 1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cellNoRpe: { borderWidth: 1, borderColor: th.tint.accent50 },
  cellToday: { borderWidth: 1, borderColor: withOpacity(th.colors.accent, 0.55) },

  // La celda mide 24 y el número se queda en 12 (suelo de la escala): entra
  // holgado y el calendario no pide que lo mires de cerca.
  dayNum:       { ...textStyles.label, color: th.colors.muted2 },
  // Mismo color y mismo peso en los cuatro escalones: lo que ordena los días es
  // el fondo, no el número, y verlo cambiar de color a mitad de escala se leía
  // como otro estado más.
  dayNumOnHeat: { color: th.colors.text,   fontFamily: 'Inter_700Bold' },
  dayNumNoRpe:  { color: th.colors.accent, fontFamily: 'Inter_700Bold' },
  dayNumToday:  { color: th.colors.accent },

  // ── Leyenda del mapa de calor ──
  legend: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs2,
    marginTop:     spacing.sm,
  },
  legendLabel:  { ...textStyles.label, color: th.colors.muted },
  legendScale:  { flexDirection: 'row', gap: 2 },
  legendSwatch: { width: 12, height: 12, borderRadius: th.radius.xs - 1 },
  legendSpacer: { flex: 1 },
});
