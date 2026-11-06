/**
 * El ejemplo del recorrido de Clientes (U17-04 §6): las filas de verdad
 * (`ClientRow`) con tres clientes de datos fijos en distintos estados. Solo se
 * mira: ninguna fila se toca y no hay nada del store.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ClientRow from '../ClientRow';
import { getCardRadii, spacing } from '../../theme';
import { useTheme } from '../../useTheme';
import { exampleClientRows } from './exampleClientRows';

export default function ClientStatesExample() {
  const { t } = useTranslation();
  const th    = useTheme();
  const rows  = exampleClientRows(t, th.colors);
  return (
    <View style={{ gap: spacing.xs }} pointerEvents="none">
      {rows.map((r, i) => (
        <ClientRow
          key={r.client.id}
          client={r.client}
          link={r.link}
          badgeLabel={r.badgeLabel}
          radii={getCardRadii(th, i === 0, i === rows.length - 1)}
          meta={r.meta}
          week={r.week ?? null}
          cta={r.cta ?? null}
          unread={r.unread ?? 0}
        />
      ))}
    </View>
  );
}
