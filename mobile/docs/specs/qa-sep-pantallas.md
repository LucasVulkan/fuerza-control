# Spec — QA sep-2026: navegación, progreso y tipografía

> Tema: ui
> En corto: Cuatro arreglos de la ronda de QA del 22-sep-2026 que no son de conexión: atrás tras una sesión llevaba a una pantalla negra y el check del editor siempre iba a Sesiones; Progreso restaba kg de repeticiones; la gráfica de ejercicio pintaba un frame y saltaba; y la Barlow no salía en iPhone.
> Fase U24 · hecho · Volver a Main sin apilar otro Main (bugs 1 y 6) · §3
> Fase U25 · hecho · Progreso sin mezclar unidades (bug 7) · §4
> Fase U26 · hecho · La gráfica de ejercicio entra sin salto (bug 9) · §5
> Fase U27 · hecho · Barlow en iOS por su nombre PostScript (bug 3) · §6
>
> Estado: **spec cerrada, SIN implementar** (22-sep-2026). Fases independientes
> entre sí. U24, U25 y U26 tienen el origen confirmado leyendo el código; **U27
> no**: la causa no se encontró leyendo, y la fase aplica el camino documentado
> por Expo para fuentes embebidas, que no depende del mecanismo que falla. Su
> cierre necesita un build nuevo de EAS en iPhone.
> Los bugs 8 y 10 de la misma ronda quedan fuera por decisión del usuario. Los de
> conexión (2, 4, 5, 11, 12, 13, 14) están en [qa-sep-conexion.md](qa-sep-conexion.md).

## 0. Contexto para quien implemente

- App en `mobile/`. Leer `mobile/AGENTS.md` y `docs/UI-MIGRATION.md` antes de
  tocar pantallas. Ninguna fase cambia diseño: ni colores, ni radios, ni textos
  nuevos (salvo que se diga).
- Tests: `npx vitest run` desde la raíz. `react-native`, `expo-*` y
  `@react-navigation/*` están aliasados a un stub (`test/native-stub.js`): la
  navegación y los componentes **no** se prueban en vitest, los utils puros sí.
- Lint: `npx eslint <fichero>` comparando contra `HEAD`.
- Animaciones nuevas: Reanimated, no `Animated` de RN (memoria del proyecto). Esta
  spec **no** migra la gráfica: la arregla con lo que tiene.

## 1. Origen

QA en dispositivo, 22-sep-2026:

| Bug | Síntoma | Fase |
|---|---|---|
| 1 | Dar atrás en Home después de una sesión va a una pantalla negra | U24 |
| 6 | Editar el programa de un cliente y dar al check va a Sesiones, no a Clientes | U24 |
| 7 | Ejercicio sin peso y luego con peso: sesión 1 0 kg × 15/15/15, sesión 2 7,5 kg × 10 → "−36,5 kg" | U25 |
| 9 | Las gráficas de ejercicio se pintan un frame y luego saltan a la animación | U26 |
| 3 | La Barlow no carga en iOS (build de EAS con el último cambio de fuentes, subida a App Store) | U27 |

## 3. U24 — Volver a Main sin apilar

### 3.1 Qué falla

La app usa **React Navigation 7**. En la v7, `navigation.navigate('Main', …)`
desde una pantalla apilada **no vuelve** a la `Main` que ya está en la pila:
apila otra encima (`@react-navigation/routers` `StackRouter.js`, caso `NAVIGATE`:
solo busca la ruta existente si la acción lleva `pop: true`). El código se
escribió con la semántica de la v6; el comentario de `src/hooks/useEditorExit.js`
~l. 38 afirma lo contrario de lo que pasa.

Cuatro sitios apilan un `Main` duplicado:

| Sitio | Pila resultante |
|---|---|
| `SessionRecapScreen.jsx` ~l. 582, botón Listo | `[Main, Recap, Main]` |
| `WorkoutScreen.jsx` ~l. 461, rama sin pila (arranque tras matar la app) | `[Workout, Main]` |
| `useEditorExit.js` ~l. 42, el check de los 4 editores | `[Main, Editor…, Main]` |
| `navigateTo` en `src/navigation/navigationRef.js` (acción `navigate` del store; p. ej. `discardSession`) | `[Main, Workout, Main]` |

- **Bug 1**: atrás en Home desapila el `Main` de arriba y enseña lo que quedó
  debajo. Tras descartar es un `Workout` sin sesión: fondo oscuro y "Sin sesión
  activa" — la pantalla negra. Tras guardar es un recap viejo. Y cada sesión deja
  más capas.
- **Bug 6**: el check fuerza `{ screen: 'Home' }` (pestaña Sesiones) sin mirar
  desde qué pestaña se entró al editor.

