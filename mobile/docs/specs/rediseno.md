# Spec — Rediseño estructural: una sola app, un estado que no se reescribe entero

> Estado: **fase 1 IMPLEMENTADA** (2-sep-2026, dos commits); fase 2 sin
> implementar. Cuatro fases. Las fases **1 y 2 son ejecutables en frío** desde
> este documento; las fases 3 y 4 son decisiones de producto que hay que tomar
> **antes de publicar**, no código.
>
> Origen: análisis de arquitectura sobre el repo completo (sep 2026). No es una
> auditoría de corrección —esa es [auditoria-tecnica.md](auditoria-tecnica.md),
> con 15 de 26 fallos cerrados y ninguno crítico pendiente— sino de **estructura**:
> por qué encontrar un fallo cuesta lo que cuesta, y qué dos cambios lo bajan.
>
> **Ventaja de partida:** la app no está publicada. No hay retrocompatibilidad
> que respetar ni datos de usuarios reales que migrar. Las dos fases se pueden
> hacer sin escribir una sola migración.
>
> **Verificación** (las dos fases): `npx vitest run` desde la raíz y
> `npx eslint <fichero>` comparando el recuento contra HEAD — hay errores
> preexistentes, la regla es no añadir ninguno.

---

## 0. Qué resuelve y qué no

| Fase | Qué hace | Toca pantallas | Coste |
|---|---|---|---|
| **1** | Borra la app web y trae el motor compartido dentro de `mobile/` | no | 1 sesión |
| **2** | Saca la sesión en curso del blob persistido | no | 1 sesión |
| **3** | Recortes de features a decidir antes de publicar | sí | decisión |
| **4** | Terminar Workout y publicar | sí | ya en curso |

Las fases 1 y 2 **no cambian ni una pantalla ni un comportamiento visible**.
Son las dos únicas de esta lista que se pueden hacer sin decidir nada de
producto, y las dos que hacen más barato todo lo que venga después.

Lo que esta spec **no** toca, a propósito: el modelo de programas
(`programs` / `userPrograms` / `sessionTemplates` / `clients`), el motor de
plantillas, y el modelo de etapas. Son preguntas abiertas de diseño, no
mecánica — ver §6.

---

## 1. Los dos hechos que justifican las fases 1 y 2

### 1.1 Hay dos aplicaciones y un solo motor

| Pieza | LOC | Último commit propio |
|---|---|---|
| App móvil (`mobile/src`, `mobile/store`) | ~35.500 | vivo |
| **App web** (`src/components`, `src/store`, `src/hooks`) | **~9.825** | **2026-05-21** |
| Motor compartido (`src/utils`, `src/data`) | ~10.990 | vivo, lo consume el móvil |

La app web lleva más de tres meses congelada, pero:

- Sigue teniendo **su propia copia del store** (`src/store/useStore.js`, 2.038
  líneas, 87 acciones) con los mismos fallos que el móvil ya arregló. La
  auditoría tuvo que escribir un párrafo de alcance sólo para excluirla
  ([auditoria-tecnica.md](auditoria-tecnica.md), cabecera).
- Sigue arrastrando el `package.json` de la raíz: `react-dom`, `tailwindcss`,
  `@tailwindcss/vite`, `recharts`, `@dnd-kit/*` ×3, `@vitejs/plugin-react`.
  Nada de eso lo usa el móvil ni los tests.
- Obliga a que el motor viva **fuera** de la app que lo usa, resuelto por
  `watchFolders` en [mobile/metro.config.js](../../metro.config.js) y por rutas
  de import de hasta cuatro niveles (`'../../../../src/utils/...'`).

El coste real no es el disco: es que cada arreglo empieza con "¿en cuál de los
dos?".

### 1.2 Todo el estado es un documento que se reescribe en cada tecla

