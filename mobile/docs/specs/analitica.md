# Spec — Analítica anónima propia

> Tema: analítica
> En corto: Saber si la gente termina el onboarding, si conecta con un entrenador, si vuelve a la semana y si mejora — con una tabla propia en Supabase, sin Firebase ni ningún SDK de terceros.
> Fase A01 · pendiente · La tubería: tabla `app_events`, `track()` y `app_open` · §4
> Fase A02 · pendiente · Los eventos del recorrido · §5
> Fase A03 · pendiente · Pulso mensual: mejora y adherencia · §6
> Fase A04 · pendiente · Privacidad: interruptor, cuestionario y política · §7
>
> Estado: **SIN IMPLEMENTAR — en espera deliberada** (sep 2026). 4 fases: A01
> tubería · A02 eventos · A03 pulso · A04 privacidad.
>
> **No se ejecuta todavía, y no es por prioridad.** El onboarding se está
> tocando ahora mismo, y la A02 es precisamente instrumentarlo: poner los
> disparadores sobre una pantalla en obra significa moverlos otra vez y, peor,
> estrenar los nombres de los eventos contra un recorrido que va a cambiar — y
> un nombre de evento, una vez hay datos detrás, ya no se cambia sin partir la
> serie en dos (§ *Ventaja de partida*). Se arranca **cuando la app esté más o
> menos cerrada**.
>
> **Al retomarla, verificar antes las referencias de la §5**: los números de
> línea de `OnboardingScreen.jsx` habrán bailado. El resto de la spec —el
> modelo, el SQL, el pulso, la privacidad— no depende de esa pantalla y sigue
> siendo válido tal cual.
>
> Origen: el plan de marketing recomendaba Firebase GA4. Se descarta con motivo
> en §1: para esta app cuesta más de lo que da, y **no responde la pregunta más
> interesante** (el % de mejora), que es una consulta sobre datos que ya tienes.
>
> **A04 no bloquea el código, bloquea la publicación.** Se puede implementar A01
> a A03 y probarlas en el track interno; lo que no se puede es enviar a App Store
> con [app-store-privacidad.md](../app-store-privacidad.md) diciendo que no hay
> analítica cuando ya la hay. Ver §7.
>
> **Ventaja de partida:** la app no está publicada. No hay ni un usuario real,
> así que el esquema de la tabla y los nombres de los eventos se pueden fijar
> ahora sin migrar nada. Un nombre de evento, una vez hay meses de datos detrás,
> ya no se cambia sin partir la serie en dos.
>
> Depende de: nada. No toca el modelo de datos, ni el store, ni ninguna pantalla
> salvo para añadir llamadas de una línea.

---

## 1. Por qué no Firebase GA4

No por dogma. Cuatro razones de **esta** app:

1. **No responde la pregunta del % de mejora.** GA4 cuenta eventos; no calcula
   una regresión sobre un historial de entrenamiento. Esa métrica ya existe en
   el código (`computeOverallImprovement`, §6) y lo único que hace falta es un
   sitio donde dejarla. GA4 sería ese sitio *además* de otras cinco cosas que no
   necesitas.
2. **Analítica de web con disfraz.** Latencia de 24-48 h, muestreo, modelo de
   sesión, y para un embudo de onboarding decente acabas exportando a BigQuery.
3. **Coste legal real.** Mete a Google como tercero receptor. Hoy
   [app-store-privacidad.md](../app-store-privacidad.md) puede contestar *"No, we
   do not use data for tracking"* y saltarse ATT; con una tabla propia sigue
   pudiendo (§7), con Firebase la conversación se complica y entra el
   consentimiento en la UE.
4. **Peso.** SDK nativo, config plists, prebuild. La alternativa son **40 líneas
   sobre el Supabase que ya está configurado**
   ([src/config/supabase.js](../../src/config/supabase.js)).

Ya está descartado por escrito el SDK de atribución, por lo mismo, en
[monetizacion.md](monetizacion.md).

## 2. Qué se responde y qué no