### 3.2 Cambios

1. En `src/navigation/navigationRef.js`, un helper:

   ```js
   /**
    * Vuelve a Main desapilando lo que tenga encima. Con `params` elige pestaña;
    * sin ellos Main conserva la que tenía (el editor vuelve a donde se abrió).
    * Si Main no está en la pila (arranque en Workout tras matar la app), la pila
    * pasa a ser solo Main: apilarla dejaría debajo una pantalla muerta.
    * En React Navigation 7 `navigate` a una ruta ya apilada APILA otra: por eso
    * existe esto.
    */
   export function backToMain(navigation, params) {
     const inStack = navigation.getState()?.routes?.some((r) => r.name === 'Main');
     if (inStack) navigation.popTo('Main', params);
     else navigation.reset({ index: 0, routes: [{ name: 'Main', params }] });
   }
   ```

2. `SessionRecapScreen` (Listo): `backToMain(navigation, { screen: 'Home' })`.
3. `WorkoutScreen.handleGoBack`: se queda el `goBack()` cuando `canGoBack()`; la
   rama `else` pasa a `backToMain(navigation, { screen: 'Home' })`.
4. `useEditorExit.done`: `backToMain(navigation)` **sin params** → vuelve a la
   pestaña desde la que se abrió el editor (Clientes, Plantillas, Programa o
   Home). Corregir el comentario de ~l. 38.
5. `navigateTo` (store): para `Main`, la misma regla sobre la pila raíz
   (`navigationRef.getRootState()`): si está, `navigationRef.navigate(screen, params, { pop: true })`;
   si no, `navigationRef.reset({ index: 0, routes: [{ name: 'Main', params }] })`.
   Para el resto de vistas, `navigate(screen, params, { pop: true })`.

**Probar en dispositivo.** (1) Home → empezar sesión → guardar → Listo → atrás
(botón de Android): la app sale, no enseña el recap ni una pantalla negra. (2)
Igual pero descartando la sesión en vez de guardar. (3) Clientes → ficha →
editar programa → entrar a una sesión → check: vuelve a Clientes. (4) Pestaña
Programa → editar → check: vuelve a Programa. (5) Matar la app con una sesión a
medias, reabrir (arranca en Workout), atrás: Home, y atrás otra vez sale de la app.

## 4. U25 — Progreso sin mezclar unidades

### 4.1 Qué falla

En `src/components/stats/ProgressTab.jsx`, seis cálculos eligen la métrica
**sesión a sesión**: `computeValue(sets, 'kg') ?? computeValue(sets, 'reps')`.
`computeValue(…, 'kg')` devuelve `null` si el peso es 0, así que la sesión con
0 kg vale la **suma de repeticiones** (15+15+15 = 45) y la de 7,5 kg vale kilos:
delta = 7,5 − 45 = −37,5 (el −36,5 del informe sale igual si alguna serie fue de 14).

Sitios afectados (todos en `ProgressTab.jsx`):

| Función / valor | ~Línea | Efecto |
|---|---|---|
| `linearRegressionPct` | 145 | "Tendencia" de la tarjeta y **Mejora global** (`computeOverallImprovement`, 172) |
| `computeLastLoadDelta` | 299 | % de la última sesión en la cabecera |
| `computeExPR` | 332 | el récord compara repeticiones con kilos |
| `computeExSessionDeltas` | 350 | el "−36,5 kg" de la lista de sesiones del detalle |
| `lastSesLoadDelta` | 732 | la cifra bajo "Tendencia" del detalle |

`getMetrics` (99) ya decide bien la métrica **por serie** (`hasWeight` sobre todo
el historial del ejercicio); lo que rompe es el respaldo por punto.

Además `src/screens/ExerciseHistoryScreen.jsx` y
`src/components/charts/MiniLineChart.jsx` repiten el mismo código y son **código
muerto**: la ruta `ExerciseHistory` está registrada en `RootNavigator.jsx` (~l. 29
y 230) y nadie navega a ella.

### 4.2 Regla

1. **La métrica se decide una vez por ejercicio** y todos los puntos se calculan
   en ella: `time` si `progressionModel === 'time_progression'`; `reps` si
   `submax` o si ninguna serie del historial del ejercicio tiene peso; si no, `kg`.
   Nunca se cae a otra métrica en un punto suelto.
2. **En `kg`, 0 es un valor válido para los ejercicios de peso corporal**
   (`isBodyweight(def)` de `src/utils/trainingLoad.js`): significa "sin lastre".
   Así el caso del informe da **+7,5 kg**. En un ejercicio con carga (barra,
   máquina…) una sesión sin peso apuntado es `null`: hueco, no cero.
