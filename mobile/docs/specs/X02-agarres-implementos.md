# Spec — Agarres e implementos del maniquí          (archivo: X02-agarres-implementos.md)

> Tema: ejercicios
> En corto: Cambiar de barra a mancuernas o kettlebell (y de agarre prono a neutro) sin hacer otra animación: el implemento lo pone la app, la mano se coloca sola en su asa y los dedos se cierran según el grosor, a partir de dos o tres manos hechas en Blender.
> Inicio: 2026-11-04
> Fin: 2026-11-04
> Fase X02-01 · hecho · Manos de referencia en Blender y su exportación · §3
> Fase X02-02 · hecho · Dedos por grosor y hueco del puño desde la mano de referencia · §4
> Fase X02-03 · hecho · Catálogo de implementos en el visor · §5
> Fase X02-04 · hecho · Peso muerto y rumano con mancuernas y kettlebell · §6
>
> Estado: escrita el 4-nov-2026 tras hablarlo con el usuario. **X02-01…04 hechas** el 4-nov (rama `feat/x01-peso-muerto`, sin probar por el usuario): script `blender/ejercicios/_manos.py` y exportación de `hands` (el usuario ya retocó las tres manos y movió las asas); en el visor, dedos y hueco por grosor, implementos barra · mancuernas delante · a los lados · kettlebell y su selector en peso muerto y rumano. De §5 faltan barra fija, asas paralelas y maneral de polea: llegan con la dominada y los remos (X01-13). Va en la rama del maniquí ([X01](X01-maniqui-3d.md), `formfit-mannequin/`). Dominada y remos, que usan este sistema, están en X01-13 (§16 de X01).

## 1. Contexto

Hoy cada ejercicio es una acción de Blender con la barra; la mano se cierra en un puño fijo (`ffpose.fist`) y el visor la lleva a la barra con el hueco del puño (`socketRest`). Cambiar a mancuernas o kettlebell en el peso muerto exigiría otra acción, aunque el movimiento sea prácticamente el mismo; y lo mismo pasa con el agarre (prono, supino, neutro) en dominadas y remos.

