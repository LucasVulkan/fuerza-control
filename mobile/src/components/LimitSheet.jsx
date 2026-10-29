/**
 * Hoja de límite (M04-02, docs/specs/M04-limites-y-fallos-de-pago.md §3): sale al
 * tocar algo que el plan gratis no deja, ANTES del paywall. Icono, contador,
 * título y texto en el centro; «Ahora no» y «Hazte PRO» abajo. Las cifras salen
 * de las mismas funciones que deciden el límite (`FREE`, `templateCounts`,
 * `isConnected`).
 *
 * «Hazte PRO» cierra la hoja con su animación y solo entonces pasa el motivo al
 * paywall (`onClose(true)`): dos Modal a la vez no se presentan en iOS.
 */
import { useContext, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import Marked from './ui/Marked';
import { RowIcon } from './ui/MenuList';
import { ROW_ICON } from './ui/rowIcons';
import { SheetContext } from './ui/sheetContext';
import DragSheet from './DragSheet';
import { useStore } from '../../store/useStore';
import { usePlanClients } from '../useFreeGates';
import { FREE, isConnected, templateCounts } from '../utils/freePlan';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// reason → grupo de textos e icono
const GROUP = { clients: 'clients', connected: 'connected', programTemplates: 'templates', sessionTemplates: 'templates', frozen: 'frozen' };
const ICON  = { clients: ROW_ICON.users, connected: ROW_ICON.phone, templates: ROW_ICON.templates, frozen: ROW_ICON.pause };

export default function LimitSheet({ reason, onClose }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { height } = useWindowDimensions();
  const clients          = usePlanClients();
  const programs         = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const clientId         = useStore((s) => s.ui.limitClientId);
  const toPro            = useRef(false);

  const group = GROUP[reason];
  const max   = group === 'connected' ? FREE.connected : group === 'templates' ? FREE[reason] : FREE.clients;
  const n = Math.min(max, group === 'connected' ? Object.values(clients).filter(isConnected).length
    : group === 'templates' ? templateCounts({ programs, sessionTemplates })[reason]
      : Object.keys(clients).length);
  const name = clientId ? clients[clientId]?.name : null;

  const say = group === 'frozen'
    ? t(name ? 'limit.say.frozen' : 'limit.say.frozenNoName', { name, max })
    : t(`limit.say.${reason}`, { count: max });

  return (
    <DragSheet
      visible
      tall
      onClose={() => onClose(toPro.current)}
      footer={<Buttons onPro={() => { toPro.current = true; }} sub={t(`limit.pro.${group}`)} />}
    >
      {/* Alto de la hoja menos el asa y los botones, para centrar el bloque en el hueco. */}
      <View style={[styles.mid, { minHeight: height * 0.85 - 190 }]}>
        <View style={styles.icon}><RowIcon size={40}>{ICON[group]}</RowIcon></View>
        <Text style={styles.pill}>{t(`limit.pill.${group}`, { n, max })}</Text>
        <Text style={styles.title}>{t(`limit.title.${group === 'frozen' ? 'clients' : group}`)}</Text>
        <Marked text={say} style={styles.say} accentStyle={{ ...textStyles.bodyStrong, color: th.colors.text }} />
      </View>
    </DragSheet>
  );
}

function Buttons({ onPro, sub }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sheet  = useContext(SheetContext);
  return (
    <View style={styles.btns}>
      <TouchableOpacity style={styles.later} onPress={() => sheet.dismiss()} activeOpacity={0.7}>
        <Text style={styles.laterText}>{t('limit.later')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cta} onPress={() => { onPro(); sheet.dismiss(); }} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.ctaTitle}>{t('limit.goPro')}</Text>
        <Text style={styles.ctaSub}>{sub}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  mid: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  icon: {
    width: 88, height: 88, borderRadius: th.radius.full, backgroundColor: th.tint.accent10,
    alignItems: 'center', justifyContent: 'center',
  },
  pill: {
    ...textStyles.statGlyph, textTransform: 'uppercase', color: th.colors.accent,
    marginTop: spacing.xxl - spacing.xs2, backgroundColor: th.tint.accent10, borderRadius: th.radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs2, overflow: 'hidden',
  },
  title: { ...textStyles.title, color: th.colors.text, textAlign: 'center', marginTop: spacing.md + spacing.xs },
  say:   { ...textStyles.body, lineHeight: 21, color: th.colors.mutedLight, textAlign: 'center', marginTop: spacing.sm2 },
  btns:  { gap: spacing.xs2 },
  later: { paddingVertical: spacing.lg, alignItems: 'center' },
  laterText: { ...textStyles.bodyStrong, color: th.colors.text },
  cta: { backgroundColor: th.colors.accent, borderRadius: th.radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  ctaTitle: { ...textStyles.button, color: th.colors.onAccent },
  ctaSub:   { ...textStyles.label, color: th.colors.onAccent, opacity: 0.7, marginTop: spacing.xs },
});
