/**
 * El contrato del código de entrenador, que vive partido en dos sitios sin
 * nada que los una:
 *
 *   · lo GENERA  `generateTrainerCode`, aquí, en la app;
 *   · lo VALIDA  `CODE_RE` en `supabase/functions/create-trainer-account`,
 *     que es Deno y no puede importar nada de aquí.
 *
 * Si alguien cambia el generador —más caracteres, otro alfabeto, otro
 * separador— la función del servidor empezaría a rechazar TODAS las altas
 * nuevas, y el usuario solo vería "Código inválido" sin más pista. Esta copia
 * de la expresión es la alarma: si deja de pasar, hay que tocar las dos.
 */

import { describe, it, expect, vi } from 'vitest';

// `supabaseAuth` importa el cliente real, que al construirse engancha un
// temporizador de refresco contra el storage. Aquí no interesa nada de eso.
vi.mock('../config/supabase', () => ({ supabase: { auth: {} } }));

const { generateTrainerCode } = await import('./supabaseAuth.js');

/** Copia literal de `CODE_RE` en supabase/functions/create-trainer-account/index.ts */
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

describe('código de entrenador', () => {
  it('todo código generado pasa la validación del servidor', () => {
    const invalidos = Array.from({ length: 2000 }, generateTrainerCode)
      .filter((c) => !CODE_RE.test(c));

    expect(invalidos).toEqual([]);
  });

  it('no usa caracteres que se confundan al dictarlo por teléfono', () => {
    // Ni I ni O ni 0 ni 1: el código se lee en voz alta y se teclea a mano.
    const juntos = Array.from({ length: 2000 }, generateTrainerCode).join('');

    expect(juntos).not.toMatch(/[IO01]/);
  });

  it('la validación rechaza lo que no tiene la forma', () => {
    const basura = ['', 'abcd-abcd-abcd', 'ABCD-ABCD', 'ABCD-ABCD-ABCD-ABCD',
                    'ABCI-ABCD-ABCD', 'ABC0-ABCD-ABCD', 'ABCDABCDABCD'];

    expect(basura.filter((c) => CODE_RE.test(c))).toEqual([]);
  });
});