La [decisión 10 de X01](X01-maniqui-3d.md#2-decisiones-del-usuario-2-nov-2026-no-reabrir) dice que todas las formas de T08 son acciones de Blender. Esta spec la matiza: **una acción por movimiento distinto**, no por implemento. Si el recorrido es el mismo, el implemento lo cambia la app; si cambia de verdad (el swing con kettlebell no es un peso muerto), tiene su acción.

## 2. Tres capas

| Capa | Quién la hace | Qué es |
|---|---|---|
| **Movimiento** | Blender (una acción por ejercicio) | Cuerpo, recorrido, ritmo. La acción declara con qué implemento se autoró (`ff_implement`, por defecto `barra`). |
| **Implemento** | La app (geometría del visor) | Asas (posición, eje, grosor), dónde está su peso y cómo se dibuja. No se modela en Blender. |
| **Mano** | Blender, una vez (2–3 manos de referencia) | Cómo se cierran los dedos. La app mezcla entre ellas según el grosor del asa. |

Regla de fidelidad: **con el implemento de la acción**, los dedos son los de la acción (lo que se retocó a mano se respeta) y sale la pose de Blender. Con otro implemento, mandan las manos de referencia.

## 3. X02-01 · Manos de referencia en Blender y su exportación

En el `.blend`:

- Una colección `FF_asas` (oculta al renderizar) con **asas de referencia**: cilindros de 28 mm (barra) y 40 mm (asa gruesa), y uno de 18 mm opcional para el agarre de gancho más adelante. Son la guía para posar, no se exportan como malla.
- Una acción por mano de referencia, con prefijo `_mano.` (el exportador ya ignora las que empiezan por `_` como ejercicios):
  - `_mano.abierta` — mano relajada, para colgar sin agarrar y como extremo de la mezcla;
  - `_mano.28` — puño cerrado sobre el asa de 28 mm;
  - `_mano.40` — puño cerrado sobre el asa de 40 mm.

  Un script (`blender/ejercicios/_manos.py`) las crea con la mano izquierda y la derecha sobre su asa, cerrando los dedos con `ffpose.fist` como base; **el usuario las retoca** a mano. Cada acción guarda el diámetro de su asa (`ff_diametro`).

El exportador añade a `poses.json` un bloque `hands`:

```js
hands: {
  '28':      { d: 0.028, L: { fingers: { 'DEF-FINGER-B-01.L': q, … }, hollow: { p, axis } }, R: { … } },
  '40':      { d: 0.040, … },
  'abierta': { d: null,  … },
}
```

- `fingers`: rotación local de cada hueso de dedo y pulgar respecto a `DEF-HAND` (lo que hay que copiar en la mano del visor).
- `hollow`: centro y eje del asa **en el marco de la mano** (el eje del cilindro de referencia visto desde `DEF-HAND`). Sustituye a la aproximación de `socketRest`.

**Probar X02-01**

- [ ] Abrir el `.blend`: las asas de referencia y las tres acciones `_mano.` están; con cada acción, los dedos rodean su asa.
- [ ] Retocar un dedo en `_mano.28`, exportar: `poses.json` lo trae y ningún ejercicio cambia (fidelidad 0,0 mm).

## 4. X02-02 · Dedos por grosor y hueco del puño desde la mano de referencia

En `runtime.js`:

- **Dedos:** para un asa de diámetro `d`, se mezclan las dos manos de referencia más cercanas (`_mano.28` y `_mano.40`, slerp por hueso); por debajo de 28 mm se usa la de 28, por encima de 40, la de 40. Sin asa (colgar las manos), la abierta.
- **Hueco:** el centro y el eje del asa en la mano salen de la mano de referencia (mezclados igual). La mano se gira para que ese eje coincida con el del asa del implemento y, alrededor de él, según la orientación del agarre (prono, supino, neutro); la muñeca se coloca desde el hueco y el brazo llega por IK, como ahora.
- Con el implemento de la acción, todo esto no se aplica: dedos y hueco son los de la acción (regla de §2).

**Probar X02-02**

- [ ] Peso muerto con barra: igual que antes (los dedos son los de la acción).
- [ ] Cambiar el grosor del asa de 28 a 40 mm (en el visor de pruebas): los dedos se abren poco a poco y siguen rodeando el asa, sin atravesarla.

## 5. X02-03 · Catálogo de implementos en el visor

Cada implemento declara:

| Implemento | Asas | Eje del asa | Ø | Peso (para el CdM) | Apoyado en el suelo |
|---|---|---|---|---|---|
| Barra | dos puntos a la anchura de agarre | a lo largo de la barra | 28 mm | en el centro de la barra | asa a 22,5 cm (radio del disco) |
| Mancuernas | una por mano | según la orientación: transversal (prono) o sagital (neutro) | 32 mm | en cada asa | asa a ~10 cm (radio del disco pequeño) |
| Kettlebell | una para las dos manos (o una por mano si son dos) | transversal | 35 mm | ~12 cm bajo el asa | asa a ~25 cm |
| Barra fija | dos puntos a la anchura de agarre | transversal | 28 mm | — (cuelga el cuerpo) | — |
| Asas paralelas (dominada neutra) | una por mano, a la anchura de la máquina | sagital | 32 mm | — | — |
| Maneral de polea | una o dos asas en el extremo del cable | según el maneral | 32 mm | en el cable | — |

- Se dibujan con geometría del visor (como la barra hoy), con los colores del tema.
- El centro de masas usa el peso del implemento donde esté (hoy usa la barra); la «Carga» reparte el peso entre los implementos si son dos.
- La altura «en el suelo» de cada implemento es la que usa el punto bajo de la bisagra (hoy fija al radio del disco).

**Probar X02-03**

- [ ] En el visor de pruebas se pueden poner los seis implementos y se ven a escala junto al maniquí.

## 6. X02-04 · Peso muerto y rumano con mancuernas y kettlebell

Primer uso real, porque el movimiento ya existe y se ve enseguida si funciona. Corregido con el usuario el 4-nov tras verlo:

- **Qué admite cada uno.** El convencional empieza en el suelo: solo lo que se apoya bien en él, **barra y kettlebell (una o dos)**; mancuernas, no. El rumano admite todo: barra, mancuernas delante, mancuernas a los lados, una o dos kettlebells.
- **La gran diferencia: quién manda en la altura.** En el convencional, **el implemento** (empieza con su asa en el suelo; una kettlebell la tiene más alta que la barra). En el rumano, **las manos**: con cualquier implemento la mano va exactamente por donde iba con la barra, y el implemento solo limita (no atraviesa el suelo). Cambiar de implemento nunca baja las manos.
- **Mancuernas delante:** el asa ligeramente girada, con el pulgar hacia delante (rotación externa del brazo), más natural que paralela a la barra. **A los lados:** asa de delante a atrás, agarre neutro, junto a los muslos.
- **Una kettlebell:** entre los pies, las dos manos en el asa. **Dos:** una por mano, junto a los pies, asa de delante a atrás.
- Todo lo demás (rodilla, profundidad, bloques, déficit, cuerpo, equilibrio) funciona igual que con la barra.
- Para más adelante (idea del usuario): que, con el peso que se usa, aparezcan las kettlebells, mancuernas o discos que tocan.

**Probar X02-04**

- [ ] Rumano con mancuernas delante, a los lados y con una y dos kettlebells: las manos agarran el asa todo el recorrido, los dedos la rodean y la mano va a la misma altura que con la barra.
- [ ] Convencional: solo deja elegir barra y kettlebells; con kettlebell empieza con su asa en el suelo.
- [ ] Con mancuernas a los lados o dos kettlebells, los brazos pasan junto a los muslos sin atravesarlos.
- [ ] Volver a barra deja el ejercicio exactamente como estaba.

## 7. Fallos vistos al probar en el móvil (4-nov-2026, sin corregir)

El usuario lo da por bueno para empezar y deja esto para más adelante (decidido seguir con la dominada):

- **Choques (clipping)** entre implementos, brazos y piernas.
- **Una kettlebell entre los pies** debería limitar cuánto pueden cerrarse los pies (la bola tiene que caber entre ellos).
- **Al subir, los brazos se meten un poco en el tronco** (con implementos que no son la barra).
- Algo más de lógica por implemento que habrá que ir añadiendo (por ejemplo, separación mínima entre manos, piernas y pesas).

## 8. Fuera de alcance

- Dedos calculados falange a falange para abrazar cualquier cilindro (posible más adelante si la mezcla no basta).
- Agarre de gancho, falso agarre, correas: cada uno sería una mano de referencia más cuando haga falta.
- **Una mancuerna con las dos manos** (sentadilla goblet: las palmas sujetan la cabeza, el agarre es curvo). Idea del usuario (4-nov): otra mano de referencia (`_mano.copa`) con su propia referencia de forma, o la acción del ejercicio con sus dedos; se decide al hacer la goblet.
- Swing, clean y demás movimientos propios de la kettlebell: tienen su acción.

## Fases

| Fase | Qué | Depende de | Estado |
|---|---|---|---|
| X02-01 | Manos de referencia en Blender y exportación | — | hecho (manos retocadas por el usuario el 4-nov) |
| X02-02 | Dedos por grosor y hueco del puño | X02-01 | hecho |
| X02-03 | Catálogo de implementos en el visor | — | hecho (barra fija, paralelas y maneral, con la dominada y los remos) |
| X02-04 | Peso muerto y rumano con mancuernas y kettlebell | X02-02, X02-03 | hecho |
