import { describe, it, expect } from 'vitest';
import { parseRich } from './richText';
import es from '../../locales/es.json';
import en from '../../locales/en.json';

const ICONS = ['handle', 'gear', 'paste', 'account', 'sort', 'send', 'mark'];

// Todas las marcas de los textos del recorrido están bien cerradas y los iconos existen,
// con su etiqueta para el lector de pantalla, en los dos idiomas.
function texts(tour, path = []) {
  return Object.entries(tour).flatMap(([k, v]) => (typeof v === 'string'
    ? (k === 'text' ? [[path.join('.'), v]] : [])
    : texts(v, [...path, k])));
}

describe.each([['es', es], ['en', en]])('textos del recorrido (%s)', (_lang, locale) => {
  it('sin etiquetas sueltas y con iconos conocidos', () => {
    for (const [path, text] of texts(locale.tour)) {
      for (const tok of parseRich(text)) {
        if (tok.kind === 'text') expect(tok.value, path).not.toMatch(/[<>]/);
        if (tok.kind === 'icon') {
          expect(ICONS, path).toContain(tok.name);
          expect(locale.tour.icons[tok.name], path).toBeTruthy();
        }
      }
    }
  });
});