| Pregunta | Cómo | Fase |
|---|---|---|
| ¿Empiezan el onboarding? ¿Dónde se caen? | `onboarding_start` + `onboarding_step` + `onboarding_done` | A02 |
| ¿Conectan con un entrenador? | `client_linked` | A02 |
| ¿Siguen ahí a la semana? | `app_open` + cohorte por `min(at)` | A01 |
| ¿Cuánto mejoran? | `progress_pulse.mejora_pct` | A03 |
| ¿Entrenan de verdad? | `workout_finished` + `progress_pulse.adherencia` | A02/A03 |
| ¿El muro convierte? | `paywall_seen` + `purchase_done` | A02 |

Lo que **no** se responde, a propósito: nada por usuario identificado, nada de
embudos por pantalla, nada de sesiones, nada de fuente de instalación. Si algún
día hace falta atribución de campañas, es otra decisión y otro documento (y
tumba el "no rastreamos", ver [monetizacion.md](monetizacion.md)).

**"Programa terminado" no se mide.** El modelo no lo tiene: un programa solo
pasa a `status: 'archived'` + `archivedAt`
([useStore.js:529](../../store/useStore.js)), y eso incluye "lo acabé" y "lo
abandoné a la tercera sesión", que son lo contrario. Añadir un flag `completed`
significa preguntárselo al usuario para resolver una duda tuya. **Se descarta**:
la adherencia del pulso (§6) separa los dos casos sin preguntar nada.

## 3. El modelo

Una tabla **nueva**, aparte de las de clientes y programas. Aquellas tienen RLS
que ata cada fila a un usuario; ésta tiene lo contrario, y por eso no se mezclan:
meter los eventos en una tabla con dueño sería atar la analítica a la identidad.

```sql
create table app_events (
  id      bigserial primary key,
  device  text not null,
  name    text not null,
  props   jsonb not null default '{}',
  at      timestamptz not null default now()
);
create index app_events_device_at on app_events (device, at);
create index app_events_name_at   on app_events (name, at);

alter table app_events enable row level security;

-- Solo insertar. Sin policy de SELECT, la anon key no puede leer NADA:
-- ni sus propias filas. Se consulta desde el panel de Supabase (service role).
create policy app_events_insert on app_events
  for insert to anon, authenticated with check (true);
```

**Garantías que da esta forma, y que hay que mantener:**

- `device` es un UUID aleatorio guardado en `AsyncStorage`. **No es** el
  `user.id` de Supabase, **no es** un identificador de publicidad, y no se cruza
  con ninguna otra tabla. Si el usuario reinstala, es otro dispositivo — y eso
  está bien: es lo que lo hace anónimo de verdad.
- `props` nunca lleva texto escrito por el usuario. Ni nombres de programa, ni
  notas, ni el nombre del alumno, ni el código de entrenador. Números y enums.
  **Esta regla es la que sostiene el §7 entero**; si alguien mete un `nombre` en
  un `props`, el cuestionario de privacidad deja de ser verdad.
- Sin policy de lectura, un código filtrado o la anon key —que ya viaja en el
  binario, [supabase.js:5](../../src/config/supabase.js)— no permite extraer
  nada.

**Coste.** ~20 filas por usuario y semana. El plan gratuito de Supabase son
500 MB; a mil usuarios eso es del orden de 100 MB al año. Cuando moleste:
`delete from app_events where at < now() - interval '90 days'`. No antes.

## 4. Fase A01 — La tubería

Un fichero nuevo y una llamada. Al acabar la fase tiene que haber filas de
`app_open` en la tabla, y nada más.

`mobile/src/services/analytics.js`:

```js
/**
 * Analítica anónima propia. Ver mobile/docs/specs/analitica.md.
 *
 * Reglas que no se rompen:
 *  - `device` es un UUID aleatorio, nunca el user.id ni un id de publicidad.
 *  - `props` nunca lleva texto escrito por el usuario. Números y enums.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../config/supabase';

const DEVICE_KEY = 'fc_device';
const OPTOUT_KEY = 'fc_analytics_off';   // lo escribe el interruptor de §7

let device = null;

async function deviceId() {
  if (device) return device;
  device = await AsyncStorage.getItem(DEVICE_KEY);
  if (!device) {
    device = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_KEY, device);
  }
  return device;
}

/** Dispara y olvida. Nunca se espera, nunca bloquea la UI, nunca lanza. */
export async function track(name, props = {}) {
  try {
    if (await AsyncStorage.getItem(OPTOUT_KEY)) return;
    await supabase.from('app_events').insert({ device: await deviceId(), name, props });
  } catch {
    // ponytail: si falla se pierde el evento. Es un termómetro, no contabilidad.
    // Si algún día importa que no se pierda ninguno, cola en AsyncStorage.
  }
}
```

