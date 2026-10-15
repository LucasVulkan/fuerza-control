# Spec — Mantenimiento del catálogo de ejercicios

> Tema: entrenamiento
> En corto: Repaso de la librería de ejercicios: categoría de acondicionamiento para los bloques, material bien puesto (el trineo no es peso corporal), nombres coherentes, búsqueda por otros nombres y 54 ejercicios nuevos (WOD, halterofilia, kettlebell, huecos de gimnasio y progresiones de calistenia).
> Inicio: 2026-10-15
> Fin: 2026-10-15
> Fase T07-01 · hecho · Categoría «Acondicionamiento», material nuevo y carga del trineo · §3
> Fase T07-02 · hecho · Nombres, alias y patrones corregidos · §4
> Fase T07-03 · hecho · Ejercicios nuevos · §5
> Fase T07-04 · hecho · Decisiones: fuera la barra EZ; brazos y GHD se quedan · §6
>
> Estado: implementada el 15-oct-2026, sin commit; tests verdes (1947) y lint sin errores nuevos. Librería: 177 → 230 ejercicios (54 nuevos + press francés con mancuernas, −2 de barra EZ).

---

## 1. Contexto

La librería (`src/data/exerciseLibrary.js`) no se persiste (`partialize`), así que
añadir o corregir ejercicios se ve al arrancar y no necesita migración. Lo que sí
guarda ids —plantillas, historial, derivados en `customExercises`— obliga a **no
cambiar ni borrar ids** sin la migración de `exerciseIdMigration.js` (P09 §3.3).
Por eso esta pasada solo **corrige y añade**; lo que implicaría fusionar ids queda
en §6 para decidir.

Piezas que miran la taxonomía:

- `src/utils/exerciseTaxonomy.js` — patrones, grupos, material (fuente única).
- `ExerciseSelectorScreen` — pills y filtros (tenía copias locales de grupos y
  material; el material ahora sale de la taxonomía).
- `CustomExerciseScreen` — alta de ejercicio propio, pinta los mismos catálogos.
- `slotResolver` — el generador sustituye ejercicios por patrón + grupo; un
  ejercicio nuevo **entra en sus candidatos**, de ahí las prioridades de §5.
- `trainingLoad.isBodyweight` — decide si el peso apuntado es la carga o un lastre
  que se suma al peso corporal.

## 2. Auditoría (15-oct-2026)

| Hallazgo | Ejemplo | Qué se hace |
|---|---|---|
| No había categoría de acondicionamiento | Burpee en Core, Ski Erg en Tracción, trineo en Sentadilla | §3 |
| Material que cambia la carga | Trineo sin material → la app sumaba tu peso corporal al del trineo | §3 |
| Material mezclado | Battle rope y cuerda de trepar eran la misma «Cuerda» | §3 |
| Adjetivos en femenino que se refieren a la persona | «Curl isquios tumbada», «Elevación de piernas tumbada» | §4 |
| Paréntesis en nombres (el usuario los descartó en P09) | «Peso muerto rumano (barra)», «Flexiones (progresiva)» | §4 |
| El nombre habitual no encuentra el ejercicio | «press militar» solo daba la barra; «remo australiano», «pec deck» | §4 (alias) |
| Patrones raros en calistenia | Planche lean y pino en Core | §4 |
| Huecos de cobertura | Sin halterofilia, casi sin kettlebell, sin multipower, sin sentadilla sin peso ni puente de glúteo, sin elevaciones frontales | §5 |
| Escaleras de calistenia incompletas | Faltaban flexiones inclinadas/de rodillas, negativas, escapulares, agrupados de lever/planche/L-sit… | §5 |
| Brazos dentro de Empuje/Tracción | Los curls salen en «Tracción» y los tríceps en «Empuje» | §6: se queda así |
| Duplicados reales | Remo landmine ≈ remo Meadows; press francés con barra ≈ con barra EZ | §6: fuera la barra EZ |

### 2.1 Variantes «reales»: los remos

Hay 13 remos. Aplicando la regla de P09 (*¿mueves más o menos el mismo peso? → variante;
cambia el implemento o pasa a una mano → otro ejercicio*):

- **Bien separados** por implemento: polea, polea unilateral, polea alta, máquina,
  mancuerna a una mano, pecho apoyado con mancuernas, barra, seal row (barra en
  banco alto), remo en T, invertido (barra baja), anillas.
- **Solapan**: `landmine_row` (a una mano) y `meadows_row` son el mismo gesto con el
  mismo material; Meadows es solo una forma concreta de colocarse. Propuesta en §6.
