# Spec — Cabecera de Inicio

> Tema: ui
> En corto: Arriba de Inicio, una tarjeta que dice en qué programa estás y por qué semana vas, y lleva al tab Programa. Cómo se reparten Inicio y Programa está por diseñar.
> Inicio: 2026-10-05
> Fase U12-01 · hecho · Tarjeta de programa que lleva al tab Programa · §2
> Fase U12-02 · pendiente · Diseño: reparto entre Inicio y Programa · §3
>
> Estado: **U12-01 hecha el 5-oct-2026**, por probar en el móvil, y
> **provisional**: el mismo día se sacaron de la tarjeta la semana y el lápiz de
> editar, a la espera de U12-02. U12-02 es diseño, no implementación.

## 1. Por qué

En Inicio solo se ven sesiones: nada dice en qué programa estás ni por qué
semana vas. La tarjeta es **orientación, no acción**: se lee antes que las
sesiones pero nunca más alta que la tarjeta de la que toca, que sigue siendo la
única pieza en lima.

Maquetas, en `docs/mockups/`:

- `home-header.html` — cinco propuestas (<https://claude.ai/artifact/Dyeaq3CZu6ajdZeYkg4ygr>).
  Se eligió la **A · ceja y nombre**.
- `home-header-banner.html` — la A suelta o en caja con la semana, y cuatro
  maneras de convivir con el banner de sesión en curso
  (<https://claude.ai/artifact/3aWF8p5nq1bS2ZRSWDdA1v>).

Decisiones del usuario (5-oct-2026):

- **En caja.** Primero con la semana (L M X… y sus puntos) dentro; el mismo día
  se volvió a sacar: en la tarjeta va **solo el programa**, y la semana sigue
  suelta debajo, como antes.
- **El banner «En curso» va arriba de todo, siempre**, y empuja lo demás. Ni
  tapa la cabecera ni va en medio. Ya era así en el código: el banner es lo
  primero del `ScrollView`.
- **Pulsar la tarjeta lleva al tab Programa**, como el propio tab.
- **Editar el programa desde Inicio**: se montó un lápiz en la tarjeta y se
  quitó el mismo día. Queda para U12-02.

## 2. U12-01 — La tarjeta

`src/components/HomeProgramCard.jsx`, montada en `HomeScreen` encima de la
semana, que no cambia. Sin programa activo no sale.

- **Diseño de Figma (6-oct-2026)**, tres casos: «Frame 156» (sin etapas ni
  duración: sin barra ni total), «Frame 167» (una etapa con duración: una barra)
  y `515:922` (varias etapas: un tramo por etapa). Cambio del usuario (6-oct):
  la etapa en curso va en la ceja, «TU PROGRAMA · ACUMULACIÓN» (su nombre, o «ETAPA 2» si no tiene), y sin contador de semana de la etapa.
- **Caja**: `surface2`, radio `sm`. Izquierda: ceja «TU PROGRAMA» (`caps`,
  `mutedLight`) y el nombre (`heading`, `accent`). Derecha, tras un corte en
  diagonal de 4 px del color del fondo: «SEMANA», la semana del programa a dos
  cifras (`heading`, `accent`, como el nombre) y, en la misma línea, «/12» (`caps`, `mutedLight`, como la ceja).
  - La semana es `stageStatus().programWeek`. El total suma las semanas de las
    etapas, con la en curso alargada (`lengthWeeks`). Sin total si alguna etapa
    no tiene techo, o si la semana ya lo pasa. Sin empezar: «–».
- **Barra**: 6 px, radio 1, pegada al margen de abajo. Tramos proporcionales a sus semanas (la abierta pesa
  1); hechas en `tint.accent50`, la actual en `muted` y se llena en `accent` por
  semanas. Con varias etapas los tramos (y el «07») van inclinados −12°, como en
  Figma.
- Pulsar la tarjeta: `navigation.navigate('MyProgram')`.
- Texto nuevo: `home.openProgram` (pista de accesibilidad) y `home.yourProgram`. Reutiliza `home.weekProgress`, `home.stageDefault`,
  `programCard.stageWeekOpen` y `programCard.stageNotStarted`.

**Probar U12-01**

- [ ] Con programa: arriba de Inicio sale la tarjeta con la semana del programa, la etapa, el nombre y la barra; la semana (L M X…) sigue debajo, suelta, como antes.
- [ ] La semana y la etapa coinciden con lo que dice el tab Programa.
- [ ] La barra llena la etapa en curso según la semana de la etapa; las anteriores en lima apagado.
- [ ] Tocar la tarjeta abre el tab Programa.
- [ ] Con un programa de nombre largo, el nombre rompe a dos líneas.
- [ ] Con una sesión a medias, el banner «En curso» sale encima de la tarjeta y la empuja.
- [ ] Sin programa activo no sale la tarjeta.

## 3. U12-02 — Reparto entre Inicio y Programa

**Pendiente de diseño; no se implementa nada hasta cerrarlo.**

El problema, en palabras del usuario (5-oct-2026): ahora hay **dos tarjetas de
programa**, la de Inicio y la del tab, y no está resuelto cómo mantener
**sesiones y programa relativamente separados** pero que los dos tengan sentido
y la funcionalidad básica. Preguntas que tiene que contestar el diseño:

- Qué dice cada tarjeta y si alguna sobra o cambia de forma. La de Inicio es hoy
  una versión reducida de la del tab (nombre, semana, etapa, barra).
- Dónde se edita el programa: el usuario quiere poder hacerlo desde Inicio. Se
  probó un lápiz en la tarjeta y se quitó.
- Si la semana (L M X…) va con el programa o con las sesiones. Se probó dentro
  de la tarjeta y se sacó.

Ideas sueltas que ya salieron en las maquetas, por si sirven:

- Con banner y tarjeta lima de la que toca hay **dos piezas lima** seguidas; la
  salida anotada en `ActiveSessionBanner` es volver a `surface` con solo el botón
  en lima.
- El banner **acoplado** a la tarjeta (2 px de separación y radios por posición,
  como la lista agrupada) se maquetó como opción D y no se eligió.
- La tarjeta es del mismo `surface` que las filas de sesión: vigilar que no se
  lea como una fila más.