3. **Los deltas** solo se calculan entre dos valores no nulos (por la regla 1 son
   siempre de la misma unidad).
4. **Los porcentajes** sobre una base 0 dan `null` ("—"): no se inventa un número.
   Consecuencia: un ejercicio de peso corporal que pasa de 0 a 7,5 kg no suma a
   Mejora global. `// ponytail: base 0 → sin %. Si se quiere que cuente,
   porcentaje sobre peso efectivo (peso corporal + lastre, effectiveWeight de
   trainingLoad.js), que necesita el peso corporal en ProgressTab.`

### 4.3 Cambios

1. Nuevo `src/utils/improvement.js` (el nombre que ya reservó la fase A03 de
   [analitica.md](analitica.md) para sacar Mejora global de la pantalla; A03 queda
   en instrumentarla). Exporta, puras:
   `seriesMetric(logs, def)`, `metricValue(sets, metric, def)`,
   `linearRegressionPct(logs, def)`, `computeOverallImprovement(log, allExercises)`,
   `computeExPR(logs, def)`, `computeExSessionDeltas(logs, def, metricOverride)`,
   `lastSessionDelta(logs, def)`, `computeLastLoadDelta(log, allExercises)`.
   Se mueven desde `ProgressTab.jsx` aplicando §4.2; `ProgressTab` las importa.
   `getMetrics` se queda en la pantalla (lleva etiquetas i18n) pero usa
   `seriesMetric` para su `hasWeight`.
2. La gráfica (`chartData`, ~l. 763) usa `metricValue(sets, activeMetric, def)`:
   el punto de 0 kg de un ejercicio de peso corporal aparece en la línea.
3. Borrar `ExerciseHistoryScreen.jsx`, `components/charts/MiniLineChart.jsx` y su
   registro en `RootNavigator.jsx`. Comprobar con `grep` que nada más los importa.

### 4.3-bis Lo que cambió al implementar (23-sep-2026)

- `linearRegressionPct` y `lastSessionDelta` aceptan la métrica como tercer
  argumento. El detalle del ejercicio la decide sobre todo el alcance
  (`effectiveLogs`) y no sobre el periodo, para que "Tendencia" y el selector de
  la gráfica hablen la misma unidad; la fila de la lista hace lo mismo.
- `computeLastLoadDelta` decide la métrica de cada ejercicio sobre el par de
  sesiones que compara: es todo el historial que tiene a mano.
- `getExerciseLogsFrom` se mudó también a `improvement.js` (la necesita
  `computeOverallImprovement`); `computeExerciseImprovement` desaparece, era un
  alias.
- La ficha de transparencia "Mejora" (`metrics.loadTrend.rules`) cuenta la regla
  y que un ejercicio de peso corporal que empieza sin lastre no suma.

### 4.4 Tests (`src/utils/improvement.test.js`)

- El caso del informe con un `def` de peso corporal: sesión 1 `0 kg × 15/15/15`,
  sesión 2 `7.5 kg × 10` → `seriesMetric === 'kg'`, delta de la sesión 2 = +7.5.
- El mismo historial con un `def` de barra: la sesión 1 es `null` y el delta de la
  2 es `null` (no −37,5 ni +7,5).
- Ejercicio sin ninguna serie con peso → métrica `reps`, delta en repeticiones.
- `computeExPR` nunca devuelve un récord en `reps` para un ejercicio cuya serie es `kg`.
- `linearRegressionPct` con base 0 → `null`; con 100 → 110 kg → 10.
- `computeOverallImprovement` ignora los ejercicios con `null`.

**Probar en dispositivo.** Registrar un puente de glúteo a 0 kg y en otra sesión
con 7,5 kg: el detalle del ejercicio dice +7,5 kg, la gráfica en KG tiene dos
puntos, y Mejora global no se mueve de forma absurda.

## 5. U26 — La gráfica de ejercicio entra sin salto

### 5.1 Qué falla

Dos causas que se suman (en `MiniLineChart` de `ProgressTab.jsx`, ~l. 373):

1. **`useWeightUnit` devuelve funciones nuevas en cada render**
   (`src/hooks/useWeightUnit.js`). `chartData` (~l. 763) tiene `wDisplay` en sus
   dependencias, así que es un array nuevo en **cada** render del modal, y el
   efecto `[data, chartW]` de la gráfica (y el `setSelected(null)`) se relanza sin
   parar. Lo mismo invalida cualquier `useMemo` de la app que dependa de `fmt` o
   `toDisplay`.
