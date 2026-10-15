/**
 * TrainerRelogin — «Tu sesión de Google se ha cerrado» y el botón para volver a
 * entrar con la MISMA cuenta (C09 §3.6). Sale cuando `trainerLoginNeeded`:
 * dentro de la tarjeta de la cuenta en Mi cuenta, y encima de la lista en
 * Clientes, que es donde se nota (antes solo se enteraba al mandar algo).
 *
 * Solo el contenido: la tarjeta la pone quien lo usa. Con `title`, lleva el
 * título en mayúsculas (Clientes); sin él, va bajo el de la cuenta (Mi cuenta).
 */

import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import { useStore } from '../../store/useStore';
import useTrainerAccount from '../hooks/useTrainerAccount';
import AppleSignInButton from './ui/AppleSignInButton';
import GoogleSignInButton from './ui/GoogleSignInButton';
import { showDialog } from './ui/dialog';
import { spacing, textStyles, lh } from '../theme';
import { useThemedStyles } from '../useTheme';

export default function TrainerRelogin({ title = false }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const acct   = useTrainerAccount();
  const mode   = useStore((s) => s.trainerSync?.mode);
  const how    = t(`account.short.${mode === 'apple' ? 'apple' : 'google'}`);

  /** Solo entra: con un Google sin cuenta de entrenador avisa y no crea nada. */
  async function relogin() {
    try {
      await (mode === 'apple' ? acct.signInWithApple : acct.signInWithGoogle)({ mustExist: true });
    } catch (err) {
      if (err?.cancelled) return;
      showDialog(
        err?.notFound ? t('sync.notFoundTitle', { how: t(mode === 'apple' ? 'sync.howApple' : 'sync.howGoogle') }) : t('common.error'),
        err?.notFound ? undefined : err?.message,
      );
    }
  }

  return (
    <View>
      {title && <Text style={styles.title}>{t('account.reloginTitle')}</Text>}
      <Text style={styles.why}>{t('account.reloginWhy', { how })}</Text>
      <View style={styles.btn}>
        {mode === 'apple'
          ? <AppleSignInButton onPress={relogin} disabled={acct.loading} />
          : <GoogleSignInButton onPress={relogin} busy={acct.loading} disabled={acct.isExpoGo} />}
      </View>
    </View>
  );
}

// Los mismos que la tarjeta de Mi cuenta: título `caps`, explicación con barra.
const makeStyles = (th) => StyleSheet.create({
  title: { ...textStyles.caps, color: th.colors.orange, textTransform: 'uppercase' },
  why: {
    ...textStyles.body,
    lineHeight:      lh(textStyles.body.fontSize),
    color:           th.colors.mutedLight,
    borderLeftWidth: 2,
    borderLeftColor: th.colors.surface3,
    paddingLeft:     spacing.sm2,
    marginTop:       spacing.md,
  },
  btn: { marginTop: spacing.lg },
});
