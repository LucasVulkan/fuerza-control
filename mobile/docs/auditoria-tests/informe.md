# Auditoría de los tests — informe de I01-01

> Spec: [I01-integridad-y-tests.md](../specs/I01-integridad-y-tests.md) §3. Hecho el 26-oct-2026
> sobre `develop` `221ccdb`, rama `test/i01-01-auditoria-tests`. No se tocó código de la app.

## En corto

- **Puntuación de mutación de la lógica pura (16 ficheros de `utils/`): 76,6 % → 78,8 %** tras 50 tests
  nuevos. Quiere decir que, de cada 100 fallos pequeños que se le meten al código a propósito, unos 21
  pasan sin que ningún test se entere.
- **No apareció ningún fallo de código (c).** Ni en los 321 mutantes de la progresión, ni en los 77 de
  1RM, gris, calentamiento y etapas, ni en el historial. No hay altas nuevas en
  `auditoria-tecnica.md` (el siguiente libre sigue siendo E72).
- **El historial está limpio de «tests ajustados para pasar»:** de 45 `expect` que cambiaron en el
  mismo commit que su código, ninguno cambió de valor sin una spec o una decisión detrás. Sí hay **5
  aserciones que se debilitaron o se borraron**, y una de ellas destapa una **contradicción entre specs**
  (C03 §9 contra C03 §9.1/§9.2 y P08 §5.3) que tienes que decidir tú.
- **Las tablas de casos del oráculo están escritas y PENDIENTES DE FIRMA:** 319 filas en 6 módulos,
  sacadas solo de las specs, con 38 filas dudosas y una lista de preguntas por módulo
  ([tablas-de-casos.md](tablas-de-casos.md)). Hasta que las firmes no se contrastan con el código.
- El hueco más grande no es un fichero, es un patrón: **los tests de la progresión pasan `t = () => ''`**
  y 58 de ellos solo miran `chip.type`. Los 90 mutantes de texto que sobreviven en `progression.js` son
  eso: nadie comprueba qué motivo o qué frase ve el usuario.

## 1. Mutaciones (§3.1)

**Herramienta.** Stryker 10.1.1 (`@stryker-mutator/core` + `vitest-runner`, solo devDependency). Sí
soporta la vitest 4.1.8 del repo (pide vitest ≥ 2). Dos ajustes para Windows y este repo, los dos en
`stryker.config.mjs`:

- `inPlace: true`: la copia aislada (sandbox) no ve `mobile/node_modules` y los tests que importan el
  store caen. In place, Stryker restaura solo al acabar; si se corta a medias,
  `git checkout mobile/src/utils` deja el código como estaba.
- `vitest.mutacion.config.mjs` limita la ejecución a `mobile/src/utils/**/*.test.js` (1,2 s). Con la
  suite entera la pasada inicial tardaba 3,5 min y el runner se caía. **Límite conocido:** un mutante
  que solo matarían los tests del store cuenta aquí como superviviente; la cifra real puede ser algo
  más alta. Se amplía `include` cuando se mute el store (segunda pasada).

**Cómo correrlo** (≈ 5 min los 16; ≈ 15 s uno):

```
npm run mutacion
npm run mutacion -- --mutate mobile/src/utils/oneRm.js
```

Informe JSON en `reports/mutation/mutation.json` (ignorado por git).

### Tabla por fichero

Tests y `expect` contados antes de añadir los nuevos. «b» = huecos reales (falta un test); «b?» = la
spec no fija el resultado (no se escribe test: va a la tabla de casos); «c» = fallo de código.

