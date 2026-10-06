/**
 * «Con quién sigues» — M01 §4.6. Sale cuando el Pro caduca con más clientes de
 * los que caben en el plan gratis: el entrenador marca hasta 3, como mucho 1
 * con app, y el resto se congela. Mismo gesto y mismos estilos que la hoja de
 * asignar una sesión (`ProgramScreen` › `AssignSessionSheet`).
 *
 * Lo elige él y no la antigüedad: los clientes más viejos de un entrenador con
 * diez suelen ser los que ya no entrena.
 *
 * Lo elegido no se suelta (QA 6-oct-2026): si se pudiera desmarcar, se iría
 * rotando y al final llevaría a todos. La hoja vuelve solo si queda un hueco
 * —al borrar a uno de los elegidos— y entonces solo deja añadir.
 */

import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import DragSheet from './DragSheet';
import { FREE, fitsFree, isConnected, lockedClientIds } from '../utils/freePlan';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

export default function FreeClientsSheet({ onClose }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const clients         = useStore((s) => s.clients);
  const freeClientIds   = useStore((s) => s.profile.freeClientIds);
  const setFreeClientIds = useStore((s) => s.setFreeClientIds);
  const openPaywall     = useStore((s) => s._paywall);

  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );
  const locked = useMemo(() => lockedClientIds(clients, freeClientIds), [clients, freeClientIds]);
  const [picked, setPicked] = useState(() => new Set(locked));
  const pickedList = clientList.filter((c) => picked.has(c.id));
  const valid      = pickedList.length > locked.size && fitsFree(pickedList);
  const connectedPicked = pickedList.filter(isConnected).length;

  const toggle = (id) => setPicked((prev) => {
    if (locked.has(id)) return prev;
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  function confirm() {
    setFreeClientIds([...picked]);
    onClose();
  }

  return (
    <DragSheet visible onClose={onClose} title={t('freePlan.chooseTitle')} action={{ label: t('common.cancel'), onPress: onClose }}>
      <View style={styles.sheetBody}>
        <Text style={styles.sheetHint}>{t(locked.size > 0 ? 'freePlan.chooseMoreLead' : 'freePlan.chooseLead')}</Text>
        <Text style={[styles.counter, !valid && pickedList.length > 0 && { color: th.colors.orange }]}>
          {t('freePlan.chooseCount', {
            n: pickedList.length, max: FREE.clients, app: connectedPicked, maxApp: FREE.connected,
          })}
        </Text>
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          <View style={styles.clientList}>
            {clientList.map((c) => {
              const active = picked.has(c.id);
              const fixed  = locked.has(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.clientRow, active && styles.clientRowActive]}
                  onPress={() => toggle(c.id)}
                  disabled={fixed}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                    <Text style={[styles.clientName, active && { color: th.colors.accent }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.clientSub} numberOfLines={1}>
                      {t(isConnected(c) ? 'freePlan.withApp' : 'freePlan.withoutApp')}
                      {fixed ? ` · ${t('freePlan.alreadyChosen')}` : ''}
                    </Text>
                  </View>
                  {active && <Text style={styles.clientCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <TouchableOpacity
          style={[styles.cta, !valid && styles.ctaDisabled]}
          onPress={confirm}
          disabled={!valid}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, !valid && styles.ctaTextDisabled]}>{t('freePlan.chooseCta')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { onClose(); openPaywall('frozen'); }} activeOpacity={0.7}>
          <Text style={styles.link}>{t('freePlan.goPro')}</Text>
        </TouchableOpacity>
      </View>
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  sheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  sheetHint: { ...textStyles.body, color: th.colors.mutedLight, lineHeight: 17 },
  counter:   { ...textStyles.labelStrong, color: th.colors.text },
  clientList: { gap: spacing.sm },
  clientRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  clientRowActive: { backgroundColor: th.tint.accent10 },
  clientName:      { ...textStyles.labelStrong, color: th.colors.text },
  clientSub:       { ...textStyles.body, color: th.colors.mutedLight },
  clientCheck:     { ...textStyles.labelStrong, color: th.colors.accent },
  cta: {
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: spacing.xl,
  },
  ctaDisabled:     { backgroundColor: th.colors.surface2 },
  ctaText:         { ...textStyles.labelStrong, color: th.colors.onAccent },
  ctaTextDisabled: { color: th.colors.mutedLight },
  link:            { ...textStyles.labelStrong, color: th.tint.accent50, textAlign: 'center' },
});