[mobile/store/useStore.js:3885](../../store/useStore.js) mete bajo **una sola
clave** de AsyncStorage (`fc_tracker_v1`): `profile`, `workoutLog`,
`clientLogs` (el historial de *todos* los clientes), `programs`,
`sessionTemplates`, `userPrograms`, `clients`, `customExercises`,
`blockPresets`, `tagRegistry`, `driveBackup`, `trainerSync`, `clientSync` y
`activeSession`.

Y `zustand/persist` **escribe en cada `set()`, sin comparar nada**. Verificado
en `node_modules/zustand/middleware.js:360`:

```js
const setItem = () => {
  const state = options.partialize({ ...get() });
  return storage.setItem(options.name, { state, version: options.version });
};
const savedSetState = api.setState;
api.setState = (state, replace) => {
  savedSetState(state, replace);
  return setItem();          // ← incondicional
};
```

El camino caliente:

```
tecla en el campo de peso
  → SetRow onChangeText
  → ExerciseCard onFieldChange            (ExerciseCard.jsx:810)
  → store.updateSetField                  (useStore.js:1727)
  → set()
  → partialize({...todo el estado})
  → JSON.stringify(todo)
  → AsyncStorage.setItem
```

Tamaño medido con datos propios: [fc-seed-carga.fitdata](../../../fc-seed-carga.fitdata)
son 42 sesiones en 93 KB → **~2,2 KB por sesión registrada**. Un usuario a 3
días/semana durante un año son ~330 KB. Un entrenador con 15 clientes cuyo
historial se descarga a `clientLogs` pasa de 4 MB. **Eso es lo que se serializa
y se escribe en cada pulsación de tecla durante una sesión.**

Es además la forma de los dos fallos críticos ya cerrados (el 1 y el 2 de la
auditoría): cuando todo el estado es un único documento, cualquier escritura o
lectura mala se lo lleva entero.

---

## 2. Fase 1 — Borrar la app web y traer el motor a `mobile/`

> **Revisada contra el código (2-sep-2026).** La mecánica se verificó entera —
> las tres reglas de §2.3 se simularon sobre las **78** ocurrencias reales y
> salieron 78/78 correctas— y la spec se parcheó con seis cosas que faltaban:
> la dependencia inversa de `clientSync.sim.test.js` (§2.3), que
> `src/data/programs.js` es web-only y se **borra** en vez de moverse (§2.1),
> `public/` y el `README.md` (§2.1), el `.claude/launch.json` (§2.4), qué es
> versionado y qué no (§2.1), y los números (30 ficheros, no 28).
>
> Motivo de fondo, medido: el store web tiene **53 referencias a `userPrograms`
> y 38 a `.days`**, las dos cosas que `a851a3c` y `8d9af4d` eliminaron del
> modelo. La app web ya no compila contra el motor actual. No hay nada que
> preservar.
>
> **Se hace en dos commits**, no en uno: el primero es borrado puro y no toca
> ni un import (tests verdes, la app arranca igual); el segundo muda el motor.
> Así hay un punto de bisect limpio entre "se borró la web" y "se movió el
> motor".

### 2.1 Qué se borra

```
src/components/        (todas las vistas web)
src/hooks/
src/store/useStore.js  (la copia web del store)
src/App.jsx  src/App.css  src/main.jsx  src/index.css
src/i18n.js            (el móvil tiene el suyo en mobile/src/i18n.js)
src/assets/
src/utils/storage.js   (sólo lo usa el store web)
src/data/programs.js   (sólo lo usa el store web — ver aviso abajo)
src/version.js         (no lo importa nadie — comprobado)
index.html
public/                (favicon.svg, icons.svg, manifest.json — sólo index.html)
README.md              (la plantilla de Vite; es la puerta de entrada del repo)
dist/                  (1,3 MB de build web)
mockups-home.html
setup.sh
```

⚠️ **`src/data/programs.js` (129 líneas) es web-only.** Su único importador es
`src/store/useStore.js:18`. Va en el borrado, **no** en el `git mv src/data` de
§2.2. Dos sitios afirman lo contrario y hay que corregirlos de paso — ver §2.5.

