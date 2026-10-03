/**
 * De quién es un programa, y para qué sirve — dos campos ortogonales.
 *
 * `owner` ('me' o un clientId) dice de quién es; `kind` ('program' | 'template')
 * dice para qué sirve. Sustituyen a `mode` + `program.clientId` +
 * `client.programIds[]` + `profile.secondaryProgramIds[]`: cuatro registros del
 * mismo hecho que nadie obligaba a estar de acuerdo, y cuyo invariante lo
 * sostenía quien leía (spec `docs/specs/P03-program-model.md` §1).
 *
 * La lista de programas de un cliente ya no se guarda: **se calcula**. No puede
 * contener ids muertos porque no contiene ids.
 *
 * Sustituye a `src/utils/clientPrograms.js`, que se borró con este cambio.
 */

/** Programas de un dueño ('me' o un clientId), sin plantillas. Recientes primero. */
export function programsOf(programs, owner) {
  return Object.values(programs ?? {})
    .filter((p) => p.owner === owner && p.kind !== 'template')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** La biblioteca de plantillas del entrenador, por nombre — como la pintan las tres pantallas. */
export function templatesOf(programs) {
  return Object.values(programs ?? {})
    .filter((p) => p.kind === 'template')
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

/**
 * Asigna `programId` como programa activo del cliente y lo marca sucio para que
 * el entrenador lo suba. Ya no mantiene ninguna lista: el programa anterior
 * sigue siendo del cliente por su `owner`, sólo pierde el activo.
 */
export function assignActiveProgram(client, programId) {
  return { ...client, activeProgramId: programId, programDirty: true };
}

/**
 * La ficha del cliente dueño de un programa, o null si es mío.
 *
 * Cinco pantallas hacían `program.clientId ? clients[program.clientId] : null`
 * a mano. En el móvil del cliente no hay ficha que consultar —el programa es
 * suyo— y de ahí que lo correcto sea null y no `clients['me']`.
 */
export function ownerClient(clients, program) {
  const owner = program?.owner;
  return owner && owner !== 'me' ? (clients?.[owner] ?? null) : null;
}

/** Sin programa activo. No borra nada: no queda lista que mantener. */
export function deassignProgram(client) {
  return { ...client, activeProgramId: null, programDirty: false };
}

/**
 * Lo que se puede copiar al cliente `clientId` desde «De otro cliente», agrupado
 * por dueño: los tuyos primero y luego un grupo por cliente, por nombre. Fuera
 * van las plantillas, el activo de este cliente y los dueños que ya no existen.
 * Dentro de cada grupo, el activo primero y luego los más recientes (`programsOf`).
 *
 * @returns {{ owner: string, name: string|null, items: { program: object, isActive: boolean }[] }[]}
 *   `name` es null en el grupo de `me`: lo pone quien pinta.
 */
export function copySources(programs, clients, clientId, myActiveId) {
  const skipId = clients?.[clientId]?.activeProgramId;
  const group = (owner, name, activeId) => {
    const list = programsOf(programs, owner).filter((p) => p.id !== skipId);
    const items = [
      ...list.filter((p) => p.id === activeId),
      ...list.filter((p) => p.id !== activeId),
    ].map((program) => ({ program, isActive: program.id === activeId }));
    return { owner, name, items };
  };
  const byClient = Object.entries(clients ?? {})
    .map(([id, c]) => group(id, c.name ?? '', c.activeProgramId))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [group('me', null, myActiveId), ...byClient].filter((g) => g.items.length > 0);
}