| Fichero | Tests | `expect` | Mutación antes | Después | b | b? | c | Olores |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| progression | 142 | 230 | 70,9 % | **75,0 %** | 58 | 63 | 0 | 58 tests solo `chip.type` con `t` vacío; 90 mutantes de texto invisibles; 1 esperado calculado con el propio código (`progression.test.js:731`); `summarizeSets` sin ningún test |
| progressionForm | 20 | 50 | 82,4 % | **95,5 %** | 26 | 1 | 0 | — |
| setPlan | 25 | 39 | 91,4 % | **94,6 %** | 3 | 0 | 0 | — |
| oneRm | 20 | 27 | 78,8 % | **87,4 %** | 16 | 2 | 0 | 1 esperado calculado con otra función del módulo (`oneRm.test.js:99`) |
| warmup | 16 | 21 | 90,0 % | 90,0 % | 4 | 1 | 0 | — |
| stageProgress (+ `.weeks`) | 99 | 157 | 88,7 % | **90,7 %** | 9 | 0 | 0 | 1 test de blob ajeno debilitado (§2, C5) |
| weekProgress | 3 | 7 | 96,3 % | 96,3 % | 0 | 0 | 0 | — |
| stageRx | 42 | 92 | 77,3 % | — | sin clasificar | | | 1 `toBeTruthy/Defined/Falsy` |
| trainingLoad | 83 | 134 | 74,4 % | — | sin clasificar | | | — |
| weeklyVolume | 23 | 34 | 72,2 % | — | sin clasificar | | | 1 aserción débil |
| prescription | 20 | 40 | 86,6 % | — | sin clasificar | | | 1 test borrado sin reemplazo (§2, C2) |
| sessionPlan | 22 | 41 | 86,0 % | — | sin clasificar | | | aserción en negativo (§2, C4) |
| adherence | 22 | 29 | 76,3 % | — | sin clasificar | | | — |
| improvement | 8 | 19 | **59,4 %** | — | sin clasificar | | | el más flojo de todos: 38 mutantes sin cobertura |
| clientLogs | 17 | 27 | 87,7 % | — | sin clasificar | | | 1 aserción débil |
| programOwnership | 11 | 18 | 76,1 % | — | sin clasificar | | | — |
| **Total (16)** | | | **76,6 %** | **78,8 %** | | | **0** | |

Meta de referencia de la spec (≥ 80 % en `progression`, `setPlan`, `oneRm`, `stageProgress`): la
cumplen `setPlan`, `oneRm` y `stageProgress`; **`progression` se queda en 75 %**. Lo que le falta es
sobre todo b? (63 mutantes cuyo resultado no fija la spec: necesitan la tabla firmada) y los textos.

**Clasificación hecha** para los seis ficheros de arriba (los de fórmula que la spec pone como meta, más
`warmup` y `weekProgress`), 398 mutantes. Los otros diez quedan con su puntuación y su lista en bruto
([supervivientes.txt](supervivientes.txt)), **sin clasificar**: es la segunda pasada.

Detalle mutante a mutante:
- [mutantes-progression.md](mutantes-progression.md): `progression` y `progressionForm` (a 53 · n 30 ·
  texto 90 · b 84 · b? 64 · c 0).
- [mutantes-oneRm-setPlan-warmup-stageProgress.md](mutantes-oneRm-setPlan-warmup-stageProgress.md).

Clases usadas, además de las tres de la spec: **n** (solo protege de un null: `?.` → `.`; el mutante
cambia un valor por defecto por un error, sin test salvo que la spec lo pida) y **texto** (claves i18n
que los tests no ven por el `t` vacío).

### Tests nuevos (§3.5)

50 tests en un `describe('I01-01 — huecos de mutación')` al final de cada fichero: oneRm 11, setPlan 4,
warmup 1, stageProgress 6, progression 17, progressionForm 11. Cada uno lleva la cita de la spec y el
mutante que mata, y su esperado es un literal. **Verificados**: pasan contra el código real y Stryker
da su mutante como muerto. Se quitaron tres que congelaban algo que la spec no dice (RPE medio con
series sin RPE, reps negativas, calentamiento con todo a 0 kg): son b? y van a la tabla de casos.

Los 16 de `summarizeSets` y los 63 b? de `progression` quedan sin test a propósito.

## 2. Arqueología del historial (§3.2)

Script: `node scripts/arqueologia-tests.mjs [ruta.test.js …]`. Saca los commits donde un `expect` cambió
en el mismo commit que su fuente, siguiendo también la ruta vieja (`src/utils/`, antes del traslado a
`mobile/`). Sobre los `*.test.js` de `utils/`: **45 casos**, revisados uno a uno contra la spec en
[historial.md](historial.md).