**Qué está versionado y qué no.** `dist/` y `mockups-home.html` están en
`.gitignore`: borrarlos es limpieza de disco y **no sale en el diff**. Sí están
versionados —y sí salen— `index.html`, `public/`, `setup.sh` y `README.md`.

`devpanel.mjs`, `seed-load-data.mjs` y `scripts/estado.mjs` **se quedan**:
`npm run seed` es la única forma de generar historial de prueba para la vista
de Carga, y `npm run estado` genera `docs/estado.html` desde las specs.
`devpanel.mjs` sólo lanza `npm test` y comandos de git, así que no se entera.

### 2.2 Qué se mueve

Sin colisiones de nombre — comprobado contra los ficheros que ya viven en
`mobile/src/utils/`:

```bash
git mv src/utils/*   mobile/src/utils/     # incluye sus .test.js colocados
git mv src/data      mobile/src/data
git mv src/locales   mobile/src/locales
```

Los imports **entre** los ficheros movidos no cambian: `archetypeAdapter.js`
importa `./slotResolver` y `../data/exerciseLibrary`, y las dos rutas siguen
siendo válidas después del movimiento porque `utils` y `data` se mueven juntos
y a la misma profundidad relativa.

### 2.3 Reescritura de imports — 30 ficheros, dos reglas y una excepción

Son **30** ficheros (26 bajo `mobile/src`, 4 bajo `mobile/store`) y **78**
ocurrencias. Los comandos son GNU: **lánzalos desde Git Bash**, no desde
PowerShell — no hay `sed -i` ni `xargs` ahí.

La regla general: todo import que hoy sube hasta la raíz del repo (`(../)ⁿ src/`)
tiene que apuntar ahora a `mobile/src/`, que está **dos niveles por debajo** de
la raíz.

**Ficheros bajo `mobile/src/**`** — se quitan dos `../` y el segmento `src/`
(el orden importa: la regla más larga primero):

```bash
grep -rl "from '\(\.\./\)\{2,\}src/" mobile/src \
  | xargs sed -i "s|'\.\./\.\./\.\./\.\./src/|'../../|g; \
                  s|'\.\./\.\./\.\./src/|'../|g; \
                  s|'\.\./\.\./src/|'./|g"
```

**Ficheros bajo `mobile/store/`** (`useStore.js` y sus dos tests) — se quita un
solo `../`, porque `mobile/store` no cuelga de `mobile/src`:

```bash
sed -i "s|'\.\./\.\./src/|'../src/|g" mobile/store/*.js
```

Resultado esperado por fichero:

| Fichero | Antes | Después |
|---|---|---|
| `mobile/store/useStore.js` | `'../../src/utils/progression'` | `'../src/utils/progression'` |
| `mobile/src/i18n.js` | `'../../src/locales/es.json'` | `'./locales/es.json'` |
| `mobile/src/screens/HomeScreen.jsx` | `'../../../src/utils/stageLocks'` | `'../utils/stageLocks'` |
| `mobile/src/components/workout/ExerciseCard.jsx` | `'../../../../src/utils/warmup'` | `'../../utils/warmup'` |
| `mobile/src/tasks/driveBackupTask.js` | `'../../../src/utils/backupPayload'` | `'../utils/backupPayload'` |
| `mobile/src/utils/sessionStats.js` | `'../../../src/utils/progression'` | `'../utils/progression'` |

(La última la resuelve el `sed` como `'../utils/progression'`, no como
`'./progression'`. Las dos apuntan al mismo fichero; no se toca a mano.)

**La excepción — la única dependencia inversa del repo.**
[src/utils/clientSync.sim.test.js:27](../../../src/utils/clientSync.sim.test.js)
importa hacia `mobile/`, no desde él:

```js
import { assignActiveProgram } from '../../mobile/src/utils/programOwnership';
```

