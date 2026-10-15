/**
 * «Tus clientes, de un vistazo» (O03 §11.4, §22.1): la fila de Clientes de
 * verdad (`ClientRow`, C08 §3-4) con el cliente que acaba de crear el entrenador
 * arriba —con su reloj si es con app— y tres de ejemplo con datos fijos que no
 * salen del store: uno al día con cuadraditos y la muesca de sesiones sin
 * revisar, uno «Sin entrenar» en rojo y uno «Cambios sin enviar» en azul con
 * «↑ Enviar». Solo se mira: ninguna fila se toca.
 */
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import ClientRow from '../../ClientRow';
import { getCardRadii, spacing } from '../../../theme';
import { useTheme } from '../../../useTheme';
import { newClientRow } from './newClientRow';
import Spot from './Spot';

// Constantes y no `{}` en el selector: zustand 5 repinta sin fin con un objeto nuevo cada vez.
const NONE = {};
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

export default function ClientsMini() {
  const { t } = useTranslation();
  const th = useTheme();
  const C  = th.colors;
  const answers  = useStore(answersOf);
  const clients  = useStore((s) => s.clients);
  const programs = useStore((s) => s.programs);

  // El cliente del recorrido; si no hay (se saltó el tramo), uno de ejemplo.
  const mine    = clients[answers.clientId];
  const client  = mine ?? { id: 'ex-0', name: t('onboardingFlow.learn.exampleClient'), color: 0 };
  const program = programs[mine?.activeProgramId ?? answers.programId];
  const app     = answers.clientMode === 'app';

  const rows = [
    newClientRow(t, C, { client, program, app }),
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

  return (
    <View style={styles.list} pointerEvents="none">
      {rows.map((r, i) => {
        const row = (
          <ClientRow
            client={r.client}
            link={r.link}
            badgeLabel={r.badgeLabel}
            radii={getCardRadii(th, i === 0, i === rows.length - 1)}
            meta={r.meta}
            week={r.week ?? null}
            cta={r.cta ?? null}
            unread={r.unread ?? 0}
          />
        );
        return r.spot
          ? <Spot key={r.client.id} radius={th.radius.md} finger={{ right: 8, bottom: -10 }} style={styles.spot}>{row}</Spot>
          : <View key={r.client.id}>{row}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  spot: { zIndex: 1 },
});
