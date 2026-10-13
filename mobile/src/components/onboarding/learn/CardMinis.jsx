/**
 * Las mini-pantallas esquemáticas de las tarjetas de «Aprende» (O03 §11.1):
 * plantillas / «Cambia lo que quieras», la próxima sesión de un cliente, apuntar
 * sus sesiones y «tu entrenador ve tus entrenos». Son esquemas: lo que va a vivir
 * en la app de verdad (la vista de Inicio, la fila de Clientes) se dibuja con
 * `HomeViewPreview` y `ClientRow`, no aquí.
 *
 * Cada una lleva su elemento resaltado (`Spot`): lima si es del usuario, azul si
 * es del entrenador. Los textos de cada esquema, bajo `onboardingFlow.learn.mini`.
 */
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '../../ui/Text';
import { spacing, textStyles, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { useWeightUnit } from '../../../hooks/useWeightUnit';
import Spot from './Spot';

/** El lienzo: el fondo de la app, con sus filas en `surface`. Solo se mira, salvo `interactive`. */
export function Mini({ children, interactive = false }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.mini} pointerEvents={interactive ? 'auto' : 'none'}>{children}</View>;
}

/**
 * Una fila del esquema. `lead` (la letra), `title`, `sub`, `trail` (texto a la
 * derecha o un nodo), `tone: 'blue'` para lo que es del entrenador, `center` para
 * una acción de una sola línea (`muted`: la secundaria).
 */
function MiniRow({ lead, title, sub, trail, tone, center, muted, spot, finger, grow = true }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const row = (
    <View style={[styles.row, tone === 'blue' && styles.rowBlue, center && styles.rowCenter]}>
      {!!lead && <View style={styles.lead}><Text style={styles.leadTxt}>{lead}</Text></View>}
      <View style={grow ? styles.rowMain : undefined}>
        <Text style={[styles.title, tone === 'blue' && styles.titleBlue, center && { color: muted ? th.colors.mutedLight : tone === 'blue' ? th.colors.blue : th.colors.accent }]} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
      </View>
      {typeof trail === 'string'
        ? <Text style={[styles.trail, tone === 'blue' && styles.titleBlue]}>{trail}</Text>
        : trail}
    </View>
  );
  if (!spot) return row;
  return <Spot tone={tone === 'blue' ? 'blue' : 'accent'} radius={th.radius.md} finger={finger}>{row}</Spot>;
}

/**
 * Plantillas (`edit` falso: dos plantillas guardadas) o «Cambia lo que quieras»
 * (`edit` verdadero: dos sesiones del programa con sus ejercicios).
 */
export function MiniTemplates({ edit, sessions, templateName }) {
  const { t } = useTranslation();
  const rows = edit
    ? [
        { lead: sessions[0].marker, title: sessions[0].name, sub: t('onboardingFlow.learn.mini.exercise1') },
        { lead: sessions[1].marker, title: sessions[1].name, sub: t('onboardingFlow.learn.mini.exercise2') },
      ]
    : [
        { lead: templateName.slice(0, 2).toUpperCase(), title: templateName, sub: t('onboardingFlow.learn.mini.clientsCount', { count: 1 }) },
        { lead: 'UL', title: 'Upper / Lower', sub: t('onboardingFlow.learn.mini.notAssigned') },
      ];
  return (
    <Mini>
      {rows.map((r, i) => (
        <MiniRow key={r.title} {...r} trail="›" spot={i === 0} finger={{ right: 14, bottom: -8 }} />
      ))}
    </Mini>
  );
}

/** La próxima sesión de un cliente: se retoca un peso sin tocar el programa. */
export function MiniNext({ clientName }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { label } = useWeightUnit();
  return (
    <Mini>
      <Text style={styles.head} numberOfLines={1}>{t('onboardingFlow.learn.mini.nextHead', { name: clientName })}</Text>
      <MiniRow
        title={t('onboardingFlow.learn.mini.squat')}
        sub={t('onboardingFlow.learn.mini.squatSub', { unit: label })}
        trail={<Spot radius={6} finger={{ right: 6, bottom: -12 }}><View style={styles.chip}><Text style={styles.chipTxt}>→ 95</Text></View></Spot>}
      />
      <MiniRow title={t('onboardingFlow.learn.mini.rdl')} sub="3×10" />
    </Mini>
  );
}

/** Apuntar las sesiones de un cliente que no usa la app. */
export function MiniLogFor({ clientName, session }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <Mini>
      <Text style={styles.head} numberOfLines={1}>{t('onboardingFlow.learn.mini.logHead', { name: clientName })}</Text>
      <MiniRow lead={session.marker} title={session.name} sub={t('onboardingFlow.learn.mini.logWhen')} />
      <MiniRow center title={t('onboardingFlow.learn.mini.logAdd')} spot finger={{ right: '42%', bottom: -10 }} />
      <MiniRow center muted title={t('onboardingFlow.learn.mini.logPaste')} grow={false} />
    </Mini>
  );
}

/** «Tu entrenador ve tus entrenos»: su aviso de programa cambiado (azul) y una sesión hecha. */
export function MiniCoach({ trainer, trainerLc, session }) {
  const { t } = useTranslation();
  const th = useTheme();
  return (
    <Mini>
      <MiniRow
        tone="blue"
        title={t('onboardingFlow.learn.mini.coachChanged', { trainer })}
        sub={t('onboardingFlow.learn.mini.coachChange')}
        trail={`${t('home.view')} ›`}
        spot
        finger={{ right: 12, bottom: -10 }}
      />
      <MiniRow
        lead={session.marker}
        title={session.name}
        sub={t('onboardingFlow.learn.mini.coachSession', { count: session.exercises, trainer: trainerLc })}
        trail={<Text style={[textStyles.bodyStrong, { color: th.colors.accent }]}>✓</Text>}
      />
    </Mini>
  );
}

const makeStyles = (th) => StyleSheet.create({
  mini: {
    backgroundColor: th.colors.bg,
    borderRadius:    th.radius.lg,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  head: { ...textStyles.bodyStrong, color: th.colors.text, padding: spacing.xs },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm2,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
  },
  rowBlue:   { backgroundColor: withOpacity(th.colors.blue, 0.16) },
  rowCenter: { justifyContent: 'center' },
  rowMain:   { flex: 1, minWidth: 0 },
  lead: {
    width:           32,
    height:          32,
    borderRadius:    th.radius.sm + 1,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  leadTxt:   { ...textStyles.bodyStrong, color: th.colors.accent, includeFontPadding: false },
  title:     { ...textStyles.bodyStrong, color: th.colors.text },
  titleBlue: { color: th.colors.blue },
  sub:       { ...textStyles.label, color: th.colors.mutedLight },
  trail:     { ...textStyles.bodyStrong, color: th.colors.accent },
  chip: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingVertical:   spacing.xs2,
    paddingHorizontal: spacing.sm2,
  },
  chipTxt: { ...textStyles.labelStrong, color: th.colors.text },
});
