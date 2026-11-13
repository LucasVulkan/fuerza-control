// Panel de afinado del editor (X03-28): Playwright con `?editor`. Una parte cada vez, la lista de cambios, el contexto que sale de los ajustes del entrenador y los campos de rango.
const { open } = require('./harness');
(async () => { const { page, close } = await open({ width: 1100, height: 1500 }, '?editor'); const fallos = [];
  const ok = (c, txt) => { console.log(`${c ? 'ok   ' : 'FALLO'} ${txt}`); if (!c) fallos.push(txt); };
  const setR = (id, v) => page.evaluate(([id, v]) => { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event('input')); }, [id, v]);
  const seg = t => page.locator('#afBody .seg button', { hasText: new RegExp('^' + t) }).first();
  const strip = () => page.locator('.afstrip span').first().textContent();
  const nLista = () => page.locator('.aflist > div:not(.c)').count();
  const dotsIn = async t => (await seg(t).locator('.afdot').count()) > 0;
  await page.evaluate(() => { __dbg.state.playing = false; document.querySelector('[data-ex=lat_pulldown]').click(); }); await page.waitForTimeout(300);

  ok(!(await page.locator('#afinado').isHidden()) && /default/.test(await strip()), `el panel sale en el jalón, con la franja: «${await strip()}»`);
  const top = await page.evaluate(() => { const a = document.getElementById('afinado').getBoundingClientRect().top, b = document.getElementById('exFields').getBoundingClientRect().top; return a < b; });
  ok(top, 'el panel de afinado va antes de «Ajustes del ejercicio»');
  // elegir «Codo» enseña solo «Giro»
  await seg('Codo').click();
  const labs = await page.locator('#afBody .field label').allTextContents();
  ok(labs.length === 1 && labs[0] === 'Giro', `Codo: solo «${labs.join(', ')}»`);
  // con «Final» elegido, mover el deslizador deja una línea y un punto en «Codo» y en «Final»
  await seg('Final').click(); await setR('af-codos', 20);
  ok(await nLista() === 1 && /Codo · Giro · final/.test(await page.locator('.aflist').textContent()), `una línea en «Lo que has cambiado»: ${(await page.locator('.aflist').textContent()).trim()}`);
  ok(await dotsIn('Codo') && await dotsIn('Final') && !(await dotsIn('Inicio')) && !(await dotsIn('Mano')), 'puntos en «Codo» y en «Final», y en ningún otro');
  ok(/Final/.test(await strip()) && (await page.evaluate(() => Math.abs(__dbg.state.s - 1) < 1e-9)), 'la franja dice «Final» y la repetición salta al final');
  ok(await page.locator('.afstate.dirty').count() > 0, 'aparece «sin guardar»');
  // la × de la línea la quita
  await page.locator('.aflist > div button').first().click();
  ok(await nLista() === 0 && !(await dotsIn('Codo')), 'la × de la línea la quita (y el punto desaparece)');
  // llevar «Anchura de agarre» al máximo con ⇥
  await page.locator('.field:has(#p-grip) button[aria-label^="Llevar"]').nth(1).click();
  ok(/Anchura de agarre al máximo/.test(await strip()), `⇥: «${await strip()}»`);
  await setR('af-codos', 30); ok(/máx/.test(await page.locator('.aflist').textContent()), 'en el extremo, la línea dice «máx»');
  // un valor intermedio: solo lectura, con los deslizadores desactivados
  await setR('p-grip', 1.2);
  ok(/solo lectura/.test(await strip()) && await page.locator('#af-codos').isDisabled() && await page.locator('.afstrip button').isVisible(), `valor intermedio: «${await strip()}» y el deslizador de afinado, desactivado`);
  await page.locator('.afstrip button').click();
  ok(/default/.test(await strip()) && !(await page.locator('#af-codos').isDisabled()), '«Todo a default» lo arregla');
  // «Default» de un ajuste: lo devuelve a su default y deja los demás
  await setR('p-grip', 1.2); await page.locator('.field:has(#p-grip) button[aria-label^="Volver"]').click();
  ok(/default/.test(await strip()), `«Default» de la anchura la devuelve: «${await strip()}»`);
  // el máximo de un rango cambia el max del deslizador del entrenador; pasarse del límite lo recorta y lo dice
  const maxIn = page.locator('input[aria-label="Anchura de agarre: máximo"]');
  await maxIn.fill('1.3'); await maxIn.dispatchEvent('change');
  ok(await page.evaluate(() => +document.getElementById('p-grip').max) === 1.3, 'el máximo de la tabla cambia el max del deslizador del entrenador (1,3)');
  await page.locator('input[aria-label="Anchura de agarre: máximo"]').fill('5'); await page.locator('input[aria-label="Anchura de agarre: máximo"]').dispatchEvent('change');
  { const tope = await page.evaluate(() => +document.getElementById('p-grip').max), txt = await page.locator('.field:has(#p-grip) .lim').textContent();   // el tope del prono: 55 cm de media anchura entre su agarre
    ok(tope === 5 && txt.includes('fuera del rango probado'), `escribir fuera del rango probado se acepta (${tope}) y avisa «${txt}»`); }
  ok(/El entrenador lo mueve de/.test(await page.locator('.field:has(#p-grip) .edimp').textContent()), 'cada ajuste dice qué podrá hacer el entrenador');
  // «Blender» mantenido: enseña la pose de la acción
  const hold = page.locator('.afhold'); await hold.scrollIntoViewIfNeeded(); const box = await hold.boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.down();
  ok(await hold.getAttribute('aria-pressed') === 'true', '«Blender» pulsado: aria-pressed'); await page.mouse.up();
  ok(await hold.getAttribute('aria-pressed') === 'false', '«Blender» soltado');
  // las magnitudes por parte
  const partes = {}; for (const t of ['Mano', 'Codo', 'Barra en la mano', 'Escápulas', 'Tronco']) { await seg(t).click(); partes[t] = (await page.locator('#afBody .field label').allTextContents()).join(' / '); }
  ok(partes.Mano === 'Flexión / Desviación' && partes['Barra en la mano'] === 'Hacia los dedos / Hacia la palma' && partes.Escápulas === 'Subir / bajar' && partes.Tronco === 'Inclinación', `magnitudes por parte: ${JSON.stringify(partes)}`);
  // cada agarre, su afinado: el neutro avisa de que su mano no está en la biblioteca; «Copiar de otro agarre» trae el del otro
  await page.locator('#exFields .seg button', { hasText: /^Neutro/ }).click();
  ok(/falta «colgado_neutro»/.test(await page.locator('#afBody .hint').first().textContent()), `neutro: «${await page.locator('#afBody .hint').first().textContent()}»`);
  await page.locator('#exFields .seg button', { hasText: /^Supino/ }).click(); await seg('Codo').click(); await setR('af-codos', 12);
  await page.locator('#exFields .seg button', { hasText: /^Prono/ }).click();
  ok(!/\+12°/.test(await page.locator('.aflist').textContent()), 'el prono no tiene los cambios del supino');
  await page.locator('select[aria-label="Copiar de otro agarre"]').selectOption({ label: 'Supino' });
  ok(/\+12°/.test(await page.locator('.aflist').textContent()), 'copiar de otro agarre trae el afinado del supino (sin guardar)');
  await close(); console.log(fallos.length ? `FALLOS: ${fallos.length}` : 'OK'); process.exit(fallos.length ? 1 : 0); })();
