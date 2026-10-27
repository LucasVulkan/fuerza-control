# Spec — Motor de progresión: reglas claras y lo que hiciste a la vista

> Tema: programas
> En corto: La progresión deja de bajar el peso por un mal día y de pedir reps según tu peor serie; el gris de cada serie vuelve a ser lo que hiciste la última vez y la meta la dice el mensaje del ejercicio, en una frase que se entiende sin saber cómo funciona el motor.
> Fase P18-01 · hecho · Peso por reglas: cuándo mantener y cuándo bajar · §3
> Fase P18-02 · hecho · Reps y Tiempo: una meta por total · §4
> Fase P18-03 · hecho · El gris es la última vez; el check guarda la casilla · §5
> Fase P18-04 · hecho · Mensajes del chip · §6
> Fase P18-05 · hecho · Hoja de Progresión por niveles · §7
> Inicio: 2026-10-27
> Fin: 2026-10-27
>
> Estado: **implementada, por probar en el móvil** (27-oct-2026; escrita el mismo día). Sale del replanteo del
> motor que sustituyó a firmar en abstracto la tabla 1A de
> [I01](I01-integridad-y-tests.md) (`docs/auditoria-tests/tablas-de-casos.md`):
> en vez de preguntas sueltas, nueve personas pasadas por el motor real sesión a
> sesión en el **visor de progresión** (`scripts/visor-progresion/`, publicado en
> https://claude.ai/artifact/SuYRbpH49q5eCbVKCkbmC4), con el motor de hoy y un
> prototipo con lo acordado lado a lado. Las reglas de esta spec son las del
> prototipo (`scripts/visor-progresion/motorPropuesto.js`) y los casos de §8 salen
> de esas trazas, revisadas con el usuario. P18-05 espera a su maqueta.
>
> **Alcance de la primera versión pública** (decisión del usuario, 27-oct): solo
> reglas + comunicación visual. **Fuera:** objetivos o «enfoques» por programa y
> por etapa (visión en §9, ligada a la idea P17 de `ideas.md`), volver tras semanas
> sin entrenar, top set + back-off. La carga semanal se revisa aparte, con el
> mismo método, en su propia spec.

---

## 1. Por qué

El motor de P12 cubre casi todas las formas de entrenar, pero en el visor se ve
que **aconseja mal en los momentos que más pesan** y que **se explica mal**:

| Caso (fila del visor) | Hoy | Lo que espera quien entrena |
|---|---|---|
| Ana sube a 32,5 kg y hace 10/9/9 (mínimo 10) | Baja a 30 | Mantener: es el primer día con ese peso y falló por poco |
| Marta, un solo día malo | Baja | Bajar solo si es un fallo claro o se repite |
| Marta, «Parcial 2 de 3» con 15/15/11 (rango 12-15) | Sube | No subir: la tercera serie está fuera del rango |
| Sergio, dominadas por reps, 12/12/7 | Pide 8 en todas | Algo que respete las dos series buenas |
| Sergio tras un día malo | La frase dice «meta 6», el gris pide 7/5/4 | Un solo mensaje |
| Carlos, sentadilla 5×5 | Baja de 5 en 5 | Si falla de verdad, que la bajada se note |

Y de fondo, una queja de uso: el gris pedía el plan («el gris es el plan», P12
§6.1) y lo que hiciste la última vez quedaba escondido.

## 2. Principios

1. **Un mal día no castiga; una racha, sí.** Fallo leve → mantener. Fallo grande
   o segundo fallo seguido → bajar, y que se note.
2. **Mejorar nunca es fallar**, aunque no llegues a la meta.
3. **Lo que hiciste se ve sin buscarlo** (el gris); **la meta se dice con
   palabras** (el chip).
4. **El RPE es siempre opcional y va aparte.** Nadie tiene que saber qué es para
   usar la app; quien lo usa lo activa.
5. **Niveles separados en la interfaz**: lo básico a la vista, lo avanzado plegado.
6. **Una sola función decide la progresión**, y la usan la tarjeta del Workout,
   `saveSession` y el texto para WhatsApp (hoy son tres copias que ya no son
   iguales: I01 §8.1, informe de I01-01 §4).

## 3. P18-01 — Peso por reglas: cuándo mantener y cuándo bajar

Aplica a `type: 'double'` (Peso por reglas, con o sin rango) y a las asistidas
(`direction: 'decrease'`, donde «bajar» es añadir ayuda).

### 3.1 Cuándo sube (sin cambios salvo Parcial)

- **Todas**: todas las series llegan al máximo del rango (o a las reps fijas).
- **La mayoría** (antes «Parcial N de M») — *cambia*: **mayoría simple** de las
  series (2 de 3, 3 de 4, 3 de 5), sin elegir N (decisión del usuario, 27-oct).
  Con rango, sube si esa mayoría llega arriba **y ninguna serie baja del mínimo**.
  Sin rango (mín = máx), sube al cumplir la mayoría, sin más condición. Un `need`
  ya guardado se sigue respetando al leer; el editor solo ofrece la mayoría.
- **RPE máx.**: como Todas, y además la media de RPE de las series que lo tienen
  ≤ máximo. **El RPE solo frena**: un día duro nunca baja el peso; solo bajan las
  reps que faltan (decisión del usuario, 27-oct).

### 3.2 Cuándo es fallo, y de qué tamaño

Una sesión **falla** si alguna serie queda por debajo del mínimo. El tamaño:

```
faltan = Σ max(0, mínimo − reps de la serie)      (reps que faltaron, sumadas)
grande = faltan / (mínimo × series) > 15 %
```

El 15 % es el valor de partida del prototipo; se ajusta mirando el visor y vive
como constante con nombre (`BIG_FAIL`), no como número suelto.

**Mejorar no es fallo**: si la sesión falla por poco (no grande) pero hizo **más
reps en total que la anterior con el mismo peso**, cuenta como sesión sin fallo.
Con otro peso no se compara (reps con pesos distintos no dicen nada).

### 3.3 Qué hace

| Sesión | Siguiente |
|---|---|
| Sube (§3.1) | Peso + salto (el de hoy: `increment`) |
| Sin fallo, o fallo leve que mejora | Mantener |
| Fallo leve, el primero | Mantener |
| Fallo leve, el segundo seguido | **Bajar** |
| Fallo grande | **Bajar** |

**Bajar = −10 %, redondeado al escalón del ejercicio y como mínimo un escalón**
(nunca «−3,9 kg»): 100 → 90 · 60 → 55 · 39 → 35 · 10 → 7,5 (escalón 2,5). En una
asistida, +10 % de ayuda con la misma regla. `down: 'never'` sigue mandando:
mantener siempre. Con peso 0 no se baja.

### 3.4 Qué hace falta saber de sesiones anteriores

Hoy el chip de Peso solo mira la última sesión. Para «segundo fallo seguido» y
«mejora» necesita **la anterior**, que ya llega: `progressionHistory(recent)` da
`earlier` (lo usa Por esfuerzo). No hace falta guardar nada nuevo: la racha de
fallos se cuenta mirando hacia atrás en `earlier` hasta la primera sesión sin
fallo, y **solo entre sesiones con el mismo peso**: tras subir o bajar, la racha
empieza de cero (como en el prototipo).

Una serie del ejercicio que no se apunta impide subir, pero no es un fallo:
saltarse una serie por falta de tiempo no baja el peso (decidido al
implementar, 27-oct).

**Probar P18-01**

- [ ] Un ejercicio de Peso 3×10-12 que acabas de subir: haz 10/9/9 → al día
  siguiente la tarjeta dice «Mantén» con el mismo peso, no baja.
- [ ] Repite un día flojo con el mismo peso (otra vez por debajo del mínimo y
  sin más reps en total) → ahora dice «Baja a», un 10 % menos redondeado al
  escalón (95 → 85 en una barra de 2,5).
- [ ] Un día muy malo (p. ej. 5/4/4/3/3 en un 5×5) → baja de una vez, sin
  esperar al segundo día.
- [ ] Por debajo del mínimo pero con más reps en total que la vez anterior
  con el mismo peso → «Mantén», sin bajar.
- [ ] Una asistida que fallas dos días seguidos → «Más ayuda», +10 % de ayuda.
- [ ] Compartir una sesión por WhatsApp desde Clientes: el peso de cada línea
  es el mismo que enseña la tarjeta del Workout de ese cliente.

## 4. P18-02 — Reps y Tiempo: una meta por total

Sustituye a «la serie más floja + el salto» (P12 §4.4), que con 12/12/7 pedía 8
en todas.

### 4.1 La regla

- **Meta = total de reps (o segundos) + el salto por serie**, repartida entre las
  series con el sobrante en las primeras: 31 reps en 3 series, +1 → meta 34 →
  12/11/11. El salto se elige en la hoja: Reps +1 / +2 / +3 reps por serie (por
  defecto +1); Tiempo +5 / +10 / +15 s por serie (`increment.value`).
- **La meta se queda fija hasta alcanzarla.** Solo al llegar (total ≥ meta) se
  calcula la siguiente.
- Hacer **menos que la meta pero igual o más que la sesión anterior** no es
  fallo: la meta sigue.
- **Fallo = menos reps en total que la sesión anterior.** Primer fallo: la meta
  sigue. **Segundo seguido: meta = total de ese día + 1 por serie** (menos que
  antes de la racha, más de lo que hiciste).
- Nunca propone lastrarse: para eso se cambia de estilo de progresión (decisión
  del usuario, 27-oct).

### 4.2 Dónde vive la meta

La meta depende de toda la cadena (se queda fija hasta alcanzarla), así que no se
puede sacar solo de la última sesión. **Se guarda en el log**: cada ejercicio que
`saveSession` escribe lleva `goal: { total, misses }`, lo que la app pedía ese día
y cuántos fallos seguidos llevaba. No es estado derivado que se pueda desviar: es
un hecho («qué te pedía la app ese día»), y de paso le sirve al entrenador.

Lectura de lo antiguo, sin migrar: una sesión sin `goal` se trata como la primera
(meta = su total + 1 por serie, sin fallos).

**Probar P18-02**

- [ ] Dominadas en «Reps» con 12/12/7 la última vez → la tarjeta dice «Sube a
  34 reps en total» con «+3», y debajo «La última vez hiciste 31».
- [ ] Haz 32 (sin llegar a 34) y vuelve otro día → sigue pidiendo 34 en total.
- [ ] Haz dos días seguidos menos que el anterior → al segundo la meta baja a
  lo que hiciste ese día + 1 por serie.
- [ ] Plancha en «Tiempo» con salto de 5 s: 45/40/30 → «130 s en total».
- [ ] En el editor, el resumen de la progresión de un ejercicio por Reps dice
  «Tu total + 1 rep por serie», no «sobre la serie más floja».

## 5. P18-03 — El gris es la última vez; el check guarda la casilla

**Deshace P12 §6.1** («el gris es el plan») por decisión del usuario (27-oct): lo
que hiciste es información útil y estaba escondida; la meta ya la dice el chip.

- El gris de cada serie es **siempre** lo que hiciste en esa serie la última vez:
  peso, reps, tiempo. En todos los estilos (Peso, Reps, Tiempo, Por esfuerzo).
- **El check guarda lo que haya en la casilla, esté en gris o escrito.** Marcar
  sin escribir = «hice lo mismo que la última vez».
- El objetivo del entrenador (`overrideEx`) sigue ganando y sigue en azul.
- `planSet` se queda en `ref(coach, last)`. El calentamiento sigue mirando el peso
  sugerido del chip (P12 §6.2), no el gris.

Consecuencia que se acepta: si toca subir y marcas sin escribir, se guarda el
peso de la última vez. Por eso el chip tiene que decir la meta con claridad (§6).

**Probar P18-03**

- [ ] Un ejercicio de Peso al que toca subir: el gris de cada serie es el peso
  y las reps de la última vez (no el peso nuevo), y la línea de progresión dice
  el peso nuevo.
- [ ] Marca ✓ sin escribir nada → se guarda lo de la última vez (míralo en el
  historial al terminar).
- [ ] Escribe el peso nuevo en la primera serie y marca ✓ las demás sin
  escribir → las demás guardan su gris (lo de la última vez), la primera lo
  escrito.
- [ ] Por esfuerzo y por Reps: el gris también es lo de la última vez.
- [ ] Con un objetivo del entrenador para la sesión, sus valores siguen en
  azul y el ✓ los guarda.
- [ ] El calentamiento sigue rampando hacia el peso que pide la línea de
  progresión, no hacia el gris.

## 6. P18-04 — Mensajes del chip

Dos filas, con la anatomía que ya tiene la línea de progresión de la tarjeta
(`progLine` de `ExerciseCard`, sin pastilla nueva ni fondo):

1. **Qué hacer**: flecha + verbo en mayúsculas de 12 px (`caps`, lima; gris en
   mantener) + la cifra (`labelStrong`) + la pastilla del salto (`progDeltaPill`):
   «↑ SUBE A 62,5 kg (+2,5)».
2. **Por qué / qué falta**: una línea `label` en `mutedLight` debajo.

Formatos aprobados por el usuario (27-oct); la columna «Pastilla» es la fila 1:

| Situación | Pastilla | Línea |
|---|---|---|
| Sube | Sube a 32,5 kg | Llega a 12 en las 3 series para volver a subir |
| Mantener, dentro del rango | Mantén 32,5 kg | Llega a 12 en las 3 series para subir |
| Mantener, fallo leve | Mantén 32,5 kg | Te faltaron 2 reps para el mínimo (10) |
| Mantener, mejora | Mantén 95 kg | Vas mejorando (24 reps); llega a 5 en las 5 series para subir |
| Mantener, freno de RPE | Mantén 62,5 kg | Llegaste arriba, pero con RPE medio 8,8 (máx. 8) |
| Bajar, fallo grande | Baja a 85 kg | Te faltaron 6 reps para el mínimo (5) |
| Bajar, segundo fallo | Baja a 8 kg | Segundo día seguido sin llegar al mínimo |
| Parcial | (como arriba) | Llega a 15 en 2 de 3 series (y el resto a 12 o más) para subir |
| Asistida | Quita ayuda: 27,5 kg · Añade ayuda: 30 kg · Mantén 30 kg de ayuda | … para quitar ayuda |
| Reps | 34 reps en total | La última vez hiciste 31 |
| Reps, mejora / fallo | 37 reps en total | Vas mejorando: la última vez hiciste 35 · La última vez hiciste 27, menos que el día anterior |
| Tiempo | 145 s en total | La última vez hiciste 130 s |

Por esfuerzo conserva su lógica (media del 1RM de las tres últimas sesiones, P12
§6.5; el usuario la confirmó el 27-oct) y pasa al mismo formato: pastilla «Peso
objetivo 140 kg», línea con el motivo de hoy y el 1RM estimado.

Textos en `es.json` y `en.json`, con plurales (`rep`/`reps`). Los de hoy que
dejan de usarse se borran.

Al implementar (27-oct): la línea va ya en la cabecera, a todo lo ancho (A2,
§7), y se oculta al plegar la tarjeta; el 1RM de Por esfuerzo pasa a la fila 2.
Los decimales salen con punto («RPE medio 8.8»), como el resto de cifras de la
tarjeta.
Tras verlo en el móvil (27-oct): cada cifra lleva su unidad («Llega a 15 reps en
las 3 series para subir»; «y el resto a 12 reps o más») y la fila 2 pasa a
`body` (14), porque a 12 se leía mal.

**Probar P18-04**

- [ ] La línea de progresión va dentro de la banda gris de la cabecera, bajo
  el nombre y separada por una raya fina, empezando en el borde izquierdo
  (bajo el número), en dos filas: «↑ SUBE A 62.5 kg (+2.5)» y debajo el
  porqué en gris.
- [ ] Al plegar la tarjeta (completar las series) la línea desaparece; al
  desplegarla vuelve.
- [ ] Tocar la línea abre la ficha de la recomendación, como antes.
- [ ] Mantener por fallo leve: «→ MANTÉN 32.5 kg» en gris y «Te faltaron 2 reps
  para el mínimo (10)»; con una sola rep, «Te faltó 1 rep…».
- [ ] Asistida: «QUITA AYUDA: 27.5 kg», «AÑADE AYUDA: 30 kg» y «MANTÉN 30 kg de
  ayuda».
- [ ] Por esfuerzo: «PESO OBJETIVO 140 kg» y debajo el motivo con el 1RM
  estimado («… · 1RM 158 kg»).
- [ ] Objetivo del entrenador: «◎ OBJETIVO DE TU ENTRENADOR» en azul en la misma
  banda; primera vez: «◇ BUSCA TU PESO» en la banda.
- [ ] Con el móvil en inglés, los mismos mensajes salen traducidos.

## 7. P18-05 — Hoja de Progresión por niveles

**Maqueta v1:** [`progresion-hoja.html`](../mockups/progresion-hoja.html) (27-oct, v3 tras dos revisiones del usuario). Dirección: las **tarjetas de carácter** de
[`stages-v2.html`](../mockups/stages-v2.html) (P15 §3.2: icono, nombre y una
línea, «Volumen · Intensidad · Igual · Descarga»), que al usuario le gustaron por
simples y cómodas, aplicadas a los estilos de progresión:

- **Bajo el nombre del ejercicio, su volumen como meta** («3 × 8–12 reps»), en
  gris. Series y reps no se tocan en esta hoja: siguen en Volumen.
- **Qué sube**, en tarjetas pequeñas con icono: Peso (kettlebell) · Reps · Tiempo ·
  Esfuerzo · Nada (en asistidas, Ayuda en lugar de Peso). La elegida **se rellena
  de lima con el texto en negro**, como todo lo pulsado en la app. Debajo, su
  frase, con la parte que importa en negrita (textos del usuario, 27-oct):
  - Peso: «**Sube el peso** al completar el número máximo de reps del rango.»
  - Ayuda: «**Quita ayuda** al completar el número máximo de reps del rango.»
  - Reps: «**Sube las repeticiones** al superar el objetivo de reps.»
  - Tiempo: «**Aguanta más segundos** que la vez anterior, al completar el objetivo.»
  - Esfuerzo: «El peso **sube o baja en función del esfuerzo**, medido con el RPE.»
  - Nada: «**No se sugieren cambios.** Verás lo que hiciste la última vez y tú
    decides.» Su regla al pie: «Sin sugerencia de progreso.»
  El icono de Reps está por decidir (la maqueta prueba unas flechas en círculo).
- **Cuándo sube** (Peso y Ayuda), en dos tarjetas grandes **con borde** (no
  rellenas) y un cuadradito por serie (tantos como series tenga el ejercicio),
  hablando de series: **Todas las series** · «Las 3 series llegan a 12 reps» ·
  **La mayoría** · «2 de 3 series llegan a 12 reps y ninguna baja de 8 reps»
  (§3.1).
- **Cuánto sube**: chips del salto (1,25 / 2,5 / 5 kg / 5 %; Reps +1 / +2 / +3 por
  serie; Tiempo +5 / +10 / +15 s por serie). En Esfuerzo, **Esfuerzo objetivo**:
  el RPE, con las reps en recámara que significa («RPE 8 · te quedan 2 reps en
  recámara»).
- **Plegado, «Avanzado»**: freno de RPE, cuándo baja (Si fallas / Nunca) y
  escalón. El RPE no aparece fuera de Avanzado salvo en Esfuerzo.
  - **Freno de RPE**: No / RPE. Con RPE aparece el RPE máximo (stepper) y la
    explicación se adapta: «Aunque completes el objetivo de reps, no sube si la
    media de RPE pasa de 8. Nunca baja de peso al superar el RPE.» Con No: «Sube
    al completar el objetivo de reps, sin mirar el RPE.»
- **La línea de progresión del Workout va en la cabecera, a todo lo ancho (A2)**
  (decisión del usuario, 27-oct): dentro de la banda `surface2`, desde el borde
  izquierdo bajo el número (no alineada con el nombre), separada del nombre por una
  raya fina (`border`), con las dos filas de §6 alineadas a la izquierda. Al
  **plegar** la tarjeta, la cabecera se pliega hasta el nombre: **la progresión se
  oculta** y se ve de nuevo al desplegar. Descartadas en la maqueta: bajo el nombre
  (A), centrada (A3, C), franja propia (B) y el sitio de hoy. (Hecho en P18-04.)

Al implementar (27-oct): las tarjetas de «Qué sube» son solo las que valen para
la medida de Volumen (con medida Tiempo: Peso · Tiempo · Nada; Esfuerzo solo con
carga externa y sin asistir, y apagado con Rango: al tocarlo explica que necesita
reps fijas). El freno de RPE es «Todas» con RPE máximo: si se enciende con «La
mayoría» elegida, pasa a «Todas». Por esfuerzo conserva el escalón (o Exacto) y
«Al superarlo / Al llegar» dentro de Avanzado. «Si fallas» ya no guarda número de
fallos, y «La mayoría» se guarda sin `need`. La regla de Nada pasa a «Sin
sugerencia de progreso».

Tras verla en el móvil (27-oct): todo lo de dentro va sobre `surface` (la hoja
es `bg`, y nada dentro de una hoja va en `bg`), los títulos en `mutedLight`, lo
elegido se rellena de lima desde la esquina como las fichas de etapa y el borde
de «Cuándo sube» se enciende con transición. Iconos nuevos con un segundo tono:
mancuerna (Peso), «×10» (Reps), cronómetro (Tiempo), cuentarrevoluciones con
marcas y zona alta (Esfuerzo), «=» (Nada). Las frases de la regla dicen qué se
mide y qué pasa, sin «tu total» ni «se ajusta»: «El objetivo es el total de
repeticiones de la última sesión, sumando todas las series, más 1 rep por
serie…»; y bajar dice el umbral («si faltan más del 15 % de las repeticiones»).

**Probar P18-05**

- [ ] Editor de un press de banca 3×8-12 → Progresión: bajo el nombre «3 ×
  8–12 reps» en gris; «Qué sube» en tarjetas con icono (Peso · Reps · Esfuerzo ·
  Nada) y la elegida rellena de lima con el texto en negro; debajo su frase con
  la parte que importa en negrita.
- [ ] Toca cada tarjeta: la frase cambia y aparecen solo los bloques que
  tocan (Cuándo sube y Avanzado solo en Peso; Esfuerzo objetivo solo en
  Esfuerzo; nada más en Nada).
- [ ] Esfuerzo con Rango en Volumen: la tarjeta sale apagada y al tocarla dice
  que necesita reps fijas.
- [ ] Cuándo sube: dos tarjetas con borde y un cuadradito por serie; «La
  mayoría» dice «2 de 3 series llegan a 12 reps y ninguna baja de 8 reps».
- [ ] Cuánto sube: chips 1.25 · 2.5 · 5 kg · 5 %; en Reps +1 / +2 / +3 reps;
  en Tiempo +5 / +10 / +15 s. Lo elegido se guarda al salir y vuelve igual.
- [ ] Avanzado plegado; al abrirlo: Freno de RPE (No / RPE, con RPE máximo y su
  explicación), Cuándo baja (Si fallas / Nunca) y Escalón del ejercicio.
- [ ] Una dominada asistida: la tarjeta dice «Ayuda» y la frase «Quita ayuda…».
- [ ] La frase de la regla al pie, con la raya lima, cambia con lo que eliges.
- [ ] El alta de un ejercicio propio abre la misma hoja con el nombre escrito.

## 8. Casos

Salen de las trazas del visor (`scripts/visor-progresion/casos.js` +
`motorPropuesto.js`), revisadas con el usuario el 27-oct. Los tests de P18 las
citan con el literal (`// P18 §8, caso 3`).

| # | Entrada | Siguiente | Regla |
|---|---|---|---|
| 1 | 3×10-12, sube a 32,5 kg y hace 10/9/9 | Mantén 32,5 · faltaron 2 reps | §3.3 fallo leve |
| 2 | 3×12-15, 9,25 kg, 10/9/9 (faltan 8 de 36 = 22 %) | Baja a 8 kg | §3.3 fallo grande, −10 % al escalón 1,25 |
| 3 | 5×5, 95 kg: 5/5/5/4/4 y luego 5/5/5/5/4 | Mantén 95 (las dos veces) | §3.2 mejora no es fallo |
| 4 | 5×5, 95 kg: 5/5/5/4/4 y luego 5/5/4/4/4 | Baja a 85 kg | §3.3 segundo fallo leve seguido |
| 5 | 5×5, 95 kg: 5/4/4/3/3 (24 %) | Baja a 85 kg | §3.3 fallo grande |
| 6 | Parcial 2 de 3, 12-15: 15/15/11 | Mantén (no sube) | §3.1 el resto fuera del rango |
| 7 | Parcial 2 de 3, 12-15: 15/15/13 | Sube | §3.1 |
| 8 | RPE máx. 8, 12/12/12 a RPE 8/9/9,5 | Mantén · RPE medio 8,8 | §3.1 el RPE solo frena |
| 9 | RPE máx. 8, 10/10/9 a RPE 8/8/9 | Mantén (no baja) | §3.1 |
| 10 | Asistida 3×5-8, 27,5 kg de ayuda: 6/4/4 dos veces | Añade ayuda: 30 kg | §3.3 en asistidas |
| 11 | Bajar con 100 · 60 · 39 · 10 kg (escalón 2,5) | 90 · 55 · 35 · 7,5 | §3.3 |
| 12 | Reps, 12/12/7 = 31 | 34 en total → 12/11/11 | §4.1 |
| 13 | Reps, meta 34: hace 32, luego 33 | Sigue 34 | §4.1 mejora |
| 14 | Reps, meta 37: hace 27 (antes 34) | Sigue 37 | §4.1 primer fallo |
| 15 | … y luego 16 | 19 en total → 7/6/6 | §4.1 segundo fallo |
| 16 | Tiempo, salto 5 s: 45/40/30 = 115 s | 130 s en total → 44/43/43 | §4.1 |
| 17 | Por esfuerzo 3×5 @8: día fácil tras uno normal (140 kg) | Mantén 140 (la media no cruza el redondeo) | §6, sin cambios |
| 18 | Cualquier estilo | El gris es lo de la última vez; el check sin escribir lo guarda | §5 |

## 9. Fuera de esta versión (visión anotada)

Del replanteo del 27-oct, para cuando se retome (idea **P17 · Etapas con objetivos
de rendimiento** de `ideas.md`):

- El programa y cada etapa tienen un **enfoque** (no «objetivo»: eso es adónde
  quieres llegar) que fija cómo progresan sus ejercicios. Cada enfoque existe con
  y sin RPE. Se elige entre los que ofrecemos; no se personaliza.
- Cada ejercicio tiene un estilo «del enfoque» (nombre por buscar) que se hereda
  en vivo mientras no elijas otro; si cambia el enfoque, cambia con él.
- Las etapas suman fase (acumulación, intensificación…) + enfoque, y podrían
  terminar por logro o por carga acumulada, no solo por semanas.
- Marcas («sentadilla a 140»): meta visible con la tendencia real y aviso de
  realismo; nunca dictan el peso de cada sesión.
- Volver tras semanas sin entrenar, top set + back-off: sin soporte por ahora.

## 10. Fases

| Fase | Qué | Toca | Coste |
|---|---|---|---|
| P18-01 | Peso por reglas: fallo leve/grande, mejora, −10 %, Parcial con rango | `progression.js` (+ una sola función para los tres sitios) | 🟡 ✅ ddd2f41 — `progressionChip` para tarjeta, guardado y WhatsApp; una serie sin hacer no es fallo |
| P18-02 | Reps y Tiempo por total, meta en el log | `progression.js`, `saveSession` | 🟡 ✅ 7917e27 |
| P18-03 | Gris = última vez, check guarda la casilla | `setPlan.js`, `ExerciseCard`, `saveSession` | 🟢 ✅ da1f42c |
| P18-04 | Mensajes del chip, es/en | `progression.js`, locales, tarjeta | 🟢 ✅ 964c2c4 — con la línea ya en la cabecera (A2) |
| P18-05 | Hoja por niveles | editor de ejercicio, tras maqueta | 🟡 ✅ 26bffb9 |

Cada fase de motor cierra con los casos de §8 como tests (literal + cita) y el
visor regenerado con el motor real en lugar del prototipo.
