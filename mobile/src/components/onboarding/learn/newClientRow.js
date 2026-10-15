import { stageDaysAt } from '../../../utils/stageProgress';

/**
 * La fila del cliente recién creado, tal cual sale en Clientes: sin programa, el
 * aviso con su «Programar»; con él, el programa (o «esperando código» si es con
 * app, C08 §3.4) y los cuadraditos de la semana. La usan también asignar e
 * invitar del camino del entrenador (O03 §7.7-7.8).
 */
export function newClientRow(t, C, { client, program, app }) {
  const never = { text: t('clients.lastNever').toLowerCase(), today: false };
  const base = { client, link: app ? 'invited' : 'none', badgeLabel: t('clients.statusInvited') };
  return !program
    ? {
        ...base,
        meta: { text: t('clients.noActiveProgram'), color: C.text },
        cta:  { label: t('clients.btnProgram'), icon: 'add', color: C.text },
        week: null,
      }
    : {
        ...base,
        meta: { text: app ? t('clients.statusInvited') : [program.name, program.stages?.[0]?.name].filter(Boolean).join(' · ') },
        cta:  null,
        week: { total: Math.max(1, stageDaysAt(program, 0).length), done: 0, extra: 0, last: never },
      };
}
