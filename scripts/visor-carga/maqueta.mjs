// Genera la maqueta de la pantalla Carga con los datos del visor.
//   node scripts/visor-carga/maqueta.mjs [visor-carga.json] [salida.html]
import { readFileSync, writeFileSync } from 'node:fs';

const aqui = (f) => new URL(f, import.meta.url);
const [, , entrada = aqui('./visor-carga.json'), salida = aqui('../../mobile/docs/mockups/carga-semanal.html')] = process.argv;
const datos = readFileSync(entrada, 'utf8');
const plantilla = readFileSync(aqui('./maqueta.template.html'), 'utf8');
writeFileSync(salida, plantilla.replace('__DATA__', datos));