`expo-crypto` **ya está** en `mobile/package.json`. No hay dependencia nueva en
ninguna fase de esta spec.

El único punto de llamada de A01, en [App.js](../../App.js), junto al `useEffect`
que configura RevenueCat (~línea 162):

```js
useEffect(() => { track('app_open'); }, []);
```

**Sin `AppState`.** Un `app_open` por arranque en frío basta para la retención;
contar cada vuelta desde segundo plano multiplica las filas y no cambia ninguna
respuesta.

**Probar en dispositivo.** Arrancar la app dos veces y comprobar en el panel de
Supabase que hay dos filas `app_open` con el **mismo** `device`. Que sea el mismo
es lo que se está probando: si cambia, `AsyncStorage` no está persistiendo y toda
la retención sería mentira.

## 5. Fase A02 — Los eventos del recorrido

Nueve llamadas. Cada una es una línea; la lista es exhaustiva y no se amplía sin
volver aquí — la disciplina de tener pocos eventos es lo que hace que las
consultas de §8 sigan siendo legibles dentro de un año.

| Evento | `props` | Dónde |
|---|---|---|
| `onboarding_start` | `{ primera }` | `OnboardingScreen`, al montar |
| `onboarding_step` | `{ paso }` | `nextStep` ([OnboardingScreen.jsx:656](../../src/screens/OnboardingScreen.jsx)) |
| `onboarding_done` | `{ dias, nivel }` | `finish` ([OnboardingScreen.jsx:802](../../src/screens/OnboardingScreen.jsx), el `EMPEZAR`) |
| `mode_selected` | `{ modo }` | los `setMode` ([OnboardingScreen.jsx:887](../../src/screens/OnboardingScreen.jsx), `894`, `910`) |
| `client_linked` | — | `linkToTrainer`, tras el paso 4 ([useStore.js:3446](../../store/useStore.js)) |
| `trainer_client_created` | `{ n }` | `createClient` ([useStore.js:576](../../store/useStore.js)) |
| `workout_finished` | `{ ejercicios, minutos, libre }` | [WorkoutScreen.jsx:554](../../src/screens/WorkoutScreen.jsx), si `result.ok` |
| `paywall_seen` | `{ origen }` | `PaywallModal`, al montar |
| `purchase_done` | `{ origen }` | `purchasePackage`, si `ok` ([useStore.js:3921](../../store/useStore.js)) |

Detalles que no son obvios y que decidirlos mal cuesta los datos de un trimestre:

**`onboarding_step` se emite al ENTRAR en cada paso, no al salir.** Así el último
`onboarding_step` de un `device` que no llegó a `onboarding_done` dice
exactamente dónde lo dejó. Si se emitiera al salir, el paso donde se cae es
justamente el que no aparece.

**`paso`** sale de `stepIds` tal cual, que ya son
`['level', 'identity', 'days']` ([OnboardingScreen.jsx:474](../../src/screens/OnboardingScreen.jsx)),
más `'proposals'` y `'preview'` desde `autoPhase`. Cinco valores, los mismos
nombres que usa el código: no se inventa una nomenclatura paralela que luego haya
que traducir mentalmente al leer una consulta.

**`primera`** distingue el alta real de la enésima visita. `OnboardingScreen` es
*"Nuevo programa"*, y se abre también con la app llena: sin este booleano el
embudo mezcla dos poblaciones opuestas. Vale `Object.keys(programs).length === 0`.

**`workout_finished` va en la pantalla, no en el store.** `saveSession`
([useStore.js:2042](../../store/useStore.js)) tiene dos ramas —sesión libre y
sesión de programa— y varias salidas `{ ok: false }`. El único punto por el que
pasa todo lo que de verdad se guardó es el `if (result.ok)` de
[WorkoutScreen.jsx:554](../../src/screens/WorkoutScreen.jsx).

