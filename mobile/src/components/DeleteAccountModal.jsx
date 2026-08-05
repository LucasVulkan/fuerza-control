/**
 * DeleteAccountModal — borrar la cuenta desde dentro de la app.
 *
 * Requisito de la App Store 5.1.1(v). Va en la sección CUENTA del menú y no
 * dentro de Sincronización, que es donde se crea: esa fila solo la ven los Pro
 * y se abre desde Clientes, así que un cliente no la vería nunca.
 *
 * Lo importante aquí es el texto, no la mecánica: la persona tiene que salir
 * sabiendo qué pierde y qué no ANTES de pulsar. Por eso las consecuencias se
 * listan según lo que sea (entrenador, cliente, o las dos cosas) en vez de un
 * párrafo genérico.
 *
 * Dos cosas que la gente da por hechas y son falsas, y por eso están escritas:
 *  - El Pro NO se pierde. Va con la cuenta de Apple/Google Play, no con esta.
 *  - Los datos de este móvil NO se borran. La app funciona entera sin cuenta.
 *
 * Pasa a `DragSheet` como el resto de los modales (§9 de docs/UI-MIGRATION.md).
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import DragSheet from './DragSheet';
import { SectionLabel } from './ui/MenuList';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

export default function DeleteAccountModal({ visible, onClose }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const deleteAccount    = useStore((s) => s.deleteAccount);
  const hasRemoteAccount = useStore((s) => s.hasRemoteAccount);
  const trainerSync      = useStore((s) => s.trainerSync);
  const clientSync       = useStore((s) => s.clientSync);
  const showToast        = useStore((s) => s.showToast);

  const [loading, setLoading] = useState(false);

  const hasAccount = hasRemoteAccount();
  // Una misma persona puede ser las dos cosas, así que no son excluyentes.
  const asTrainer  = !!trainerSync.mode && trainerSync.mode !== 'offline';
  const asClient   = !!clientSync.slotId;

  function handleDelete() {
    Alert.alert(
      t('deleteAccount.confirmTitle'),
      t('deleteAccount.confirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('deleteAccount.confirmCta'), style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteAccount();
              showToast(t('deleteAccount.toastDone'), 2600, 'neutral');
              onClose();
            } catch (err) {
              Alert.alert(t('deleteAccount.errTitle'), err?.message ?? t('deleteAccount.errBody'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }

  return (
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={t('deleteAccount.title')}
      action={{ label: t('common.cancel'), onPress: onClose }}
    >
      <View style={styles.block}>
        {!hasAccount ? (
          // Sin cuenta en el servidor no hay nada que borrar, y ofrecer un
          // botón que no haría nada es peor que decirlo.
          <Text style={styles.lead}>{t('deleteAccount.noAccount')}</Text>
        ) : (
          <>
            <Text style={styles.lead}>{t('deleteAccount.lead')}</Text>

            <View>
              <SectionLabel>{t('deleteAccount.whatHappens')}</SectionLabel>
              <View style={styles.bullets}>
                {asTrainer && <Bullet styles={styles} text={t('deleteAccount.implTrainer')} />}
                {asClient  && <Bullet styles={styles} text={t('deleteAccount.implClient')} />}
                <Bullet styles={styles} text={t('deleteAccount.implIrreversible')} />
              </View>
            </View>

            <View>
              <SectionLabel>{t('deleteAccount.whatStays')}</SectionLabel>
              <View style={styles.bullets}>
                <Bullet styles={styles} text={t('deleteAccount.staysLocal')} />
                <Bullet styles={styles} text={t('deleteAccount.staysPro')} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.dangerBtn, loading && styles.btnDisabled]}
              onPress={handleDelete}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={th.colors.text} />
                : <Text style={styles.dangerBtnText}>{t('deleteAccount.cta')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </DragSheet>
  );
}

function Bullet({ styles, text }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>·</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: { gap: spacing.lg, paddingBottom: spacing.md },
  lead:  { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 18 },

  bullets:    { gap: spacing.sm },
  bulletRow:  { flexDirection: 'row', gap: spacing.sm },
  bulletDot:  { ...textStyles.tag, color: th.tint.red50, lineHeight: 15 },
  bulletText: { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15, flex: 1 },

  // Rojo de relleno, no de contorno: es la única acción de la app que no se
  // puede deshacer, y tiene que pesar más que "Eliminar todas las copias".
  dangerBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.tint.red50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  dangerBtnText: { ...textStyles.btnAction, color: th.colors.text },
  btnDisabled:   { opacity: 0.5 },
});
