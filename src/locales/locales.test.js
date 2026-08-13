/**
 * Los dos ficheros de traducción, vigilados.
 *
 * Se leen del disco y se parsean a mano en vez de importarlos: lo que se quiere
 * comprobar son los bytes que verá el bundler, no un módulo ya transformado.
 *
 * Existe porque en ago-2026 un `\n` se escribió como salto de línea real dentro
 * de una cadena y dejó `es.json` y `en.json` con JSON inválido. Nada lo detectó:
 * ningún test tocaba los locales, y el fallo solo aparece al arrancar la app.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IDIOMAS = ['es', 'en'];

const cargar = (lang) => {
  const ruta = fileURLToPath(new URL(`./${lang}.json`, import.meta.url));
  return JSON.parse(readFileSync(ruta, 'utf8'));
};

/** Todas las claves hoja, en notación con puntos. */
function claves(obj, prefijo = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    (v && typeof v === 'object' && !Array.isArray(v))
      ? claves(v, `${prefijo}${k}.`)
      : [`${prefijo}${k}`]);
}

/** Los `{{marcadores}}` de una cadena, ordenados y sin repetir. */
function marcadores(valor) {
  if (typeof valor !== 'string') return [];
  return [...new Set(valor.match(/\{\{\s*[\w.]+\s*\}\}/g) ?? [])]
    .map((m) => m.replace(/[{}\s]/g, ''))
    .sort();
}

const valorEn = (obj, ruta) => ruta.split('.').reduce((o, k) => o?.[k], obj);

describe('locales', () => {
  it.each(IDIOMAS)('%s.json es JSON válido', (lang) => {
    expect(() => cargar(lang)).not.toThrow();
  });

  it('es y en tienen exactamente las mismas claves', () => {
    const [es, en] = IDIOMAS.map(cargar);
    const enEs = new Set(claves(es));
    const enEn = new Set(claves(en));

    expect([...enEs].filter((k) => !enEn.has(k))).toEqual([]);   // sin traducir
    expect([...enEn].filter((k) => !enEs.has(k))).toEqual([]);   // huérfanas
  });

  it('cada cadena usa los mismos marcadores en los dos idiomas', () => {
    // Perder un {{name}} al traducir no rompe nada: simplemente desaparece del
    // texto y nadie se entera hasta que un usuario lee una frase a medias.
    const [es, en] = IDIOMAS.map(cargar);
    const desajustes = claves(es)
      .map((ruta) => ({ ruta, es: marcadores(valorEn(es, ruta)), en: marcadores(valorEn(en, ruta)) }))
      .filter(({ es: a, en: b }) => a.join() !== b.join());

    expect(desajustes).toEqual([]);
  });
});