2. **El estado inicial de la animación se fija en un `useEffect`**, que corre
   DESPUÉS de pintar. Al cambiar de serie (métrica, periodo, ámbito, ejercicio o
   modo %), el primer frame pinta la geometría nueva con el recorte viejo (a
   ancho completo) y las `y` viejas; luego el efecto colapsa el recorte y anima.
   Es el "se pinta un frame y salta".

### 5.2 Cambios

1. `useWeightUnit`: envolver lo que devuelve en `useMemo` con `[unit]` (las
   funciones dentro del memo). Mismo contrato.
2. En `ExerciseDetailModal`, darle a la gráfica una `key` que identifique la serie:
   `key={`${activeId}|${activeMetric}|${modalPeriod}|${modalScope}|${pctMode}`}`.
   Una serie nueva se monta de cero con el recorte en 0 (valor inicial del
   `Animated.Value`), así que no hay frame con geometría vieja. Los efectos de la
   gráfica no se tocan.

Confianza media: el diagnóstico sale de leer el código, no de verlo.

**Probar en dispositivo.** Abrir el detalle de un ejercicio con >2 sesiones y
cambiar entre KG / Reps / Vol / 1RM y entre periodos: cada cambio dibuja la
línea de izquierda a derecha sin un frame previo con la gráfica completa. Si el
salto persistiera **solo al abrir** el detalle, el siguiente sospechoso es que
`onLayout` dispare dos veces con anchos distintos (relanza la animación del recorte).

## 6. U27 — Barlow en iOS

### 6.1 Qué se sabe

- La Barlow (`BarlowCondensed_800ExtraBold_Italic`) solo la usan los papeles
  `heroGlyph`/`heroName` de `src/theme.js` (~l. 126-136): la letra y el nombre de
  la sesión de hoy en Home.
- Está embebida por el plugin `expo-font` (`app.json`, lista `fonts`) y además se
  carga en runtime con `useFonts` (`App.js`). Inter usa exactamente el mismo
  camino y **sí** sale en iPhone. Según el usuario, el build de App Store incluye
  el último cambio de fuentes (`777bdbd`).
- En iOS, `fontFamily: 'BarlowCondensed_800ExtraBold_Italic'` no es un nombre que
  iOS conozca: depende de que `expo-font` registre un **alias** en runtime
  (`FontFamilyAliasManager` + el swizzle de `fontNames(forFamilyName:)`). Leyendo
  `expo-font` 14.0.12 y `RCTFontUtils.mm` de RN 0.81 no aparece por qué fallaría
  solo con esta fuente. Nombres internos del `.ttf` (tabla `name`): PostScript
  `BarlowCondensed-ExtraBoldItalic`, familia tipográfica `Barlow Condensed`.

### 6.2 Cambio

Usar en iOS el **nombre PostScript**, que es como Expo documenta referenciar una
fuente embebida con el plugin en iOS y que RN resuelve con
`UIFont(name:)` sin pasar por el alias:

```js
// iOS resuelve una fuente embebida por su nombre PostScript; el alias que crea
// useFonts es lo que fallaba en iPhone (docs/specs/qa-sep-pantallas.md §6).
const BARLOW = Platform.select({
  ios:     'BarlowCondensed-ExtraBoldItalic',
  default: 'BarlowCondensed_800ExtraBold_Italic',
});
```

`Platform` desde `react-native` (el stub de los tests lo trae; comprobar que
`src/theme.test.js` sigue en verde). Android no cambia.

### 6.3 Cierre

Solo se puede verificar con un build nuevo de EAS instalado en iPhone
(TestFlight). Si la Barlow sigue sin salir, la fuente no está en el binario:
comprobar `UIAppFonts` en el `Info.plist` del build y que el `.ttf` va dentro del
`.ipa`.

**Probar en dispositivo.** iPhone con build nuevo: la letra y el nombre de la
sesión de hoy en Home salen en Barlow Condensed cursiva, igual que en Android.

## Fases

| Fase | Qué | Estado | Coste |
|---|---|---|---|
| U24 | `backToMain` + 4 llamadas; además la pila nunca nace con Workout como raíz (el atrás de Android cerraba la app) | ✅ `9d30ca3` · `4cb0a4f` — probada en dispositivo 22-sep | 🟢 |
| U25 | `utils/improvement.js` con la regla de métrica por serie + borrar código muerto | ✅ `e850382` — pendiente de probar en dispositivo | 🟡 |
| U26 | `useWeightUnit` memoizado + `key` de serie en la gráfica | ✅ `1b1931d` — pendiente de probar en dispositivo | 🟢 |
| U27 | Nombre PostScript en iOS + build EAS | ✅ `16ee9be` — código hecho; pendiente de build EAS en iPhone | 🟢 código · build aparte |
