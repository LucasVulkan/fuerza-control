/**
 * Textos de la tarjeta de identidad del editor (P16-03) que comparten sesión,
 * ejercicio y bloque: dónde estás dentro del programa.
 */

/**
 * «Sesión A»; en una plantilla de sesión y en una sesión libre, la ceja que
 * llevaba la cabecera («Plantilla de sesión», «Sesión libre»).
 */
export function sessionTag(template, t) {
  if (template?.programId) return t('editor.idSession', { label: template.label ?? '' });
  return template?.kind === 'template' ? t('templates.sessionEyebrow') : t('freeSession.badge');
}
