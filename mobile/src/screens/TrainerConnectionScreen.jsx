/**
 * TrainerConnectionScreen — la conexión con TU entrenador (lado cliente).
 *
 * El objetivo de esta pantalla es que cualquiera entienda tres cosas sin
 * preguntar: qué hace la conexión, en qué estado está, y qué pasa si toca cada
 * opción. Por eso cada acción lleva subtítulo con su consecuencia (el programa
 * se archiva, hará falta un código nuevo…) y hay un bloque explícito de qué
 * datos salen del móvil y cuáles no.
 *
 * Lo que se comparte está verificado contra `scopeFilterForUpload`
 * (`src/utils/clientLogs.js`): salen las sesiones de los programas del
 * entrenador y las sesiones libres posteriores a la conexión — nada más.
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Path, G, Circle } from 'react-native-svg';

import { useStore }               from '../../store/useStore';
import ClientCodeModal            from '../components/ClientCodeModal';
import ClientGoogleLinkModal      from '../components/ClientGoogleLinkModal';
import { Section, MenuRow, RowIcon } from '../components/ui/MenuList';
import { formatWhen } from '../utils/formatWhen';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

const ICON_TRAINER = <G><Circle cx="12" cy="8" r="3.2" /><Path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></G>;
const ICON_PROGRAM = <Path d="M4 7h16M4 12h16M4 17h10" />;
const ICON_UPLOAD  = <Path d="M12 19V5M6 11l6-6 6 6" />;
const ICON_GOOGLE  = <G><Circle cx="12" cy="12" r="9" /><Path d="M12 16v-4M12 8h.01" /></G>;
const ICON_KEY     = <G><Circle cx="8" cy="12" r="3.5" /><Path d="M11.5 12H21M17 12v3.5" /></G>;
const ICON_RETRY   = <G><Path d="M20.5 12a8.5 8.5 0 0 1-14 6.4" /><Path d="M3.5 12a8.5 8.5 0 0 1 14-6.4" /><Path d="M17 2.5v3.2h-3.2" /></G>;
const ICON_UNLINK  = <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;

export default function TrainerConnectionScreen() {
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const { t }      = useTranslation();
  const navigation = useNavigation();

  const clientSync            = useStore((s) => s.clientSync);
  const programs              = useStore((s) => s.programs);
  const profile               = useStore((s) => s.profile);
  const disconnectFromTrainer = useStore((s) => s.unlinkFromTrainer);
  const uploadHistory         = useStore((s) => s.uploadHistoryToTrainer);
  const showToast             = useStore((s) => s.showToast);

  const [showCodeModal,   setShowCodeModal]   = useState(false);
  const [googleAutoStart, setGoogleAutoStart] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [retrying,        setRetrying]        = useState(false);

  const lang          = profile.language ?? 'es';
  const isConnected   = !!clientSync.slotId;
  const hasError      = !!(clientSync.pendingUpload || clientSync.syncErrorAt);
  const activeProgram = profile.activeProgramId ? programs[profile.activeProgramId] : null;

  const when = (v) => formatWhen(v, lang, t('dayCard.today'), t('dayCard.yesterday'));

  // ── Estado, en una frase ────────────────────────────────────────────────────
  // El estado no dice solo "error": dice qué está pendiente y qué se puede
  // hacer, que es lo que la versión anterior no contaba.
  const state = !isConnected ? 'off' : hasError ? 'warn' : 'on';
  const stateTag   = t(`trainer.tag${state === 'on' ? 'Connected' : state === 'warn' ? 'Pending' : 'Off'}`);
  const stateTitle = !isConnected
    ? t('trainer.offTitle')
    : (clientSync.trainerName || t('trainer.unnamedTrainer'));
  const stateSub = !isConnected
    ? t('trainer.offSub')
    : hasError
      ? t('trainer.pendingSub')
      : t('trainer.connectedSub');

  async function handleRetry() {
    setRetrying(true);
    try {
      await uploadHistory();
      showToast(t('header.toastSynced'), 2200, 'success');
    } catch {
      showToast(t('header.toastSyncFailed'), 2200, 'error');
    } finally {
      setRetrying(false);
    }
  }

  function handleDisconnect() {
    Alert.alert(
      t('trainer.disconnectTitle'),
      t('trainer.disconnectBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trainer.disconnectConfirm'), style: 'destructive',
          onPress: async () => {
            await disconnectFromTrainer();
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('trainer.title')}</Text>
        <TouchableOpacity style={styles.iconBox} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Estado ── */}
        <View style={[styles.stateCard, !isConnected && styles.stateCardOff]}>
          <View style={styles.stateTagRow}>
            <View style={[styles.stateDot, {
              backgroundColor: state === 'on' ? th.colors.accent : state === 'warn' ? th.colors.orange : th.colors.muted,
            }]} />
            <Text style={[styles.stateTag, state === 'warn' && { color: th.colors.orange }]}>{stateTag}</Text>
          </View>
          <Text style={styles.stateTitle}>{stateTitle}</Text>
          <Text style={[styles.stateSub, !isConnected && styles.stateSubOff]}>{stateSub}</Text>
        </View>

        {isConnected ? (
          <>
            {/* ── Detalles ── */}
            <Section title={t('trainer.sectionDetails')}>
              <MenuRow
                icon={<RowIcon>{ICON_PROGRAM}</RowIcon>}
                label={t('trainer.rowProgram')}
                sub={activeProgram ? t('trainer.rowProgramSub') : t('trainer.rowProgramNoneSub')}
                value={activeProgram?.name ?? t('trainer.rowProgramNone')}
                minHeight={62}
              />
              <MenuRow
                icon={<RowIcon>{ICON_UPLOAD}</RowIcon>}
                label={t('trainer.rowLastUpload')}
                sub={clientSync.syncErrorAt && clientSync.pendingUpload
                  ? t('trainer.rowLastUploadFailed', { when: when(clientSync.syncErrorAt) })
                  : t('trainer.rowLastUploadSub')}
                value={when(clientSync.lastSyncedAt) ?? t('trainer.never')}
                minHeight={62}
              />
              <MenuRow
                icon={<RowIcon>{clientSync.googleLinked ? ICON_GOOGLE : ICON_KEY}</RowIcon>}
                label={clientSync.googleLinked ? t('trainer.rowAccessGoogle') : t('trainer.rowAccessCode')}
                sub={clientSync.googleLinked ? t('trainer.rowAccessGoogleSub') : t('trainer.rowAccessCodeSub')}
                subLines={0}
                minHeight={62}
              />
            </Section>

            {/* ── Qué ve el entrenador ── */}
            {/* Verificado contra scopeFilterForUpload: es lo que sale de verdad. */}
            <Section title={t('trainer.sectionPrivacy')}>
              <MenuRow
                label={t('trainer.sharedTitle')}
                sub={t('trainer.sharedBody')}
                subLines={0}
                minHeight={62}
              />
              <MenuRow
                label={t('trainer.notSharedTitle')}
                sub={t('trainer.notSharedBody')}
                subLines={0}
                minHeight={62}
              />
            </Section>

            {/* ── Acciones ── */}
            <Section title={t('trainer.sectionActions')}>
              {hasError && (
                <MenuRow
                  icon={<RowIcon color={th.colors.accent}>{ICON_RETRY}</RowIcon>}
                  label={retrying ? t('trainer.retryingLabel') : t('trainer.retryLabel')}
                  sub={t('trainer.retrySub')}
                  subLines={0}
                  minHeight={62}
                  disabled={retrying}
                  onPress={handleRetry}
                />
              )}
              {!clientSync.googleLinked && (
                <MenuRow
                  icon={<RowIcon>{ICON_GOOGLE}</RowIcon>}
                  label={t('trainer.linkGoogleLabel')}
                  sub={t('trainer.linkGoogleSub')}
                  subLines={0}
                  minHeight={62}
                  onPress={() => setShowGoogleModal(true)}
                />
              )}
              <MenuRow
                icon={<RowIcon>{ICON_TRAINER}</RowIcon>}
                label={t('trainer.changeLabel')}
                sub={t('trainer.changeSub')}
                subLines={0}
                minHeight={62}
                onPress={() => setShowCodeModal(true)}
              />
              <MenuRow
                icon={<RowIcon color={th.tint.red50}>{ICON_UNLINK}</RowIcon>}
                label={t('trainer.disconnectLabel')}
                labelColor={th.tint.red50}
                sub={t('trainer.disconnectSub')}
                subLines={0}
                minHeight={62}
                onPress={handleDisconnect}
              />
            </Section>
          </>
        ) : (
          <>
            {/* ── Sin conectar: explicar antes de pedir un código ── */}
            <Section title={t('trainer.sectionHow')}>
              <MenuRow
                icon={<RowIcon>{ICON_PROGRAM}</RowIcon>}
                label={t('trainer.how1Title')}
                sub={t('trainer.how1Sub')}
                subLines={0}
                minHeight={62}
              />
              <MenuRow
                icon={<RowIcon>{ICON_UPLOAD}</RowIcon>}
                label={t('trainer.how2Title')}
                sub={t('trainer.how2Sub')}
                subLines={0}
                minHeight={62}
              />
              <MenuRow
                icon={<RowIcon>{ICON_KEY}</RowIcon>}
                label={t('trainer.how3Title')}
                sub={t('trainer.how3Sub')}
                subLines={0}
                minHeight={62}
              />
            </Section>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setShowCodeModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('trainer.connectCta')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => { setGoogleAutoStart(true); setShowCodeModal(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>{t('trainer.googleCta')}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>{t('trainer.googleCtaHint')}</Text>
          </>
        )}
      </ScrollView>

      <ClientCodeModal
        visible={showCodeModal}
        startWithGoogle={googleAutoStart}
        onClose={() => { setShowCodeModal(false); setGoogleAutoStart(false); }}
        onSuccess={() => { setShowCodeModal(false); setGoogleAutoStart(false); }}
      />

      <ClientGoogleLinkModal
        visible={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerTitle: { ...textStyles.hero, color: th.colors.text, flexShrink: 1 },
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  closeGlyph: { fontSize: 17, color: th.colors.text },

  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Tarjeta de estado — mismo tratamiento que el "Resumen" de los editores:
  // relleno tint/accent-10 y SIN borde (§4.6). Sin conectar pierde el tinte
  // lima, que en este tema significa "esto va bien".
  stateCard: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginTop:       spacing.md,
    marginBottom:    spacing.xl,
    gap:             spacing.sm,
  },
  stateCardOff: { backgroundColor: th.colors.surface },
  stateSubOff:  { color: th.colors.mutedLight },
  stateTagRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stateDot:     { width: 7, height: 7, borderRadius: 3.5 },
  stateTag:     { ...textStyles.spacingTag, color: th.colors.mutedLight, textTransform: 'uppercase' },
  stateTitle:   { ...textStyles.cardTitle, color: th.colors.text },
  stateSub:     { ...textStyles.tag, color: th.tint.accent50, lineHeight: 15 },

  // Botones: primario accent h44 (mismo que "Guardar programa"), secundario
  // surface2 sin borde (variante Secondary de Figma).
  primaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.md,
  },
  primaryBtnText: { ...textStyles.btnAction, color: th.colors.onAccent },
  secondaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  secondaryBtnText: { ...textStyles.btnAction, color: th.colors.text },
  hint: {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    lineHeight: 15,
    textAlign:  'center',
    marginTop:  spacing.md,
  },
});