No empieza por `(../)ⁿsrc/`, así que **ninguna de las dos reglas la toca**, y
después del `git mv` apunta a `mobile/mobile/src/…`. Se arregla a mano, y es lo
primero que `vitest` cazará si se olvida:

```js
import { assignActiveProgram } from './programOwnership';
```

**Comprobación de que no queda ninguno:**

```bash
grep -rn "'\(\.\./\)\{2,\}src/" mobile --include=*.js --include=*.jsx
```

Debe devolver **cero** resultados. Ojo: la comprobación no puede ser
`grep "src/utils"` a secas —como decía esta spec antes de ejecutarse— porque
`mobile/store/*` importa `'../src/utils/…'` **por diseño**, y eso es
`mobile/src/utils`. Lo que tiene que desaparecer son las rutas de **dos o más**
`../`, que son las únicas que salían del repo.

### 2.4 Los seis ficheros de configuración que cambian

1. **[mobile/metro.config.js](../../metro.config.js)** — desaparece la razón de
   ser de `watchFolders` y de la ruta de `node_modules` de la raíz:

   ```js
   const config = getDefaultConfig(__dirname);
   // react-native-svg 15.x ships TypeScript source with no `exports` field.
   config.resolver.unstable_enablePackageExports = false;
   module.exports = config;
   ```

2. **`package.json` (raíz)** — se queda sólo con lo que necesitan vitest y
   eslint. Fuera: `react`, `react-dom`, `react-i18next`, `i18next`, `zustand`,
   `tailwindcss`, `@tailwindcss/vite`, `recharts`, `@dnd-kit/*`, `vite`,
   `@vitejs/plugin-react`, `@types/react*`. Fuera también los scripts `dev`,
   `build`, `preview`.

   ⚠️ El store se importa desde vitest y arrastra `zustand`, `i18next` y
   `react-i18next`. La resolución de Node parte del fichero, no del cwd, así que
   los encuentra en `mobile/node_modules`. **Verificarlo con `npx vitest run`
   antes de dar la fase por buena**; si fallara, esos tres vuelven a
   `devDependencies` de la raíz.

   Comprobado además: `src/utils`, `src/data` y `src/locales` **no importan ni
   un solo paquete** (sólo `node:fs`, `node:url` y `vitest` en los tests), y
   todos los bare specifiers de `mobile/` resuelven dentro de
   `mobile/node_modules` —incluido `@expo/vector-icons`, que vive anidado en
   `expo/node_modules`—. Nada dependía del hoist a la raíz. Es el único riesgo
   que `vitest` **no** ve: se manifiesta al arrancar Metro, no antes.

3. **[vite.config.js](../../../vite.config.js)** — deja de ser configuración de
   build y pasa a ser sólo la de vitest: se cae el plugin de React (ningún test
   importa JSX — comprobado) y se queda el bloque `test` con los alias a
   `test/native-stub.js`, que siguen siendo indispensables. Quitar `vite` de la
   raíz es seguro: `vitest@4.1.8` lo lleva como dependencia directa.

4. **[seed-load-data.mjs](../../../seed-load-data.mjs):21** —
   `'./src/data/exerciseLibrary.js'` → `'./mobile/src/data/exerciseLibrary.js'`.

5. **`.claude/launch.json`** — apunta a `npm run dev` en el puerto 5173, que es
   el servidor de la app web. Al caer el script queda roto. No está versionado
   (`.claude/` está en `.gitignore`), así que es limpieza local: borrar la
   entrada o apuntarla a Expo.

6. **[eslint.config.js](../../../eslint.config.js)** — `globals.browser` y
   `reactRefresh.configs.vite` existían por la app web. **Recomendación: no
   tocarlo, ni en este commit ni en otro.** `globals.browser` es lo que le da a
   React Native `fetch`, `console`, `setTimeout`, `URL` y `atob`; cambiarlo
   siembra errores por todo el repo a cambio de nada. Si algún día se toca, va
   solo en su propio commit.

