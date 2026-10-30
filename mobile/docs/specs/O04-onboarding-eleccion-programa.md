# Spec — Elegir programa en el alta: más claro y con ganas de empezar

> Tema: onboarding
> En corto: El tramo del alta en el que eliges cómo entrenas y qué programa sigues: pantallas de camino y de «plantilla o el mío» más llamativas, cuatro preguntas (nivel, días, objetivo, tiempo) antes de ver ninguna plantilla con lo que implica cada respuesta, y unas tarjetas de plantilla que den ganas de empezar.
> Inicio: 2026-10-30
> Fase O04-01 · terminado · Maqueta y elección de variantes · §2
> Fase O04-02 · hecho · Camino y «plantilla o el mío» con el diseño nuevo · §3
> Fase O04-03 · pendiente · Las cuatro preguntas antes de las plantillas · §4
> Fase O04-04 · pendiente · Tarjetas de plantillas · §5
>
> Estado: **spec escrita, maqueta v1 publicada, falta elegir variantes**
> (30-oct-2026). Sale de la idea M05 «Onboarding fix» de `ideas.md` (el código
> M05 era del tema de monetización; como spec es de onboarding y pasa a O04).
> Maqueta: [`onboarding-m05.html`](../mockups/onboarding-m05.html), publicada en
> https://claude.ai/artifact/NxsLtzbb2x9NYAPAeM9toU. Parte de lo que hizo
> [O03](O03-onboarding-caminos.md) (§8 y §20, `screens/common.jsx` y
> `screens/self.jsx`) y lo cambia solo en este tramo.

---

## 1. Por qué

Lo que dice la idea M05 y el usuario (30-oct):

- «¿Cómo entrenas?» y «¿Plantilla o el tuyo?» son listas de opciones planas:
  no llaman la atención en la pantalla que decide todo lo demás.
- No queda claro qué te llevas al elegir plantilla o crear el tuyo.
- Las preguntas de las plantillas llegan tarde: hoy es nivel → plantilla o el
  mío → objetivo → días → propuestas, y el **tiempo** se pregunta *después*,
  en la hoja de ajustes de la propuesta.
- En el selector de días salen tarjetas de sesión que parecen pulsables y no lo
  son.
- Las tarjetas de plantilla no dan ganas de hacer ninguna.
- Principiante: falta decir que estamos añadiendo imágenes a los ejercicios.

Fuera de esta spec (quedan apuntados aquí para otra): explicar cómo crear el programa propio en
vez de llevar por el constructor a medias (idea M05, punto 3) y un editor
rápido para quitar o sustituir ejercicios de la plantilla (punto 4, segunda
parte).

## 2. O04-01 — Maqueta y elección de variantes

La maqueta tiene siete pantallas; tres con dos variantes:

| Pantalla | A | B |
|---|---|---|
| Camino | **Póster**: «Por mi cuenta» grande arriba, las otras dos a media anchura; título en Barlow cursiva, icono grande que se sale de la tarjeta | **Filas grandes** numeradas, franja de color a la izquierda e icono en círculo |
| Plantilla o el mío | **Lado a lado**, con un dibujo de lo que te llevas (programa A/B/C u hoja vacía con «+») | **Apiladas**, con descripción y «Recomendado» |
| Plantillas | **Cartel**: la que mejor encaja en grande y las demás en compacto | **Carrusel** de tarjetas altas a todo color |

Cada camino lleva su color: lima (por mi cuenta), azul (con entrenador),
naranja (soy entrenador). Iconos a dos colores (gris + color al 65 %, trazo 1.7).

Se cierra cuando el usuario elige una variante de cada una y da por buenos los
textos de los puntos. Lo elegido se apunta aquí y las fases 2-4 lo siguen.

**Elegido (30-oct, maqueta v2 sin las variantes descartadas):**

- **Camino: B**, sin el número. El icono pasa a elemento decorativo: grande
  (~104 px) dentro de su círculo de color (~156 px), cortado por el borde
  derecho de la tarjeta. Iconos nuevos: una **mancuerna** para «por mi cuenta»;
  en «con entrenador», el bocadillo separado de la persona y el check centrado
  dentro.
- **Plantilla o el mío: B**, sin el panel «Si eliges…». La imagen va en un
  hueco hundido (fondo `bg`, más oscuro que la tarjeta), sin texto y en tonos
  apagados, para que se lea como dibujo y el nombre de la opción sea el texto
  grande.
- **Plantillas: B**, con la zona de color más baja (~150). Dentro del color, la
  **semana sugerida** L-D, discreta (negro translúcido). En la portada, un
  botón de texto lima **«Ver ejercicios»** cambia la tarjeta a sus ejercicios,
  con un **selector de sesión** (A · B · C) en vez de una lista larga, y
  «Volver a la portada». La elegida es la del centro del carrusel; aquí no hay
  relleno lima.
- **Objetivo**: las baldosas de hoy (la palabra grande, `FlowTile word`, sin
  icono) más el panel «Qué implica».
- **Seleccionar = rellenar la tarjeta de `accent`**, con el relleno circular de
  U13 (450 ms, out cubic) desde el control: desde el icono en el camino, desde
  el radio en las opciones, desde el centro en las baldosas. Texto a
  `onAccent`, iconos a negro. Nada viene marcado en camino ni en «plantilla o
  el mío».
- Puntos de «Qué implica»: textos cortos y neutros, una idea por punto; punto
  y texto alineados en flex. Los avisos, con el punto naranja y el texto en
  `mutedLight`.