- **No faltan**: Pendlay y Yates son variantes del remo con barra (salida desde el
  suelo / agarre supino, que ya es variante de agarre). Kroc es el de mancuerna pesado.

Otros pares revisados y que se quedan: búlgara / zancada estática (pie elevado),
prensa con pies centrados / altos / abiertos (no hay dimensión «pies» en las
variantes; ya existían así), zancada caminando con mancuernas / con barra.

## 3. T07-01 — Acondicionamiento, material y carga

- Patrón nuevo **`conditioning`** («Acondicionamiento»), pill propia en el buscador.
- Grupo nuevo **`full_body`** («Cuerpo completo»). Lo llevan todos los de
  acondicionamiento: **ningún hueco de plantilla pide ni ese patrón ni ese grupo**,
  así que el generador nunca mete una carrera o un trineo en un programa de fuerza.
- Pasan a acondicionamiento: burpee, mountain climber, gateo del oso, battle rope,
  empuje de trineo, Ski Erg.
- Material nuevo: `sled` (Trineo), `cardio_machine` (Máquina de cardio),
  `medicine_ball` (Balón medicinal), `jump_rope` (Comba), `battle_rope`.
- `trainingLoad.LOAD_BEARING_EQUIPMENT` gana `sled` y `medicine_ball`: lo apuntado
  es la carga. La comba y las máquinas de cardio no llevan peso.
- Empuje de trineo: material `sled` y un consejo que dice qué apuntar.

**Probar T07-01**

- [ ] Selector de ejercicio: la pill «Acondicionamiento» sale al final y lista 19
  (remo ergómetro, bici de aire, comba, trineo, wall ball, burpee…).
- [ ] Filtros → Equipo: salen Trineo, Máquina de cardio, Balón medicinal, Comba y
  Battle rope, y filtran bien.
- [ ] Bloque AMRAP → «＋ Añadir movimiento» → pill Acondicionamiento → añadir Wall
  ball y Dobles de comba.
- [ ] Empuje de trineo con 100 kg en un entreno: en Progreso el peso es 100 kg, no
  100 + tu peso corporal.
- [ ] Crear ejercicio propio: aparecen el patrón «Acondicionamiento» y el grupo
  «Cuerpo completo».

## 4. T07-02 — Nombres, alias y patrones

- **Género**: «Curl femoral tumbado», «Elevación de piernas tumbado». («Pistol squat
  asistida» se queda: concuerda con *sentadilla*.)
- **Sin paréntesis** y con el implemento al final, como el resto: «Peso muerto rumano
  con barra / con mancuernas», «Remo con mancuerna a una mano», «Remo invertido»,
  «Fondos asistidos con banda», «Prensa de piernas / con pies altos / con pies
  abiertos», «Zancada estática», «Press inclinado con mancuernas», «Pájaros en
  máquina / con mancuernas», «Aperturas en máquina», «Press francés», «Extensión de
  tríceps en polea / sobre la cabeza con mancuerna / en polea», «Paseo con maleta»,
  «Flexiones», «Curl de bíceps con mancuernas», «Elevaciones laterales con
  mancuernas», «Jalón con brazos rectos», «Flexión en pino contra la pared», «Pino
  libre», «Planche lean», «Gateo del oso», «Hiperextensión inversa», «Elevación de
  gemelos en burro», «Rueda abdominal».
- **Press militar**: el de mancuernas y el de máquina se llaman ya «Press militar con
  mancuernas / en máquina» (alias «press de hombros»).
- **Alias** (`aliases: []` en la ficha, solo buscador): el selector y el buscador
  del constructor buscan en nombre + nombre en inglés + alias. Ej.: «remo
  australiano», «pec deck», «contractora», «split squat», «rollout», «chin up».
- **Patrones**: planche lean → empuje horizontal; pino libre → empuje vertical; front
  y back lever → tracción horizontal.
- Ids sin tocar: el historial y los programas siguen igual, solo cambia lo que se lee.
  Los derivados ya creados («… unilateral», «… · Prono») guardan el nombre viejo.
- Corregido el consejo del burpee (decía «flexión» dos veces).

**Probar T07-02**

- [ ] Buscar «press militar» → barra, mancuernas, máquina, multipower y kettlebell.
- [ ] Buscar «remo australiano» → Remo invertido; «pec deck» → Aperturas en máquina
  y Pájaros en máquina.
- [ ] Un programa que ya tenía «Curl isquios tumbada» enseña «Curl femoral tumbado»
  y conserva su historial y su «última vez».

## 5. T07-03 — Ejercicios nuevos (54)

