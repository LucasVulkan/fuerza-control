/**
 * El plan gratis — docs/specs/M01-monetizacion.md §4.
 *
 * Toda la regla vive aquí, pura: el store la usa para poner la puerta en cada
 * acción, y las pantallas para pintar contadores y candados. Se cuentan los
 * ACTUALES, no los creados alguna vez (§4.1).
 */

import { templatesOf } from './programOwnership';
import { hasSlot, linkOf, slotFacts, NO_SLOT, SLOT_LOST } from './clientLink';

export const FREE = { clients: 3, connected: 1, programTemplates: 1, sessionTemplates: 1 };

/** Con app = tiene código (C10 §7): invitado, dentro o se fue. Tener hueco no cuenta: con cuenta lo tienen todos. */
// Uno «de otra cuenta» (C09 §3.4) no está conectado en esta: no ocupa plaza.
// `linking` = el alta/conexión está en vuelo (E42, `ui.linking`): la plaza ya
// está reservada, así que una segunda pulsación la ve ocupada.
// Ni lo uno ni lo otro es de la ficha: `forPlan` los pone en una copia.
export const isConnected = (client) => !!client?.linking || (hasSlot(client) && !!client.code);   // = withApp(linkOf(c, userId)) sobre `forPlan`

/**
 * Los clientes tal como los cuenta el plan en la cuenta `userId`: los de otra
 * cuenta (o sin cuenta) como sin hueco, y con `linking` los que tienen un alta en
 * vuelo. Todo lo de este archivo cuenta sobre esto, no sobre `clients` a secas.
 */
export const forPlan = (clients, userId, linking) =>
  Object.fromEntries(Object.entries(clients ?? {}).map(([id, c]) => {
    const own = linkOf(c, userId) !== 'otherAccount';
    return [id, own && !linking?.[id] ? c : { ...c, ...(own ? {} : SLOT_LOST), ...(linking?.[id] ? { linking: true } : {}) }];
  }));

// Un cliente que se va a conectar / un cliente sin app, para contar plazas.
export const NEW_WITH_APP = slotFacts({ id: 'nuevo', client_code: 'nuevo' }, 'nuevo');

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

/**
 * Por qué no se puede pasar `id` a la app, o null (E41). Con congelados la puerta
 * de «1 con app» se mira solo sobre los activos más el que se conecta: lo
 * congelado no se puede usar, no debe ocupar la plaza. Un congelado: 'frozen'.
 * Crear uno nuevo, en cambio, sigue contando a todos.
 */
export function connectReason(clients, freeClientIds, id) {
  const all = Object.values(clients ?? {});
  const active = activeClientIds(clients, freeClientIds);
  if (active !== null && !active.has(id)) return 'frozen';
  const base = active === null ? all : all.filter((c) => active.has(c.id));
  return clientLimitReason(base.map((c) => (c.id === id ? { ...c, ...NEW_WITH_APP } : c)));
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
 * caben, los elegidos en `freeClientIds` que aún existen. La elección persiste
 * (R-E4, 24-oct-2026): si lo elegido ya no cabe por sí mismo (dos con app tras
 * un backup viejo), siguen activos los elegidos que caben, recorridos en el orden de
 * elección, y se congela solo lo que sobra. Solo si no queda nadie elegido
 * —lista vacía— salen todos congelados: sin elegir, en vez de silenciosamente
 * equivocado (§4.6).
 */
export function activeClientIds(clients, freeClientIds) {
  const all = Object.values(clients ?? {});
  if (fitsFree(all)) return null;
  const byId = new Map(all.map((c) => [c.id, c]));
  const kept = [];
  for (const id of freeClientIds ?? []) {
    const c = byId.get(id);
    if (!c || kept.includes(c)) continue;
    if (!fitsFree([...kept, c])) continue;   // el que ya no cabe se salta: se congela solo él (R-E4)
    kept.push(c);
  }
  return new Set(kept.map((c) => c.id));
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
    newClient:          clientLimitReason([...all, NO_SLOT]),
    newConnectedClient: clientLimitReason([...all, NEW_WITH_APP]),
    connect:   (id) => connectReason(clients, freeClientIds, id),
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

const GRACE_MS = 20 * 86_400_000;
// `proCheckedAt` es hora del servidor y `nowMs` la del móvil: un día de margen
// para que un reloj que va un poco atrasado no se tome por uno trucado.
const CLOCK_SKEW_MS = 86_400_000;

/**
 * ¿Sigue valiendo el PRO guardado sin red? (R-E5, E46) Hasta el final del
 * periodo de la última confirmación más 20 días; el pago único no caduca; con el
 * reloj por debajo de esa confirmación el plazo se da por gastado.
 */
export function proStillValid({ proLifetime, proExpiresAt, proCheckedAt }, nowMs) {
  if (proLifetime) return true;
  if (nowMs < (proCheckedAt ?? 0) - CLOCK_SKEW_MS) return false;
  return nowMs <= proExpiresAt + GRACE_MS;
}
