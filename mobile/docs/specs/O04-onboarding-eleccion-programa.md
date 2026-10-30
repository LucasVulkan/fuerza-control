# Spec — Elegir programa en el alta: más claro y con ganas de empezar

> Tema: onboarding
> En corto: El tramo del alta en el que eliges cómo entrenas y qué programa sigues: pantallas de camino y de «plantilla o el mío» más llamativas, cuatro preguntas (nivel, días, objetivo, tiempo) antes de ver ninguna plantilla con lo que implica cada respuesta, y unas tarjetas de plantilla que den ganas de empezar.
> Inicio: 2026-10-30
> Fin: 2026-10-30
> Fase O04-01 · terminado · Maqueta y elección de variantes · §2
> Fase O04-02 · hecho · Camino y «plantilla o el mío» con el diseño nuevo · §3
> Fase O04-03 · hecho · Las cuatro preguntas antes de las plantillas · §4
> Fase O04-04 · hecho · Tarjetas de plantillas · §5
> Fase O04-05 · hecho · Correcciones tras la primera prueba · §6
> Fase O04-06 · hecho · Segunda ronda: unidades, estilos, barra doble y tarjetas con pestañas · §7
> Fase O04-07 · hecho · Bienvenida nueva, con maqueta · §8
> Fase O04-08 · hecho · Plantillas: pestañas lima y «ver todas» en lista · §9
>
> Estado: **implementada** (30-oct-2026); O04-07 (bienvenida) y O04-08 (plantillas) hechas en la rama `feat/o04-07-bienvenida`;
> por probar en dispositivo. Partió de la idea M05 «Onboarding fix» de `ideas.md` (el código
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

Implementado (30-oct): `FlowSteps` y `FlowImplies` (`flow/FlowAsk.jsx`), pantalla
nueva `s_time` y `answers.sessionMinutes`, que `useProgramModel` pone antes de
los ajustes (el tiempo sigue editable en `s_adjust`). Desde la app, el nivel ya
guardado salta a los días (`n_source`). El panel no se pinta hasta marcar una
respuesta (nada viene premarcado). Los puntos están en
`onboardingFlow.self.ask.<pregunta>.<respuesta>` (`pts` y `warn`).

Cifras de la maqueta que **no cuadraban** con las plantillas y se corrigieron
(medidas con `adaptArchetype` y `rankArchetypes`):

- **Días**: no hay plantilla de una sesión (con 1 día salen las de 2 o 3, que
  se turnan) ni de «tren superior e inferior más una extra» (con 5 días manda
  la de 6 sesiones) ni «sin días libres» con 7 (la mayor es de 6). Los puntos
  hablan en general y dicen «o cuerpo completo» donde la plantilla cambia según
  el objetivo.
- **Tiempo**: a 90 min no salen 7 u 8 ejercicios en la de cuerpo completo (se
  queda en 6; las avanzadas llegan a 8) y a 30 min no se cuenta el
  calentamiento (`includesWarmup`). Quedan rangos: 3-5, 4-6, 5-7 y 6-8.
- **Objetivo**: el glúteo está en 2 de las 3 sesiones, no en todas; se quita
  «tren superior con menos volumen» (no está medido). Hipertrofia: 6-15
  repeticiones y descansos de 1 a 3 min (el avanzado llega a 3).
- **Nivel**: «el peso sube cada semana» pasa a «poco a poco» (la progresión es
  doble en todos los niveles); en el avanzado se quita «fases de mayor
  intensidad» (todas las plantillas llevan fases) y se dice que lleva más
  ejercicios y series.
- El sub de tiempo «Contando el calentamiento» se quita (solo es cierto desde 45).

**Probar O04-03**

- [ ] «Plantilla» → Continuar: Nivel con «1 de 4» arriba y tres opciones. Al
  marcar una sale «Qué implica» con sus puntos y cambia con un fundido corto
  al marcar otra. «Continuar» está apagado hasta marcar.
- [ ] «Empiezo» lleva el aviso naranja de las imágenes; el radio pasa a negro
  con el check lima al marcar y no se estira.
- [ ] Días: baldosas 1-7 sin tarjetas de sesión debajo; «Qué implica» cambia con
  cada día y 1, 5, 6 y 7 llevan aviso.
- [ ] Objetivo: las cuatro baldosas con la palabra grande, «Qué implica» debajo.
  «Ponerte fuerte» dice 5 repeticiones en los principales.
- [ ] Tiempo: 30 · 45 · 60 · 90 min; el botón dice «Ver plantillas»; 30 avisa
  de que no cuenta el calentamiento.
- [ ] Las plantillas salen ya recortadas al tiempo elegido (con 30 min, 3-5
  ejercicios por sesión) y «Tu programa» → Ajustes enseña ese tiempo marcado y
  deja cambiarlo.
- [ ] Atrás en cada pregunta vuelve a la anterior con su respuesta marcada.
- [ ] Ajustes → Nuevo programa → «Programa recomendado»: con nivel guardado
  empieza en Días; sin él, en Nivel. La barra de arriba no sale.
- [ ] Textos en inglés (idioma del móvil en inglés) sin cortes.

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

Implementado (30-oct): `TemplateCarousel` (carrusel con snap, tarjeta de 300 como
máximo, la centrada es la elegida, puntos debajo), `templateCards.js` (lo que
enseña cada tarjeta, con test) y la portada/ejercicios con selector de sesión.
La semana sugerida reparte las sesiones por los días elegidos (1 → L, 3 → L X V,
…). El color de la zona sale de la posición (lima, naranja, violeta, azul), no de
la plantilla, que no lleva color propio. «Empezar con esta» **no genera aún**: elige
la plantilla y abre «Tu programa» (la pantalla de ajustes de material y
limitaciones, que sigue siendo el único sitio donde se cambian), cuyo «Empezar
con este» llama a `generateAndActivateProgram` como hoy. «Ver todas las
plantillas» pasa a mostrarlas todas en el mismo carrusel.

**Probar O04-04**

- [ ] Tiempo → Ver plantillas: tras el «Buscando tu programa» (ahora con cuatro
  casillas) salen los chips (nivel, días, objetivo, minutos) y el carrusel con
  tres tarjetas; los puntos de debajo marcan la centrada.
- [ ] Deslizar: la tarjeta se queda centrada (snap) y el punto cambia. En un
  móvil estrecho la tarjeta no se sale de la pantalla.
- [ ] Portada: zona de color con la etiqueta de encaje (la primera «La que mejor
  encaja»), el número de sesiones grande y apagado, el nombre y la semana
  sugerida L-D discreta; debajo resumen, sesiones · ~min · series/sesión y
  «Series por semana» en barras.
- [ ] Con 30 min las series por sesión y los minutos bajan respecto a 90 min
  (el programa ya viene ajustado al tiempo).
- [ ] «Ver ejercicios»: selector A · B · C con el nombre de la sesión y su lista
  (nombre y series × repeticiones); cambiar de sesión cambia la lista; una
  sesión larga se desplaza dentro de la tarjeta sin mover el carrusel.
  «‹ Volver a la portada» la deja como estaba.
- [ ] «Empezar con esta» abre «Tu programa» de la tarjeta centrada, con el tiempo
  elegido en Ajustes; «Ver otros programas» vuelve al carrusel en la primera.
- [ ] «Ver todas las plantillas» enseña todas en el carrusel y el botón pasa a
  «Ver sólo las recomendadas».
- [ ] Con textos grandes del sistema y en inglés nada se corta en las tarjetas.

---

## 6. O04-05 — Correcciones tras la primera prueba

Lo que pidió el usuario el 30-oct tras probar O04-02..04 en el móvil:

1. **Bienvenida** (`welcome`, `screens/common.jsx`): subir el panel lima con
   «¿Empezamos?», que ahora queda muy abajo y deja un hueco vacío en medio. El
   titular «Tu programa, tus series, tu progreso» pasa a **«¡Bienvenido/a a Forma
   Fit!»** (en: «Welcome to Forma Fit!») y el subtítulo a **«Configura tu perfil
   en dos minutos»** (en: «Set up your profile in two minutes»), con un rol de
   texto mayor que el de ahora.
2. **¿Kilos o libras?**: quitar el valor numérico de ejemplo; cada opción solo
   dice **KG** o **LB**, en grande.
3. **Elige tu estilo**: los estilos claros y oscuros, intercalados (claro,
   oscuro, claro…) en vez de agrupados.
4. **Plantilla o el mío**: el título pasa a **«Elige tu programa»** (en:
   «Choose your program») y se quita la etiqueta «Recomendado» de «Elegir
   plantilla».
5. **Tiempo**: las baldosas de minutos, más cuadradas (más altas, proporción
   cercana a 1:1).
6. **Propuestas**:
   - sin subtítulo y sin los chips de lo elegido: la tarjeta tiene que verse
     entera en la pantalla;
   - selector de sesiones: con más de 3 sesiones solo las letras (A · B · C · D…),
     sin la palabra «Sesión», y que nunca se corte;
   - **toda la tarjeta** se pulsa para pasar de portada a ejercicios y de vuelta
     (el selector de sesión y el desplazamiento de la lista siguen funcionando);
   - la cifra «series/sesión» pasa a **las semanas que dura el programa** (la
     suma de `durationWeeks` de sus etapas en `archetypes.js`).
7. **Ver el resto de plantillas**: en vez de meterlas en el carrusel, las demás
   salen en una **lista** de filas (nombre y sesiones · ~min · semanas), con la
   selección de la app (relleno de acento); «Empezar con esta» usa la marcada.
8. **Sin «Tu programa»**: de momento se quita el paso de configurar la plantilla
   (material y limitaciones). «Empezar con esta» genera y activa el programa
   directamente, ajustado solo al tiempo elegido (material y limitaciones por
   defecto). Se borra lo que quede sin uso (`TuPrograma`, `s_adjust`…).

Cómo quedó (O04-05):

- Bienvenida: titular, línea y recorrido en un bloque centrado entre la marca y el
  panel (el panel sigue pegado abajo; el hueco se reparte, ya no queda en medio).
- Estilos: claro, oscuro, claro… (solo hay dos claros: Earthy y Space).
- Tarjeta: `CARD_H` se ajusta al alto de pantalla (460–520). La tercera cifra son
  las semanas (`totalWeeksOf(phases)`, `cardModel().weeks`); «—» si la plantilla no
  declara fases (hoy todas las declaran).
- Elegida para «Empezar con esta»: la de la lista del resto si se marcó una; si no,
  la centrada del carrusel. Deslizar el carrusel borra la marca de la lista.
- `onboardingFlow.js` **no** se borra (lo usan la barra, «Saltar» y las rutas de todo
  el recorrido): solo pierde `s_adjust`. `selfProgram.jsx` se queda con `TIMES`,
  `answersOf`, `levelOf` y `useProgramModel` (sin elegida ni ajustes).

**Probar O04-05**

- [ ] Bienvenida: el panel lima queda más arriba, sin hueco grande en medio;
  titular «¡Bienvenido/a a Forma Fit!» y subtítulo más grande.
- [ ] Unidades: solo KG y LB, grandes.
- [ ] Estilos: claros y oscuros alternados.
- [ ] «Elige tu programa» sin la etiqueta «Recomendado».
- [ ] Tiempo: baldosas casi cuadradas.
- [ ] Propuestas sin subtítulo ni chips; la tarjeta se ve entera.
- [ ] Una plantilla de 4+ sesiones: selector con solo letras, sin cortarse.
- [ ] Tocar la tarjeta pasa a ejercicios y otra vez a la portada; cambiar de
  sesión y desplazar la lista no la gira.
- [ ] La tercera cifra son las semanas del programa.
- [ ] «Ver todas las plantillas»: el resto sale como lista; marcar una y
  «Empezar con esta» crea esa.
- [ ] «Empezar con esta» crea el programa sin pasar por «Tu programa», con las
  sesiones ajustadas al tiempo elegido.

---

## 7. O04-06 — Segunda ronda: unidades, estilos, barra doble y tarjetas con pestañas

Lo que pidió el usuario el 30-oct tras probar O04-05 («es la parte más
importante para la retención»):

1. **¿Kilos o libras?**: viene con KG marcado pero no tiene botón «Siguiente».
   Como en el resto del recorrido, tocar una opción solo la marca y se avanza
   con «Siguiente» en el pie.
2. **Elige tu estilo**: Forma Fit, el primero; el resto sigue intercalado
   (claro, oscuro…).
3. **Barra doble**: en las cuatro preguntas (nivel, días, objetivo, tiempo) sale
   una segunda barra de progreso (`FlowSteps`) junto a la principal del
   recorrido. Se quita; basta con la principal (el «1 de 4» puede quedar como
   texto si cabe sin barra, o desaparecer).
4. **Entrada de las plantillas**: al llegar a «Elige tu programa» las tarjetas
   entran con una animación ligera (desplazamiento corto + fundido, escalonadas),
   con Reanimated y respetando «reducir movimiento».
5. **Tarjetas más largas y con scroll**: la tarjeta aprovecha el alto disponible;
   en la cara de ejercicios la lista se desplaza dentro de la tarjeta y se ven
   todos los ejercicios (en Android, el scroll vertical anidado dentro del
   carrusel horizontal tiene que funcionar).
6. **Sin pulsar la tarjeta entera**: se quita; se cambia de cara solo con el
   botón «Ver ejercicios» / «Volver a la portada».
7. **Sesiones en pestañas**: el selector de sesión pasa a pestañas pegadas a la
   lista de ejercicios: la pestaña elegida comparte fondo con la lista (como
   una carpeta), las demás llevan otro fondo. Con 3 sesiones o menos, letra y
   nombre; con más, solo la letra. El nombre de la sesión elegida se distingue
   claramente del de los ejercicios (otro rol de texto, encabezando la lista).

**Probar O04-06**

- [ ] Unidades: tocar KG o LB solo marca; «Siguiente» avanza.
- [ ] Estilos: Forma Fit, el primero.
- [ ] Nivel, días, objetivo y tiempo: una sola barra de progreso; el «1 de 4» queda como texto pequeño sobre el título.
- [ ] Al llegar a las plantillas, las tarjetas entran animadas.
- [ ] Tocar la tarjeta no la gira; solo el botón.
- [ ] La tarjeta aprovecha el alto libre (sin tope de 520); en ejercicios la lista se desplaza y se ven todos, en Android también.
- [ ] Pestañas: la elegida comparte fondo con la lista y se ve claro cuál es;
  con 4+ sesiones, solo letras y sin cortarse.

---

## 8. O04-07 — Bienvenida nueva, con maqueta

La primera pantalla sigue pareciendo barata: no transmite una app seria ni se
parece a la landing. Se rehace a partir de una maqueta con variantes
(`docs/mockups/onboarding-bienvenida.html`); se implementa cuando el usuario
elija.

**Elegido (30-oct)**: ninguna de las tres de la maqueta, sino el patrón de las
pantallas de bienvenida con ilustración y hoja (referencia que pasó el usuario):

- **Arriba, todo lima** a sangre (también bajo la barra de estado), con el
  **logo de la app** (el monograma FF de `assets/adaptive-icon.png`, que tiene
  fondo transparente) grande y centrado en ese hueco. El cambio de idioma ES/EN
  queda arriba a la derecha, sobre el lima.
- **Abajo, una hoja** del color de fondo de la app (`bg`), con las esquinas de
  arriba redondeadas, que sale de abajo: el titular «¡Bienvenido/a a Forma
  Fit!», el subtítulo «Configura tu perfil en dos minutos», la nota de la
  invitación si la hay, y en vertical «Empezar» (botón principal de la app) y
  «Ya tengo cuenta». Sin el recorrido de cuatro tramos.
- **Al pulsar** «Empezar» (o «Ya tengo cuenta») la hoja **sube hasta tapar el
  lima** y entonces se pasa a la siguiente pantalla, que tiene el mismo fondo:
  parece que la hoja se convierte en ella. Su contenido se desvanece mientras
  sube. Con «reducir movimiento», se pasa sin animar.

**Probar O04-07**

- [ ] Primera pantalla: lima arriba con el logo FF, hoja oscura abajo con el
  titular, el subtítulo y los dos botones en vertical.
- [ ] Al entrar, la hoja sube desde abajo hasta su sitio.
- [ ] «Empezar»: la hoja sube, tapa el lima y aparece «¿Kilos o libras?» sin
  salto ni parpadeo. Igual con «Ya tengo cuenta».
- [ ] Atrás desde «¿Kilos o libras?» vuelve a la bienvenida entera (lima y hoja
  en su sitio).
- [ ] ES/EN sobre el lima cambia el idioma.
- [ ] Con invitación, la nota sale en la hoja.

---

## 9. O04-08 — Plantillas: pestañas lima y «ver todas» en lista

Tras probar O04-06 (30-oct):

1. **Pestañas**: siempre solo la letra, sin nombre, tenga las sesiones que
   tenga. La elegida, con la letra en **lima**; debajo de las pestañas, el nombre
   de la sesión, también en lima.
2. **«Ver todas las plantillas»** cambia la vista: el carrusel se sustituye por
   la **lista** de todas las plantillas (no se añaden debajo, que parecía que no
   hacía nada). Desde la lista, un botón vuelve a las recomendadas (carrusel).
   En la lista se marca una y «Empezar con esta» crea esa.

**Probar O04-08**

- [ ] Pestañas solo con letras; la elegida y el nombre de la sesión, en lima.
- [ ] «Ver todas las plantillas» cambia a la lista; «Ver sólo las
  recomendadas» vuelve al carrusel.
- [ ] En la lista, marcar una y «Empezar con esta» crea esa plantilla.
