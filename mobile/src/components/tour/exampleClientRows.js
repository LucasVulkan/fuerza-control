/**
 * Tres clientes de ejemplo con datos fijos, que no salen del store: uno al día con
 * cuadraditos y la muesca de sesiones sin revisar, uno «Sin entrenar» en rojo y
 * uno «Cambios sin enviar» en azul con «↑ Enviar». Los comparten la tarjeta
 * «Tus clientes, de un vistazo» del onboarding (`ClientsMini`) y el recorrido de
 * Clientes (`ClientStatesExample`, U17-04).
 */
export function exampleClientRows(t, C) {
  return [
    {
      client: { id: 'ex-1', name: 'Sara López', color: 3 }, link: 'linked', badgeLabel: t('clients.info.link_linked'),
      meta: { text: 'Full Body · ' + t('home.stageDefault', { n: 2 }), tail: t('clients.stageNWeeks', { n: 3, total: 6 }) },
      week: { total: 3, done: 2, extra: 0, last: { text: t('dayCard.yesterday').toLowerCase(), today: false } },
      unread: 2, spot: true,
    },
    {
      client: { id: 'ex-2', name: 'Luis Pérez', color: 1 }, link: 'none', badgeLabel: '',
      meta: { text: t('clients.notTraining'), color: C.redText ?? C.red },
      week: { total: 3, done: 0, extra: 0, last: { text: t('clients.lastSeenDays', { count: 9 }), today: false } },
    },
    {
      client: { id: 'ex-3', name: 'Irene Gil', color: 4 }, link: 'linked', badgeLabel: t('clients.info.link_linked'),
      meta: { text: t('clients.pendingTitle'), color: C.blue },
      cta: { label: t('clients.btnSendOverride'), icon: 'send', color: C.blue },
    },
  ];
}