| Clase | Nº | Qué significa |
|---|---:|---|
| A | 34 | cambio de comportamiento pedido por una spec o una decisión citada: el test mejoró |
| B | 6 | solo forma (renombre, campo añadido) |
| C | 5 | aserción debilitada o borrada |

**Ningún valor esperado cambió sin una razón escrita.** Los cinco C:

1. **`stageProgress` · `bee36e2` (media).** Se borró el test «activar la etapa donde el cliente YA está no
   le borra las semanas». Hoy `mergeProgressOnImport` reinicia la etapa ante **cualquier** sello nuevo,
   aunque sea la etapa en la que ya está. **Las specs se contradicen:** C03 §9 dice que eso «no cuenta
   como movimiento»; C03 §9.2 (escrita en el mismo commit) y P08 §5.3 dicen que activar sirve para
   «repetir un bloque», que pide justo el reinicio. **No es un fallo de código hasta que decidas cuál
   manda** (es también la pregunta LK-13 del oráculo).
2. **`prescription` · `2b31670` (leve).** Se borró `targetLabel({}, {sets: 2, minReps: 10})` → `2 × 10
   reps`. Hoy da `2 × 10–12 reps` y nada lo cubre.
3. **`sessionCompression` · `5ac7a79` (leve).** `toHaveLength(4)` pasó a `toBeLessThan(…)`: un fallo que
   borre ejercicios de más seguiría en verde.
4. **`sessionPlan` · `bf91f58` (leve).** `toBe('a')` pasó a `not.toBe('a')` cuando lo correcto es `'b'`;
   y el test sigue pasando `activeTemplateId`, que la función ya no lee.
5. **`stageProgress` · `9aef98a` (leve).** «Rechaza un blob ajeno» solo mira `stageSessionsDone`, no
   `currentStageIndex`.

Además: P12 §4.2 sigue escribiendo `{{need}}` en el texto de `why_partHit`, y el código usa `hit` desde
`4df386a` (spec desactualizada).

## 3. Oráculo independiente (§3.3)

Un agente **sin acceso al código** (solo las nueve specs de la tabla de §3.3) escribió
[tablas-de-casos.md](tablas-de-casos.md):

| Módulo | Filas | Dudosas |
|---|---:|---:|
| 1 Progresión (motor, esfuerzo, gris, hoja) | 92 | 5 |
| 2 1RM | 25 | 3 |
| 3 Calentamiento | 25 | 6 |
| 4 Avance de etapa (semanas, bloqueos, sesión que toca) | 63 | 5 |
| 5 Prescripción de etapa | 57 | 8 |
| 6 Carga y volumen semanal | 57 | 11 |

**Estado: PENDIENTES DE FIRMA. Ninguna está firmada.** Pasos 3 y 4 de §3.3 (contrastar con el código y
llevar la tabla a la sección `## Casos` de cada spec) esperan a la firma. Las preguntas que más mueven
resultados:

1. **Salto por defecto del peso.** P12 §2.2 dice «el salto por defecto es `weightStep`» y P10 §5.3 da
   `weightStep` 5 a sentadilla y press con barra, pero la prueba de P12-03 dice «press banca 12/12/12 con
   60 kg → subir a 62,5».
2. **Redondeos con empate sin regla:** `incrementScale` 0,5 sobre salto 2,5; `missingWeeks` = 0,5; 70 %
   de 62,5 kg = 43,75 en el calentamiento.
3. **Repetir la misma sesión:** P08 §5.3 dice que repetir A doce veces «no termina antes» la etapa, pero
   en la última semana cumple `done ≥ expected` y daría `earlyReady`.
4. **Sello nuevo con la misma etapa** (el C1 de arriba).
5. **1 repetición:** `weightForReps` devuelve el 1RM tal cual (P10 §2.2) y la fórmula de T02 daría
   peso × (1 + 1/30). La ida y vuelta no cierra en ese punto.

