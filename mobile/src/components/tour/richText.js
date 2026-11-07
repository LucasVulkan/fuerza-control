/**
 * El texto de un paso con marcas en línea (U17-01 §3.2). Las claves de los locales
 * llevan etiquetas muy simples; `RichText.jsx` las pinta y esto las lee:
 *
 *   <main>Guardar</main>   botón principal (lima)      <red>Sin entrenar</red>  estado en rojo
 *   <btn>Cancelar</btn>    botón secundario            <blue>…</blue>           estado en azul
 *   <b>Ritmo</b>           en negrita, para encabezar una sección
 *   <handle/>              icono: el nombre va en `RichText` (`ICONS`); también
 *                          dibujos de la pantalla, como <bar/> y <ticks/>
 *
 * El `\n` separa párrafos. Lógica pura, para poder probarla.
 */
const TAG = /<(main|btn|red|blue|b)>(.+?)<\/\1>|<(\w+)\/>/g;

/** @returns {Array<{kind:'text'|'main'|'btn'|'red'|'blue'|'b', value:string}|{kind:'icon', name:string}>} */
export function parseRich(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
    out.push(m[3] ? { kind: 'icon', name: m[3] } : { kind: m[1], value: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

/** El texto plano, para el lector de pantalla: el nombre del botón y el icono en palabras. */
export function plainText(text, iconLabel) {
  return text.split('\n').map((p) => parseRich(p)
    .map((tok) => (tok.kind === 'icon' ? iconLabel(tok.name) : tok.value))
    .join('')).join(' ');
}