Todos con `isKeyCandidate: false`. Prioridades pensadas para el generador: las
**regresiones** van con prioridad baja (`REG`) para que nunca ganen a su ejercicio
de referencia (unas flexiones de rodillas no desplazan a las flexiones), y la
halterofilia va en `medium` para no quitarle el sitio al peso muerto.

| Bloque | Ejercicios |
|---|---|
| Acondicionamiento (13) | Remo ergómetro, Bici de aire, Carrera, Comba, Dobles de comba, Wall ball, Slam con balón medicinal, Arrastre de trineo, Jumping jacks, Rodillas al pecho, Swing americano, Arrancada con mancuerna, Devil press |
| Halterofilia y kettlebell (11) | Cargada de potencia, Cargada colgante de potencia, Cargada en sentadilla, Dos tiempos, Arrancada de potencia, Arrancada, Push jerk, Cargada / Arrancada / Press militar con kettlebell, Levantamiento turco |
| Huecos de gimnasio (11) | Press de banca, Sentadilla y Press militar en multipower; Elevaciones frontales con mancuernas; Elevaciones laterales en máquina; Sentadilla sin peso; Zancada lateral; Puente de glúteo; Sentadilla isométrica en pared; Crunch inverso; Superman |
| Calistenia (19) | ver escaleras abajo |

Escaleras de calistenia (en **negrita** lo nuevo):

- Flexiones: **inclinadas** → **de rodillas** → flexiones → diamante / declinadas →
  **con palmada** → arquero → **pseudo planche** → **a una mano**.
- Dominadas: dead hang → **escapulares** → remo invertido → **negativas** → asistidas →
  dominadas / supinas → **al pecho** → **arquero** → máquina de escribir.
- Fondos: en banco → **soporte en paralelas** → asistidos → paralelas → anillas;
  **fondos en barra recta** → muscle-up asistido → muscle-up → **muscle-up en anillas**.
- Pino: flexión pica → **pica con pies elevados** → **pino contra la pared** → flexión en
  pino contra la pared → pino libre → flexión en pino.
- Levers y planche: **front lever agrupado** → front lever; **back lever agrupado** →
  back lever; planche lean → **planche agrupada**.
- Core / pierna: **L-sit agrupado** → L-sit; pistol asistida → pistol → **sentadilla del
  camarón**.

**Probar T07-03**

- [ ] Buscar «flexiones» lista la escalera completa, y cada ficha tiene consejos en
  español y en inglés.
- [ ] Onboarding con «solo peso corporal» genera un programa normal: no aparecen
  carrera, comba ni trineo.
- [ ] Un ejercicio de tiempo nuevo (Pino contra la pared) se registra por segundos.

## 6. T07-04 — Decisiones (15-oct-2026)

1. **Barra EZ fuera.** Mueve lo mismo que la recta, así que no es otro ejercicio:
   se borran `ez_bar_curl` y `ez_bar_skull_crusher`. El curl con barra y el press
   francés dicen en un consejo que valen con las dos, y buscan por «barra ez».
   - Las dos plantillas que usaban `ez_bar_curl` pasan a `bicep_curl_barbell`.
   - Los ids viejos van a `LEGACY_IDS` (`exerciseIdMigration.js`) → curl con barra y
     press francés. No se pidió conservar el historial, pero sin esto un programa
     guardado apuntaría a un ejercicio que ya no existe; de paso el historial se
     junta.
   - El press francés deja de mezclar implementos: `skull_crusher` es solo barra y
     nace **Press francés con mancuernas** (`skull_crusher_db`).
2. **Curls y tríceps se quedan** en Tracción/Empuje por ahora.
3. **GHD se queda** con `machines`: son ejercicios que dependen poco del peso
   corporal; el error es pequeño.
4. **Remo landmine / Meadows**: sin decidir; siguen los dos.

**Probar T07-04**

- [ ] Un programa con «Curl con barra EZ» o «Press francés con barra EZ» abre con
  «Curl de bíceps con barra» / «Press francés» y su historial.
- [ ] Buscar «barra ez» → curl con barra y press francés.
- [ ] Buscar «press francés» → con barra y con mancuernas.

## Fases

| Fase | Qué | Estado |
|---|---|---|
| T07-01 | Acondicionamiento, material, carga del trineo | hecho, sin commit |
| T07-02 | Nombres, alias, patrones | hecho, sin commit |
| T07-03 | 54 ejercicios nuevos | hecho, sin commit |
| T07-04 | Fuera la barra EZ; brazos y GHD se quedan | hecho, sin commit |