Sugerencia para firmar sin que pese: **una subtabla cada vez, empezando por 1A (motor) y 2 (1RM)**, que
son las que deciden el peso que se pide.

**No hecho:** el agente «adversario» de §3.3 punto 5 (entradas para romper cada módulo). Tiene más
sentido después de la firma, contra las tablas firmadas.

## 4. Catálogo de olores (§3.4)

Sobre los 76 `*.test.js` del repo (2.219 tests al correr, 3.542 `expect`):

| Olor | Hoy | Qué hacer |
|---|---|---|
| Solo `chip.type` con `t = () => ''` | 58 en `progression.test.js` | Ampliar a peso, reps y `why`; con un `t` que devuelva la clave (como ya hace el bloque P56 con `tk`) los 90 mutantes de texto pasan a ser visibles |
| Esperado calculado con el propio código | 2 claros: `progression.test.js:731` (`toEqual(getProgression(…))`), `oneRm.test.js:99` (`e1rmAtLeast` contra `epley1RM`) | Reescribir con el literal de la tabla firmada. Otros 4 (`autoLink`, `identityColor`, `programSignature` ×2, `stageProgress.weeks:261`) son comparaciones de determinismo o equivalencia: legítimos |
| `toHaveBeenCalled()` sin argumentos | 38 | Comprobar con qué se llamó (casi todos en tests del store) |
| `toBeTruthy/Defined/Falsy()` | 102 | Comparar el valor cuando es concreto (3 en los ficheros auditados) |
| `.skip` / `.todo` / `.only` / snapshots | 0 | Bien |
| Unidad probada mockeada | 0 en `utils/` (ningún `vi.mock`) | — |

**`catch` silenciosos en la ruta de datos** (`store/` y `src/utils/`, 37 `catch` revisados):

| Sitio | Qué se traga | Decisión propuesta (I01-06 §8.2) |
|---|---|---|
| `store/useStore.js:2828` (`saveSession`) | un error de `getProgression` → se guarda sin chip | relanzar en test/dev |
| `src/utils/sessionText.js:37` (`todayWeight`) | ídem → el texto de WhatsApp lleva el último peso | relanzar en test/dev |
| `src/components/workout/ExerciseCard.jsx:167` | ídem → la tarjeta sale «sin chip» | relanzar en test/dev |
| `store/useStore.js:5553` (rehidratar) | una migración que falla arranca con lo cargado, solo `console.warn` | justificar (no tumbar el arranque), pero contarlo en dev |
| `store/useStore.js:3670`, `3689`, `4796`, `5728` | red y Drive (config ilegible, carpeta, sin red, reintento) | justificados: no son datos del usuario |

El resto (`createClient`, `deleteClient`, RevenueCat, exportar, compartir…) avisa con toast,
`console.warn` o devuelve un error: no son silenciosos.

**Tres copias del chip que ya no son iguales.** `saveSession` y `ExerciseCard` pasan el historial
(`progressionHistory`) a `getProgression`; `sessionText.todayWeight` **no**. Hoy solo cambia algo en Por
esfuerzo y no se encontró un caso en que el peso del texto salga distinto (el peso de partida es el de la
última sesión en los dos caminos), así que **no se registra como fallo**; es el argumento de I01-06 §8.1
para una sola función.

## 5. Acciones que salen de aquí

1. **Firmar las tablas de casos**, por subtablas (tú). Luego contrastarlas con el código y llevarlas a
   la sección `## Casos` de cada spec (§3.3 pasos 3-4).
2. **Decidir el C1** (sello nuevo con la misma etapa: ¿reinicia o no?) y escribir el test.
3. Segunda pasada de mutación: clasificar los diez ficheros sin clasificar, empezando por `improvement`
   (59 %) y `trainingLoad` (74 %, 159 supervivientes); y mutar el store por zonas con `include` ampliado.
4. Tests para `summarizeSets` (ninguno hoy) y cambiar `t = () => ''` por un `t` que devuelva la clave en
   `progression.test.js`.
5. Reponer las aserciones debilitadas C2-C5 del historial.
