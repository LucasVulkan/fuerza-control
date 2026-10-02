import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseImportFile } from './importFile';
import { showDialog } from '../components/ui/dialog';

/**
 * Elegir y leer un archivo de la app (.fitdata). Devuelve `{ fileName, data }`,
 * o null si se cancela o falla (el error ya está avisado).
 */
export async function pickImportFile(t) {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return null;
    const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = parseImportFile(raw);
    if (!parsed.ok) { showDialog(t('errors.invalidFile'), t(parsed.errorKey, parsed.errorParams)); return null; }
    return { fileName: result.assets[0].name, data: parsed.data };
  } catch (err) {
    if (!err?.message?.includes('cancel')) {
      showDialog(t('common.error'), err?.message ?? t('errors.cannotReadFile'));
    }
    return null;
  }
}