### 2.5 Documentación que miente después de la fase

- **[mobile/AGENTS.md](../../AGENTS.md)**: "i18n lives at the REPO ROOT:
  `src/locales/{es,en}.json`" — pasa a `mobile/src/locales/`.
- **[auditoria-tecnica.md](auditoria-tecnica.md)**, párrafo de alcance: explica
  que `src/utils`, `src/data` y `src/locales` cuentan como código del móvil
  "porque Metro los resuelve vía `watchFolders`". Después de esta fase ya no hay
  nada que explicar: son código del móvil y punto. Y la frase "la app web queda
  fuera: tiene los mismos bugs en su copia del store" deja de tener sujeto.
- **Dos sitios afirman que `src/data/programs.js` "lo usan los tests"** y es
  falso — cero importadores fuera del store web, comprobado:
  [mobile/store/useStore.js:385](../../store/useStore.js) ("queda como dato de
  desarrollo: lo usan los tests, no el store") y
  [program-model.md:686](program-model.md). Las dos frases se corrigen en esta
  fase, porque el fichero desaparece.
- Las rutas `src/utils/...` que aparecen en las tablas de las specs quedan
  desactualizadas. **No se reescriben en masa**: se corrigen cuando se toque
  cada spec. Vale la pena dejarlo dicho aquí para que nadie piense que son
  ficheros que faltan.

### 2.6 Verificación

```bash
npx vitest run                      # 37 ficheros de test, todos verdes
npx eslint .                        # comparar el recuento contra HEAD
npx expo start -c                   # Metro arranca sin watchFolders
```

Cifras medidas **antes** de la fase, para que el después sea comprobable y no
una impresión:

| Medida | Antes | Después esperado |
|---|---|---|
| `vitest` | 37 ficheros / 1.174 tests | **idéntico** |
| `eslint .` | 251 problemas (213 errores, 38 warnings) | **211 (182 / 29)** |

Los 40 problemas que caen son exactamente los de los ficheros borrados
(medido: `npx eslint src/components src/hooks src/store src/App.jsx
src/main.jsx src/i18n.js src/utils/storage.js` → 40). Cualquier otra cifra
significa que el movimiento introdujo algo.

Y en el dispositivo: abrir la app, entrar en una sesión, guardarla, y abrir
Progreso › Carga. Eso ejercita `progression`, `stageProgress`, `trainingLoad` y
`sessionRecap`, que son los cuatro módulos movidos con más consumidores.

### 2.7 Trampa conocida

`mobile/store/useStore.js:57` importa `'../src/i18n'`, que es
**`mobile/src/i18n.js`**, no el `src/i18n.js` de la raíz que se borra. Un sed
descuidado sobre `src/i18n` rompe la app entera. Las reglas de §2.3 sólo tocan
rutas con dos o más `../`, así que ésta no la atrapan — pero conviene mirarla a
ojo antes de commitear.

La trampa hermana —que un `(../)ⁿsrc/` de dos o más niveles apunte a
`mobile/src` en vez de a la raíz, cosa que la profundidad por sí sola no
distingue— **se comprobó y no existe en este árbol**: las 78 ocurrencias
resuelven a la raíz, y las 14 rutas de una sola `../` (todas en
`mobile/store/`) son internas y quedan fuera de las reglas. Si el árbol cambia
antes de ejecutar la fase, hay que volver a comprobarlo: la regla de §2.3 es
correcta por aritmética de profundidad, no por magia.

---

## 3. Fase 2 — Sacar la sesión en curso del blob

### 3.1 El hecho que obliga al diseño

Lo intuitivo es quitar `activeSession` de `partialize` y ya. **No funciona.**
Como se ve en §1.2, `persist` llama a `setItem()` en cada `set()` sin comparar:
quitar `activeSession` del `partialize` sólo consigue que el blob de 4 MB que se
escribe en cada tecla no contenga la sesión. Se sigue escribiendo.

Hacen falta las dos mitades:

1. **`activeSession` sale de `partialize`** y se persiste por su cuenta, en su
   propia clave y con su propio tamaño (~2-10 KB).
2. **La escritura del blob principal se corta cuando su contenido no ha
   cambiado**, que —una vez fuera `activeSession`— es exactamente lo que pasa
   en cada tecla.

### 3.2 Los dos diseños descartados

- **Un store aparte para la sesión (`useSessionStore`).** Es lo correcto a
  largo plazo y sólo tres ficheros leen `activeSession` hoy
  (`useStore.js` 113 referencias, `WorkoutScreen.jsx` 27, `HomeScreen.jsx` 6).
  Se descarta *ahora* porque `saveSession` (190 líneas,
  [useStore.js:1954](../../store/useStore.js)) escribe en un solo `set()` el
  log, el programa, la etapa y el `clientSync`, leyendo la sesión: partirlo en
  dos stores convierte un cambio mecánico en un cambio de comportamiento. La
  puerta queda abierta: nada de lo de aquí la cierra.
- **Throttle global de la escritura.** Reduce la frecuencia pero no el tamaño:
  se seguirían serializando megabytes cada segundo durante la sesión, y se
  compraría a cambio una ventana en la que un cierre forzado pierde estado.

### 3.3 El diff — cuatro cambios, todos en `mobile/store/useStore.js`

**(a) Clave y almacenamiento propios, con corte de escritura redundante.**
Sustituye a `storage: createJSONStorage(() => AsyncStorage)`
([useStore.js:3884](../../store/useStore.js)). `createJSONStorage` no vale aquí
porque serializa *antes* de que podamos decidir si merece la pena escribir:

```js
export const SESSION_STORAGE_KEY = `${BACKUP_STORAGE_KEY}_session`;

// Zustand escribe en cada set() sin comparar (middleware.js:360). Con la sesión
// en curso fuera de `partialize`, teclear un peso ya no cambia ninguna de estas
// claves — así que la comparación superficial de referencias corta la escritura
// entera, serialización incluida, que es donde estaba el coste.
let lastPersisted = null;
const persistStorage = {
  getItem: async (name) => {
    const raw = await AsyncStorage.getItem(name);
    return raw ? JSON.parse(raw) : null;
  },
  setItem: async (name, value) => {
    const next = value.state;
    const keys = Object.keys(next);
    if (lastPersisted
        && keys.length === Object.keys(lastPersisted).length
        && keys.every((k) => next[k] === lastPersisted[k])) return;
    lastPersisted = next;
    await AsyncStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name) => AsyncStorage.removeItem(name),
};
```

**(b) `activeSession` fuera de `partialize`** ([useStore.js:3885](../../store/useStore.js)).
Una línea menos. No afecta al backup: `buildBackupPayload`
([src/utils/backupPayload.js:28](../../../src/utils/backupPayload.js)) nunca ha
incluido `activeSession`, así que ni el `.fitdata` ni la copia a Drive ni la
tarea de fondo cambian de contenido.

**(c) Persistir la sesión por su cuenta**, después de crear el store:

```js
useStore.subscribe((s, prev) => {
  if (s.activeSession === prev.activeSession) return;
  if (!s.activeSession.templateId) {
    AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
  } else {
    // ponytail: una escritura por tecla, pero de ~5 KB en vez de megabytes.
    // Si en dispositivo se notara, throttle de cola de 500 ms aquí y en ningún
    // otro sitio.
    AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s.activeSession))
      .catch(() => {});
  }
});
```

**(d) Cargarla al arrancar**, dentro del `finally` de `onRehydrateStorage`
([useStore.js:4008](../../store/useStore.js)). Es el único punto delicado: la
lectura es asíncrona y `_initialRoute` depende de si hay sesión abierta, así que
**el flag de hidratación pasa a levantarse dentro de la promesa**. La garantía
del fallo 1 se mantiene —`_hasHydrated` acaba en `true` pase lo que pase— porque
va en el `.finally()` de la cadena:

```js
} finally {
  // La caducidad de 12 h vivía en el bloque de migraciones; se muda aquí con
  // la sesión, que ya no viene en el estado rehidratado por zustand.
  AsyncStorage.getItem(SESSION_STORAGE_KEY)
    .then((raw) => {
      if (!raw) return;
      const session = JSON.parse(raw);
      const age = Date.now() - (session.startedAt ?? 0);
      if (session.templateId && age <= 12 * 60 * 60 * 1000) {
        useStore.setState({ activeSession: session });
      } else {
        AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
      }
    })
    .catch((e) => console.warn('[rehydrate] sesión en curso ilegible:', e))
    .finally(() => {
      lastPersisted = null;   // ver trampa 2 en §3.5
      const s = useStore.getState();
      // … el cálculo de initialRoute actual, sin un solo cambio …
      useStore.setState({ _hasHydrated: true, _initialRoute: initialRoute });
    });
}
```

### 3.4 El test que cambia

[mobile/store/useStore.test.js](../../store/useStore.test.js) cubre el fallo 1
llamando al callback y comprobando el flag **en la misma vuelta del event loop**:

```js
rehydrateCallback()(undefined, new Error('storage ilegible'));
expect(useStore.getState()._hasHydrated).toBe(true);
```

Con el flag dentro de una promesa, los tres tests de ese `describe` necesitan
ceder el turno antes de comprobar:

```js
rehydrateCallback()(undefined, new Error('storage ilegible'));
await vi.waitFor(() => expect(useStore.getState()._hasHydrated).toBe(true));
```

`AsyncStorage` está aliasado a `test/native-stub.js`, así que `getItem`
devuelve lo que devuelva el stub — hay que asegurarse de que resuelve (aunque
sea a `null`) y no lanza al importarse. **Añadir un cuarto test** al mismo
`describe`: con una sesión válida en `SESSION_STORAGE_KEY`, `_initialRoute`
tiene que acabar en `'Workout'`. Es la regresión exacta que este cambio pone en
riesgo.

### 3.5 Trampas

1. **Comparación por referencia, no por contenido.** El corte de escritura de
   (a) asume que nadie muta en sitio los objetos de primer nivel del estado
   persistido. Es cierto en todo el store salvo en las migraciones de
   `onRehydrateStorage`, que sí mutan `state` en sitio — de ahí la trampa 2.
2. **`lastPersisted = null` después de hidratar es obligatorio.** Las
   migraciones (etapas, tags, colores) mutan el estado rehidratado sin cambiar
   sus referencias de primer nivel. Sin ese reset, la primera escritura
   posterior las vería "iguales" y las descartaría, y volverían a ejecutarse en
   cada arranque. Son idempotentes, así que no se rompe nada — pero es un
   silencio caro de diagnosticar.
3. **La clave nueva no entra en el backup.** `buildBackupPayload` no lleva
   `activeSession` y así debe seguir: una sesión a medias no es dato que
   restaurar. Restaurar un backup mientras hay una sesión abierta se comporta
   exactamente igual que hoy.

### 3.6 Verificación

- `npx vitest run` — con los cuatro tests de hidratación en verde.
- En dispositivo, la prueba que mide lo que se quería arreglar: entrar en una
  sesión con historial cargado (`npm run seed` → importar sólo Historial) y
  teclear pesos seguidos. Antes: la escritura del blob en cada tecla. Después:
  ninguna escritura del blob, y ~5 KB por tecla en la clave de sesión.
- Matar la app en mitad de una sesión y reabrirla: tiene que volver al Workout
  con las series ya registradas. Es el comportamiento que estas cuatro piezas
  podrían romper sin que ningún test lo note.

---

## 4. Fase 3 — Decisiones de recorte antes de publicar

No es código: es la lista de lo que hay que decidir **mientras no haya usuarios
con datos**, porque después cada uno cuesta el triple.

| Candidato | Superficie medida | Argumento para quitarlo |
|---|---|---|
| **Copia a Drive** (OAuth, refresh token, tarea de fondo, multipart, reintentos) | 1.035 líneas (`DriveBackupScreen` 729 + `driveService` 199 + `driveBackupTask` 107) + 176 en el store | **Seis de los 26 fallos de la auditoría son suyos** (3, 4, 13, 17, 19, 20). Exportar/compartir el `.fitdata` ya cubre el caso, y el backup del sistema operativo cubre el resto |
| **Facturación de clientes** | ~450 líneas de UI dentro de `ClientsScreen` + 3 acciones de store | Es un CRM dentro de un tracker. El entrenador ya cobra por otro canal |
| **Métricas de laboratorio** (monotonía, strain, índice de rendimiento, carga interna/externa, base 100) | ~4.100 líneas entre `ProgressTab`, `LoadTab`, `trainingLoad.js` y sus tests | Ninguna cambia lo que haces mañana. La señal está en que hubo que escribir [metric-transparency.md](metric-transparency.md) —**26 fichas explicando fórmulas**— para que se entendieran |
| **`programGenerator.js` procedural** | 507 líneas + 480 de test | Sustituido por plantilla + adaptación según [program-templates.md](program-templates.md), y sigue importado en el store |
| **Modos de progresión** salvo `double` y `none` | ~200 líneas en `progression.js` | 5 tipos × 4 evaluaciones × 3 incrementos, en el camino más caliente de la app, para un catálogo que usa doble progresión en todo |
| **3 de los 4 temas** | `themes.js` + QA visual ×4 | La app no está publicada y el propio `UI-MIGRATION.md` ya arrastra "revisar contraste del header del theme Earthy" |

Cada línea de esta tabla es una decisión independiente. Ninguna bloquea a las
fases 1 y 2.

---

## 5. Fase 4 — Terminar Workout y publicar

Es lo único que queda de la migración de UI
([UI-MIGRATION.md](../UI-MIGRATION.md), guía dedicada en
[workout-screen-migration.md](../workout-screen-migration.md)). Los 11 fallos
que siguen abiertos en la auditoría son medios y bajos.

Hacer las fases 1 y 2 **antes** de esta: son las dos que no tocan pantallas, y
la 2 se hace sobre el mismo fichero que la migración de Workout no toca.

---

## 6. Lo que esta spec deja abierto a propósito

Tres preguntas de diseño que no son mecánicas y merecen su propia decisión:

1. **El modelo de programas.** → **spec propia: [program-model.md](program-model.md)**
   (sep 2026). `programs` + `userPrograms` + `sessionTemplates` + `clients`, con
   la propiedad de un programa escrita en cuatro sitios y `program.days` como
   espejo desnormalizado de `stages[currentStageIndex].days`. Tres fases con
   mapa de migración. **Toca pantallas**, por eso no está aquí.
2. **Dos definiciones de "semana" conviviendo.** `stageProgress.js` define
   semana = una rotación completa por las sesiones distintas del ciclo, y
   `trainingLoad.js` / `weekProgress.js` usan semana de calendario. Esa
   contradicción **ya bloqueó** la fase 6 de [training-load.md](training-load.md).
3. **Tres personas, un flag.** Atleta, entrenador y cliente comparten modelo y
   se distinguen por `isPro` + `proTabsHidden`. El entrenador pasa por un
   onboarding que le pregunta *su* nivel antes de poder crear un cliente, y el
   cliente descubre que existe un entrenador dentro del menú ≡.

Ninguna de las tres se resuelve moviendo ficheros, y las tres son más baratas de
razonar con las fases 1 y 2 hechas.