**`origen`** en el paywall: `PaywallModal` se monta en tres sitios
([AppHeader.jsx:528](../../src/components/AppHeader.jsx),
[ClientsScreen.jsx:2347](../../src/screens/ClientsScreen.jsx),
[ProgramScreen.jsx:412](../../src/screens/ProgramScreen.jsx)). Se le añade una
prop `origen` (`'header' | 'clients' | 'programs'`) y el `track` va dentro del
modal, en un `useEffect(..., [])`. Saber si el muro se toca desde clientes o
desde plantillas es literalmente la pregunta de [monetizacion.md](monetizacion.md).

**Sin i18n.** Ningún evento pinta nada. Los valores de `props` son enums en
inglés y no se traducen: son claves de datos, no texto.

**Probar en dispositivo.** Recorrido completo desde cero: instalar, abrir,
`Nuevo programa` → automático → las tres preguntas → EMPEZAR, y entrenar una
sesión. En la tabla tienen que quedar, en orden y con el mismo `device`:
`app_open`, `onboarding_start` con `primera: true`, `mode_selected`, tres
`onboarding_step`, `onboarding_done` y `workout_finished`.

## 6. Fase A03 — Pulso mensual

Un evento por dispositivo y mes. Doce filas por usuario al año.

### 6.1 El refactor previo

La métrica que se quiere ya existe y es la tarjeta que pone **MEJORA** en
Progreso, pero vive **dentro** del componente y no se exporta. Hay que sacar a
`mobile/src/utils/improvement.js`, tal cual, sin cambiar una línea de su cuerpo:

| Función | Hoy | Por qué se mueve |
|---|---|---|
| `computeOverallImprovement` | [ProgressTab.jsx:169](../../src/components/stats/ProgressTab.jsx) | es la métrica del pulso |
| `linearRegressionPct` | [ProgressTab.jsx:142](../../src/components/stats/ProgressTab.jsx) | la usa la anterior |
| `computeValue` | [ProgressTab.jsx:114](../../src/components/stats/ProgressTab.jsx) | la usa la anterior |
| `getExerciseLogsFrom` | [ProgressTab.jsx:82](../../src/components/stats/ProgressTab.jsx) | la usa la anterior |
| `computeExerciseImprovement` | [ProgressTab.jsx:187](../../src/components/stats/ProgressTab.jsx) | envoltorio de una línea, va con las suyas |

`ProgressTab.jsx` las vuelve a importar del nuevo módulo. Es un **movimiento
puro**: los nombres no cambian, así que sus 16 usos de `computeValue` y 7 de
`getExerciseLogsFrom` no se tocan; solo se añade la línea de `import`.
`computeValue` depende de `bestSetE1RM`, que ya sale de `utils/oneRm.js`.

Se lleva su prueba: **hoy no tiene ninguna**, siendo el número más vendible de la
app, y el resto de `src/utils/*.js` sí las tiene. `improvement.test.js`, en la
línea de [oneRm.test.js](../../src/utils/oneRm.test.js), con lo mínimo: serie
plana → `0`; serie que sube → positivo; menos de dos sesiones → `null`; tope de
`+200` respetado.

### 6.2 El evento

```js
progress_pulse {
  programas:  2,     // programas con status 'archived'
  sesiones:   34,    // workoutLog.length
  mejora_pct: 7,     // computeOverallImprovement(workoutLog, allExercises)
  adherencia: 78,    // adherencePct(...)
  conectado:  true,  // hay entrenador vinculado
}
```

`mejora_pct` va **en crudo, sin cubos**. Es un entero por dispositivo y mes,
promediado entre todos sus ejercicios y capado a `[-100, +200]` por la propia
función: no identifica a nadie y agruparlo en rangos solo destruye precisión.
Los datos de entrenamiento en sí **no salen del dispositivo**: sale un promedio.

`adherencia` sale de `adherencePct`
([adherence.js:106](../../src/utils/adherence.js)), ya exportada y con pruebas,
con `sessionsPerCycle = stageDays(programaActivo).length` — el mismo cálculo que
`weeklyTarget` hace para el entrenador en
[ClientsScreen.jsx:51](../../src/screens/ClientsScreen.jsx), con `stageDays` de
`utils/stageProgress`.

Ambas pueden ser `null` (sin historial suficiente). Se envía `null`, no `0`: en
la consulta `avg()` ignora los nulos y un `0` inventado hundiría la media.

### 6.3 Cuándo se dispara

En `analytics.js`, dos funciones más:

