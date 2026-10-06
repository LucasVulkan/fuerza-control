/**
 * El plan gratis — docs/specs/M01-monetizacion.md §4.
 *
 * Toda la regla vive aquí, pura: el store la usa para poner la puerta en cada
 * acción, y las pantallas para pintar contadores y candados. Se cuentan los
 * ACTUALES, no los creados alguna vez (§4.1).
 */

import { templatesOf } from './programOwnership';

export const FREE = { clients: 3, connected: 1, programTemplates: 1, sessionTemplates: 1 };

/** Con app = tiene hueco en el servidor: invitado (código sin canjear) o vinculado. */
export const isConnected = (client) => !!client?.syncSlotId;

/**
 * ¿Cabe este conjunto de clientes en el plan gratis? Dos comprobaciones, no
 * dos bolsas: tres manuales y ninguno con app también vale. La usan crear,
 * conectar y la hoja de elección (§4.6).
 */
export const fitsFree = (clients) =>
  clients.length <= FREE.clients && clients.filter(isConnected).length <= FREE.connected;

/**
 * Por qué no cabe este conjunto, para el titular del paywall: 'clients' si
 * sobran clientes, 'connected' si sobran con app, null si cabe.
 */
export function clientLimitReason(clients) {
  if (clients.length > FREE.clients) return 'clients';
  if (clients.filter(isConnected).length > FREE.connected) return 'connected';
  return null;
}

/** Plantillas de sesión = las de la pestaña Plantillas; las libres de Inicio no cuentan. */
export const sessionTemplatesOf = (sessionTemplates) =>
  Object.values(sessionTemplates ?? {}).filter((tpl) => !tpl.programId && tpl.kind === 'template');

export const templateCounts = ({ programs, sessionTemplates }) => ({
  programTemplates: templatesOf(programs).length,
  sessionTemplates: sessionTemplatesOf(sessionTemplates).length,
});

/**
 * Los clientes que siguen activos sin Pro, o null si todos (caben). Si no
 * caben, solo los elegidos en `freeClientIds`, y solo si la elección es válida
 * —existen, no está vacía y juntos caben—. Si no, ninguno: congelado por
 * defecto mientras no elija, en vez de silenciosamente equivocado (§4.6).
 */
export function activeClientIds(clients, freeClientIds) {
  const all = Object.values(clients ?? {});
  if (fitsFree(all)) return null;
  const chosen = all.filter((c) => (freeClientIds ?? []).includes(c.id));
  return chosen.length > 0 && fitsFree(chosen) ? new Set(chosen.map((c) => c.id)) : new Set();
}

/**
 * Lo ya elegido y válido: queda FIJO. La hoja solo deja añadir, nunca quitar;
 * si no, se podría ir rotando y acabar llevando a todos (QA 6-oct-2026).
 */
export function lockedClientIds(clients, freeClientIds) {
  const active = activeClientIds(clients, freeClientIds);
  return active === null ? new Set() : active;
}

/**
 * ¿Queda sitio para despertar a otro congelado sin soltar a nadie? Pasa al
 * borrar a uno de los elegidos: el hueco se puede volver a ocupar.
 */
export function canChooseMore(clients, freeClientIds) {
  const active = activeClientIds(clients, freeClientIds);
  if (active === null) return false;
  const all = Object.values(clients ?? {});
  const chosen = all.filter((c) => active.has(c.id));
  return all.some((c) => !active.has(c.id) && fitsFree([...chosen, c]));
}

/** ¿Hay que enseñar la hoja de elección? Solo tras caducar con más de los que caben. */
export function needsClientChoice({ isPro, clients, freeClientIds }) {
  if (isPro) return false;
  const active = activeClientIds(clients, freeClientIds);
  return active !== null && active.size === 0;
}

export function isClientFrozen({ isPro, clients, freeClientIds }, clientId) {
  if (isPro) return false;
  const active = activeClientIds(clients, freeClientIds);
  return active !== null && !active.has(clientId);
}

/**
 * Qué deja hacer el plan gratis ahora mismo, para que las pantallas marquen la
 * acción con PRO ANTES de tocarla (QA 6-oct-2026) en vez de dejar entrar en una
 * hoja y pararla al final. Cada campo es el motivo del paywall, o null si se
 * puede. La puerta de verdad sigue en el store: esto solo la enseña.
 */
export function freeGates({ isPro, clients, freeClientIds, programs, sessionTemplates }) {
  if (isPro) return OPEN;
  const all    = Object.values(clients ?? {});
  const active = activeClientIds(clients, freeClientIds);
  const counts = templateCounts({ programs, sessionTemplates });
  const frozen = (id) => active !== null && !active.has(id);
  return {
    isPro: false,
    newClient:          clientLimitReason([...all, { syncSlotId: null }]),
    newConnectedClient: clientLimitReason([...all, { syncSlotId: 'nuevo' }]),
    connect:   (id) => (frozen(id) ? 'frozen' : clientLimitReason(all.map((c) => (c.id === id ? { ...c, syncSlotId: 'nuevo' } : c)))),
    client:    (id) => (frozen(id) ? 'frozen' : null),
    newProgramTemplate:    counts.programTemplates >= FREE.programTemplates ? 'programTemplates' : null,
    newSessionTemplate:    counts.sessionTemplates >= FREE.sessionTemplates ? 'sessionTemplates' : null,
  };
}

const OPEN = {
  isPro: true,
  newClient: null, newConnectedClient: null,
  connect: () => null, client: () => null,
  newProgramTemplate: null, newSessionTemplate: null,
};
