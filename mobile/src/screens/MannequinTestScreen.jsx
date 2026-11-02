/**
 * MannequinTestScreen — prueba del maniquí 3D en una WebView (X01-01).
 *
 * Carga el visor autocontenido que genera `formfit-mannequin/prototype/build.py`
 * (GLB + poses + three.js + runtime en un solo HTML, sin red) y lo enseña tal
 * cual, con su propia UI web. Solo sirve para ver si la experiencia aguanta en
 * el móvil; solo se entra desde la sección Desarrollador del menú (__DEV__).
 */
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';

import { useThemedStyles, useTheme } from '../useTheme';
import ScreenHeader from '../components/ui/ScreenHeader';
import VIEWER from '../../assets/mannequin/viewer.html';

export default function MannequinTestScreen() {
  const styles     = useThemedStyles(makeStyles);
  const th         = useTheme();
  const { t }      = useTranslation();
  const navigation = useNavigation();
  const [uri, setUri] = useState(null);

  // En Expo Go el asset llega de Metro; en la build está dentro del paquete.
  // downloadAsync lo deja en un file:// local en los dos casos.
  useEffect(() => {
    const asset = Asset.fromModule(VIEWER);
    asset.downloadAsync().then(() => setUri(asset.localUri ?? asset.uri));
  }, []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScreenHeader onBack={() => navigation.goBack()} eyebrow={t('header.sectionDeveloper')} title={t('mannequinTest.title')} />
      {uri ? (
        <WebView
          source={{ uri }}
          originWhitelist={['*']}
          allowFileAccess
          allowingReadAccessToURL={uri}
          style={styles.web}
        />
      ) : (
        <View style={styles.loading}><ActivityIndicator color={th.colors.accent} /></View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  web:       { flex: 1, backgroundColor: th.colors.bg },
  loading:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