Textos de objetivo revisados por el usuario: «Ponerte fuerte» = foco en
compuestos y series de 5 repeticiones en los principales (lo que trae la
plantilla de fuerza: 4×5 y 3×5); «Calistenia» = ejercicios con peso corporal,
sin el aviso de la barra.

Maqueta v3 (30-oct): el usuario la ve bien con estos cambios.

## 3. O04-02 — Camino y «plantilla o el mío»

En `screens/common.jsx` (la bifurcación «¿Cómo entrenas?») y
`screens/self.jsx` (`Choice`):

- El diseño de la variante elegida. Los textos de hoy se quedan
  (`onboardingFlow.common.role.*`, `onboardingFlow.self.choice.*`); se añade la
  etiqueta «Lo más habitual» de «Por mi cuenta» si la variante la lleva.
- **«Plantilla o el mío» va antes del nivel**: el nivel pasa a ser la primera
  pregunta de las plantillas (§4). Ya no hay dos variantes de esta pantalla
  según el nivel (`titleBeginner`/`titleOther`): una sola, con «Recomendado» en
  la plantilla.
- Debajo de las dos opciones, un panel **«Si eliges …»** con lo que implica la
  marcada (tres puntos, los de la maqueta). Elegir ya no navega al tocar: se
  marca, el panel cambia y «Continuar» lleva al siguiente paso.
- «Tengo una copia de seguridad» se queda como acción secundaria.

Implementado (30-oct): `FlowRow` (camino), `FlowChoice` (plantilla o el mío) y
`fx` como función del ancho en `FlowFill` para los rellenos que salen del lado
derecho. Sin el panel «Si eliges …» (§2). Como el nivel ya no se pregunta antes
de «Crear el mío», el constructor no recibe `level` por este camino (solo afecta
a la profundidad `isDeep` de `advanced`).

**Probar O04-02**

- [ ] Alta → «¿Cómo entrenas?»: tres filas con franja de color a la izquierda
  (lima, azul, naranja) y el icono grande cortado por el borde derecho. Nada
  viene marcado y «Continuar» está apagado.
- [ ] Tocar una fila: se rellena de lima en círculo desde el icono, la franja
  desaparece y el icono pasa a negro. Tocar otra la cambia; «Continuar» lleva a
  su camino.
- [ ] «Por mi cuenta» → «¿Plantilla o el tuyo?»: dos tarjetas apiladas, con
  «Recomendado» en la plantilla y a la derecha el hueco oscuro con el dibujo
  (tres filas de sesión / hoja vacía con «+»). Nada marcado.
- [ ] Elegir una: se rellena de lima desde el hueco, que sigue oscuro.
  «Continuar» → plantilla lleva al nivel; «Crear el mío» abre el constructor.
- [ ] «Tengo una copia de seguridad» sigue abajo y abre el selector de archivo.
- [ ] Se ve bien con el tema claro y con textos grandes del sistema (sin
  cortes en los títulos).

## 4. O04-03 — Las cuatro preguntas antes de las plantillas

Orden nuevo del camino de plantilla: **nivel → días → objetivo → tiempo →
plantillas**. También para la entrada desde la app («Nuevo programa», que hoy
salta `s_choice`).

- Barra de progreso «1 de 4» … «4 de 4» arriba.
- Cada pantalla: las opciones y, debajo, un panel **«Con …»** con 2-4 puntos de
  lo que implica la respuesta marcada. Los avisos van con el punto en naranja.
  Cambia con una transición corta al marcar otra opción.
- **Nivel**: las tres de hoy. «Empiezo» incluye el punto «Estamos añadiendo
  imágenes a los ejercicios; mientras, cada uno lleva su explicación».
- **Días**: baldosas 1-7 **sin tarjetas de sesión** debajo.
- **Objetivo**: los cuatro de `IDENTITY_OPTIONS`, en baldosas 2×2 con icono.
- **Tiempo**: 30 · 45 · 60 · 90 min, guardado en `answers.sessionMinutes`
  **antes** de buscar plantillas. La hoja de ajustes de la propuesta conserva
  material y limitaciones; el tiempo sigue editable ahí.
- Los textos de los puntos de la maqueta son un borrador: **las cifras
  (repeticiones, descansos, series, ejercicios por tiempo) se cuadran con las
  plantillas reales** (`src/data/archetypes.js`, el recorte por tiempo de
  `AdjustSheet`/`timeHint`) antes de pasarlos a `es.json`/`en.json`. Si un
  punto depende de la plantilla, se dice en general o se quita.
- Tono: amigable, no coloquial; nada de «montar» ni «a tu aire».

## 5. O04-04 — Tarjetas de plantillas

En la pantalla de propuestas (`s_props`), con la variante elegida:

- Arriba, las cuatro respuestas en chips (nivel, días, objetivo, minutos).
- Cada tarjeta: nombre en Barlow cursiva, `summary` de la plantilla, tres
  cifras (sesiones · ~minutos · series por sesión) y las **series por semana
  por grupo** en barras, calculadas del programa ya ajustado a las respuestas
  (no de la plantilla en bruto).
- Variante A: la primera lleva **por qué encaja** (2-3 puntos sacados de las
  respuestas que coinciden: días, objetivo, nivel) y «Ver las N sesiones»; las
  demás en compacto con su mini gráfico de sesiones.
- «Empezar con esta» confirma como hoy (`generateAndActivateProgram`); «Ver
  todas las plantillas» abre la lista completa.
- Radios y espaciados del tema, no números sueltos de la maqueta.