```js
const PULSE_KEY = 'fc_pulse';
const MES = 30 * 86400000;

/** Construye el pulso a partir del estado. Pura: es la que se prueba. */
export function buildPulse(state) { /* … los cinco campos de §6.2 … */ }

/** Un pulso al mes como mucho. Se llama en el arranque, después de track(). */
export async function maybePulse(state) {
  try {
    const last = await AsyncStorage.getItem(PULSE_KEY);
    if (last && Date.now() - Number(last) < MES) return;
    await AsyncStorage.setItem(PULSE_KEY, String(Date.now()));
    await track('progress_pulse', buildPulse(state));
  } catch { /* mismo criterio que track */ }
}
```

En [App.js](../../App.js), pegado al `track('app_open')` de §4:

```js
useEffect(() => { track('app_open'); maybePulse(useStore.getState()); }, []);
```

**Mensual y no semanal**: la mejora es una regresión sobre todo el historial, en
siete días no se mueve lo suficiente para justificar 4× las filas. El pulso de
vida semanal ya lo da `app_open`.

**Sin `expo-background-fetch`** (está instalado, pero no hace falta): un `if` en
el arranque no necesita tarea en segundo plano, y un usuario que no abre la app
en un mes no tiene progreso que reportar.

`buildPulse` es pura y se prueba con un estado de mentira: con `workoutLog`
vacío devuelve `mejora_pct: null` y `sesiones: 0` sin lanzar.

**Probar en dispositivo.** Con `npm run seed` (que genera historial), borrar
`fc_pulse` y arrancar: una fila `progress_pulse` con `mejora_pct` **igual al
número de la tarjeta MEJORA** de Progreso. Si no coinciden, el pulso está
midiendo otra cosa que la pantalla.

## 7. Fase A04 — Privacidad

**Esta fase bloquea el envío a las tiendas, no el código.** Se puede desarrollar
y probar A01-A03 en el track interno; lo que no se puede es enviar a revisión con
un cuestionario que ya no es verdad.

### 7.1 El interruptor

En Ajustes, junto a las opciones de cuenta: **"Compartir estadísticas de uso
anónimas"**, activado por defecto. Escribe `fc_analytics_off` en `AsyncStorage`,
que es la llave que `track` ya mira en §4.

Es lo único de esta spec con UI, y por tanto lo único que **necesita i18n**
(`es.json` + `en.json`, regla de `mobile/AGENTS.md`). Un interruptor y su línea
de explicación: *"Números anónimos sobre cómo se usa la app. No incluyen tus
entrenamientos, tu nombre ni nada que puedas escribir."*

Se incluye aunque la analítica sea anónima y de primera parte porque en la UE
guardar un identificador en el dispositivo con fines de medición es discutible
sin base para ello, y quince líneas cuestan menos que la discusión.

### 7.2 El cuestionario de App Store

En [app-store-privacidad.md](../app-store-privacidad.md) cambian **tres** cosas y
solo tres:

1. **"Lo primero: ¿rastreas?"** sigue contestando **No**, y hay que decir por
   qué sigue siendo verdad: ningún SDK de terceros, ningún data broker, ningún
   cruce con otras apps, ningún identificador de publicidad. **La app sigue sin
   necesitar ATT.** Ése es el premio de no haber metido Firebase, y conviene que
   quede escrito para que dentro de un año nadie lo deshaga por descuido.
2. **Tabla "Dónde acaban los datos"**: cuarta fila, `app_events` en el Supabase
   propio — eventos de uso anónimos, sin cuenta asociada.
3. **"Lo que NO se recoge"**: sale la línea *"Usage Data / Product Interaction —
   no hay analítica"*, y entra un apartado nuevo:

   > ### Usage Data → Product Interaction
   > **Sí, se recoge. NO vinculado a la identidad. Uso: Analytics.**
   >
   > La tabla `app_events` (ver `mobile/docs/specs/analitica.md`). Se identifica
   > con un UUID aleatorio por instalación que no es el `user.id`, no se cruza
   > con ninguna otra tabla y no es un identificador de publicidad. Los `props`
   > no llevan texto escrito por el usuario. Desactivable en Ajustes.

*Diagnostics / Crash Data* sigue siendo **no**: esto no es crash reporting.

