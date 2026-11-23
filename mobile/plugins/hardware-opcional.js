// Play marca como obligatorias funciones que solo vienen implícitas:
// screen.portrait (orientation: portrait) y wifi (permiso ACCESS_WIFI_STATE de NetInfo).
// Las declaramos opcionales para no excluir dispositivos.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURES = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

module.exports = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const list = (manifest['uses-feature'] ||= []);
    for (const name of FEATURES) {
      const found = list.find((f) => f.$['android:name'] === name);
      if (found) found.$['android:required'] = 'false';
      else list.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