**"No vinculado" es la respuesta correcta y hay que poder defenderla**: es cierta
mientras `device` sea aleatorio y no se envíe junto a ningún identificador de
cuenta. Si algún día alguien mete el `user.id` en un `props` "para depurar", la
respuesta pasa a *Linked to You* y esta sección deja de ser verdad.

### 7.3 La política pública

La URL que exige Apple (ya pendiente en el documento actual, apartado *Qué falta
declarar fuera de este documento*) tiene que mencionar la analítica anónima y
cómo desactivarla. Un párrafo.

## 8. Las consultas

Se ejecutan en el SQL editor de Supabase. **Sin dashboard**: si dentro de seis
meses se miran todas las semanas, entonces se monta uno.

```sql
-- Embudo de onboarding (solo altas reales)
select props->>'paso' as paso, count(distinct device) as devices
from app_events
where name = 'onboarding_step'
  and device in (select device from app_events
                 where name = 'onboarding_start' and (props->>'primera')::bool)
group by 1 order by 2 desc;

-- Retención a 7 días
with primera as (select device, min(at)::date as d0 from app_events group by 1)
select round(100.0 * count(*) filter (where vuelve) / nullif(count(*), 0), 1) as pct_d7
from (
  select p.device, exists (
    select 1 from app_events e
    where e.device = p.device and e.at::date between p.d0 + 7 and p.d0 + 13
  ) as vuelve
  from primera p where p.d0 < current_date - 13
) t;

-- Mejora y adherencia por mes de vida del usuario
with primera as (select device, min(at) as d0 from app_events group by 1)
select floor(extract(epoch from e.at - p.d0) / 2592000) as mes_vida,
       count(*)                                          as pulsos,
       round(avg((e.props->>'mejora_pct')::numeric))     as mejora_media,
       round(avg((e.props->>'adherencia')::numeric))     as adherencia_media,
       round(avg((e.props->>'programas')::numeric), 1)   as programas
from app_events e join primera p using (device)
where e.name = 'progress_pulse'
group by 1 order by 1;
```

**El mes de vida se deriva en SQL, no lo manda el cliente.** `min(at)` por
`device` ya es la fecha de instalación: mandarlo sería guardar en el móvil un
dato que el servidor ya tiene y que además podría desincronizarse.

Esa última consulta es el titular: *"a los tres meses, el usuario medio mejora un
X%"*. Con tu dato, no con el de Google.

## 9. Fases

| # | Fase | Estado | Coste | Criterio de aceptación |
|---|---|---|---|---|
| A01 | Tubería: SQL, `analytics.js`, `app_open` | pendiente | 🟢 ~2 h | Dos arranques → dos filas con el mismo `device`. La anon key no puede hacer `select` |
| A02 | Los nueve eventos del recorrido | pendiente | 🟢 ~3 h | El recorrido de §5 deja sus ocho filas en orden y con el mismo `device` |
| A03 | `improvement.js` + su prueba + pulso mensual | pendiente | 🟡 ~4 h | `mejora_pct` coincide con la tarjeta MEJORA. Segundo arranque el mismo día → **no** hay segundo pulso |
| A04 | Interruptor, cuestionario y política | pendiente | 🟢 ~2 h | Interruptor off → cero filas nuevas. `app-store-privacidad.md` describe lo que hace el código |

Orden obligatorio: A01 antes que A02 y A03 (las dos usan `track`). A04 puede ir
en cualquier momento **pero antes de enviar a revisión**.

## 10. Descartado con motivo

- **Firebase GA4** y cualquier SDK de terceros — §1.
- **Flag `completed` en los programas** — §2. La adherencia del pulso separa
  completado de abandonado sin preguntarle nada al usuario.
- **Cubos en `mejora_pct`** — §6.2. Un entero promediado no identifica a nadie.
- **Pulso semanal** — §6.3. La métrica es lenta; multiplicaría las filas por 4.
- **Cola de eventos con reintento** — un evento perdido no cambia una media. Se
  añade si alguna vez esto sostiene una decisión de dinero, que hoy no.
- **Dashboard** — §8. Cuatro consultas no justifican una pantalla.
- **`app_open` desde `AppState`** — §4. No cambia ninguna respuesta.
- **Atribución de campañas / deferred deep linking** — obligaría a un SDK de
  atribución que tumba el *"no rastreamos"*. Ya descartado en
  [monetizacion.md](monetizacion.md).
