# Oráculo independiente — tablas de casos (spec I01 §3.3)

> **PENDIENTE DE FIRMA. Nada de esta tabla está firmado por el usuario.**
> Las escribió un agente (Sonnet) que solo leyó las specs, sin acceso al código.
> Hasta que el usuario firme una subtabla, sus filas **no** se contrastan con el
> código ni se convierten en tests (I01 §3.3, paso 2). Para firmar: corregir aquí
> las filas que no cuadren con lo que quieres, responder las «Preguntas para el
> usuario» de cada módulo y marcar la casilla de la subtabla.
>
> - [ ] 1A Motor · - [ ] 1B Por esfuerzo · - [ ] 1C setPlan · - [ ] 1D progressionForm
> - [ ] 2 1RM · - [ ] 3 Calentamiento
> - [ ] 4A Semanas · - [ ] 4B Bloqueos · - [ ] 4C Sesión que toca
> - [ ] 5A applyRx · - [ ] 5B Planificador · - [ ] 5C Propuesta (aparcada)
> - [ ] 6A Carga · - [ ] 6B Agregados · - [ ] 6C Series por grupo
>
> **Revisión del 27-oct, tras P18 (motor de progresión nuevo):**
>
> | Subtabla | Estado | Por qué |
> |---|---|---|
> | 1A Motor | **Sustituida** | La reemplazan los 18 casos de P18 §8, revisados con el usuario en el visor y ya convertidos en tests. No se firma. |
> | 1B Por esfuerzo | En pie, por firmar | P18 dice que Por esfuerzo conserva su lógica. Sus 4 preguntas siguen abiertas. |
> | 1C setPlan | **Hay que reescribirla** | P18-03: el gris pasa a ser lo de la última vez (SP-01, 03, 04, 06, 08, 10, 11 y 17 ya no valen) y P18-04 cambia los textos del chip (SP-18 a 23). Quedan SP-02, 05, 09, 12-16. |
> | 1D progressionForm | **Parcial** | P18-01/05: «Parcial N de M» pasa a «La mayoría» por mayoría simple y la bajada va por reglas (CF-01, 02, 13, 14, 22-24 cambian). La lectura de lo guardado antiguo (CF-09 a 18) sigue. |
> | 2 1RM · 3 Calentamiento | En pie, por firmar | Su código no ha cambiado desde la tabla. |
> | 4A-4C Etapas | En pie, por firmar | LK-13 respondida: activar la etapa en la que ya estás la **reinicia** (P14-09). Sigue abierta la pregunta 1 de 4A. |
> | 5A-5C Prescripción | En pie (5C aparcada) | Sin cambios. |
> | 6A-6C Carga y volumen | **Esperar** | P18 anuncia que la carga semanal se revisa aparte, con el visor, en su propia spec. Firmarla antes es firmar algo que va a cambiar. |
>
> **Respuestas del usuario (27-oct), contrastadas con el código:**
>
> - **1B.1** 1RM con la media de las series: **ya es así** (`sessionE1rm` promedia las series y `chipEffort` las tres últimas sesiones). PE-18 sigue igual: el peso calculado se compara con el más alto de la última vez.
> - **1B.2** Escalón en Por esfuerzo: **gana el que elijas**, y Exacto da el valor exacto. Es lo que hace `resolveStep`: el tope de 2,5 solo se aplica al de la librería cuando no has elegido ninguno. PE-11, 12 y 13 quedan firmadas.
> - **2.3** Ventana del «mejor 1RM reciente»: **4 semanas en los dos sitios** (decidido tras revisar la literatura; I01-08 §13.5, hecho).
> - **3.1** Calentamiento: base = el peso objetivo; **si no has marcado ninguna serie de calentamiento y escribes un peso en la primera serie de trabajo, se recalcula con ese**. ⚠ Hoy no es así: lo escrito es lo último de la cascada (`resolveWorkWeight`). **Hecho en I01-08.**
> - **3.2** En lb: redondear a 5 lb, como se hace habitualmente. ⚠ Hoy redondea a 2,5 kg y convierte, y salen cifras raras. **Hecho en I01-08.**
> - **3.5** Asistidas: rampa de **más ayuda a menos**, hasta la ayuda de trabajo. ⚠ Hoy calcula porcentajes de la ayuda: el 40 % de la ayuda es *menos* ayuda, o sea más difícil que el trabajo. **Fallo; arreglado en I01-08** (con 30 kg: 47,5 · 42,5 · 35).
> - **4A.1** Fin de etapa: son semanas. La excepción es `earlyReady`, que en la última semana ofrece avanzar si ya están todas las sesiones previstas, aunque sean la misma repetida. **Se queda** (usuario, 27-oct).
> - **4A.2** Alargar = sesiones que faltan ÷ sesiones por semana, redondeado (3→1, 4→1, 5→2, 6→2 con 3/semana). **Ya es así** (`Math.round`; con media semana justa se redondea hacia arriba).
> - **4C.1** El «+1» **no se suma al total**: «Semana 5 de 4+1». ⚠ Hoy dice «Semana 5 de 5 (+1)». **Hecho en I01-08.**
> - **5.1** El usuario no sabía que un preset tocara el salto. ⚠ Sí lo hace: el 2.º peldaño de Intensificación lleva `incrementScale: 0.5`, que con escalón de 2,5 no cambia nada (se redondea otra vez a 2,5). **Quitado** (usuario, 27-oct: por ahora las etapas no tocan la progresión salvo la descarga; I01 §13.6).
> - **5.3** Rangos de series y reps: **sin límites**. `applyRx` ya no recorta (solo suelos: mínimo 1 serie y 1 rep); quien limita es el planificador (±3 series, ±6 reps en `RX_FIELDS`).

Fuente única: las nueve specs P12, P10, T02, T05, P08, C03, P06, P07, T04 (carpeta `mobile/docs/specs`). No se ha leído código.
Confianza: **alta** = la spec da número o regla explícita; **media** = se deduce directamente de una regla; **baja** = la spec no lo fija (hay pregunta).
Donde la entrada no dice otra cosa se asume: peso en kg, salto fijo 2.5, escalón 2.5, bajar por defecto.
Un módulo que abarca varios ficheros va en subtablas de 25 filas como máximo cada una.

---

## 1. Progresión (progression / setPlan / progressionForm)

### 1A. Motor: doble progresión, reps, tiempo, asistidas, descarga

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| PR-01 | 3×8-12, 60 kg, reps 12/12/12, Doble, «Todas», salto fijo 2.5 | sube: siguiente 62.5 kg (meta de reps 12) | P12 §4 (Probar P12-03): «12/12/12 con 60 kg → «Subir a 62.5»» | alta |
| PR-02 | igual, reps 12/10/9 | mantener 60 kg | P12 §4 (Probar P12-03): «12/10/9 → «Mantener 60»» | alta |
| PR-03 | igual, reps 9/7/7 (fallan 2 de 3 bajo el mínimo 8) | bajar a 57.5 kg | P12 §4 (Probar P12-03): «9/7/7 → «Bajar a 57.5»» | alta |
| PR-04 | 3×8-12, 60 kg, 12/10/7 (falla 1 de 3; «baja» por defecto pide 2) | mantener 60 kg | P12 §4.3: «`down` ausente = `{ fails: floor(n · 0,4) + 1 }`» (n=3 → 2) | media |
| PR-05 | 4×8-12, 60 kg, 12/12/7/7 (fallan 2 de 4) | bajar a 57.5 kg | P12 §4.3: «2 de 3, 2 de 4, 3 de 5» | alta |
| PR-06 | 5×8-12, 60 kg, 12/12/7/7/7 (fallan 3 de 5) | bajar a 57.5 kg | P12 §4.3: «2 de 3, 2 de 4, 3 de 5» | alta |
| PR-07 | 3×8-12, 60 kg, «Cuándo baja = Nunca», reps 9/7/7 | mantener 60 kg | P12 §4.2: «baja = down ≠ 'never'» | media |
| PR-08 | 3×8-12, 60 kg, «Parcial 2 de 3» (need=2), reps 12/12/9 | sube a 62.5 kg; motivo «2 de 3 series llegaron a 12» | P12 §2 (Probar P12-01): «2 de 3 series llegaron a 12» | alta |
| PR-09 | 3×8-12, 60 kg, «RPE máx. 8», reps 12/10/9, RPE 10/10/10 | mantener 60 kg (no baja, ningún fallo) | P12 §4 (Probar P12-03): «las tres a RPE 10 → «Mantener 60»» | alta |
| PR-10 | 3×8-12, 60 kg, «RPE máx. 8», reps 12/12/12, RPE 8/8/8 (media 8) | sube a 62.5 kg | P12 §4.2: «RPE medio ≤ maxRpe» | media |
| PR-11 | 3×8-12, 60 kg, «RPE máx. 8», reps 12/12/12, RPE 9/9/9 (media 9) | mantener 60 kg, motivo `why_rpeAbove` | P12 §4.2: «llegó a la meta pero con RPE medio > maxRpe» | alta |
| PR-12 | 5×5 (mín = máx = 5), 100 kg, reps 5/5/5/5/5, salto 2.5 | sube a 102.5 kg | P12 §1 (tabla, B): ««Peso» = Doble con mín = máx» | media |
| PR-13 | 5×5, 100 kg, reps 5/5/4/4/4 (fallan 3 de 5) | bajar a 97.5 kg | P12 §4.3: «2 de 3, 2 de 4, 3 de 5» | media |
| PR-14 | 3×8-12, 60 kg, 12/12/12, salto «Porcentaje 5 %», escalón 2.5 | incremento 5 % = 3 → múltiplo de 2.5 más cercano = 2.5 → 62.5 kg | P12 §4.4: «redondea al múltiplo de `step` más cercano, nunca por debajo de `step`» | media |
| PR-15 | 3×8-12, 0 kg (sin carga), 9/7/7 | no baja (peso > 0 es condición); mantener | P12 §4.2: «peso > 0» | alta |
| PR-16 | primera sesión, `lastSets` vacío | sin chip (null) | P10 §5.2: «no hay chip, igual que en los otros modos» | alta |
| PR-17 | Reps, inicio 6, salto 1, reps 9/8/8 | up: 9 reps, delta +1 sobre la serie más floja (8) | P12 §2 (Probar P12-01): «↑ SUBIR A 9 reps +1» | alta |
| PR-18 | Reps, inicio 6, salto 1, reps 7/6/5 | hold: 6 reps | P12 §2 (Probar P12-01): «→ MANTENER 6 reps» | alta |
| PR-19 | Reps, inicio 6, salto 1, reps 13/13/13 | up: 14 reps (+1); antes decía 15 por usar el escalón de peso 2.5 | P12 §2.1: «el objetivo es la serie más floja + el salto» | media |
| PR-20 | Reps, inicio 6, «Parcial 2 de 3», reps 9/8/5 | ¿meta 6 (5+1), 9 (8+1) o mantener 6? La spec no lo dice | P12 §4.4: «meta = serie más floja + salto» | baja |
| PR-21 | Tiempo, inicio 30 s, salto 5 s, 45/45/40 | up: 45 s, delta +5 | P12 §2 (Probar P12-01): «dice «45 s +5»» | alta |
| PR-22 | Tiempo + Peso, rango 30-60 s, 3 series, 5 kg, 60/60/60 s | sube a 7.5 kg | P12 §8 (Probar P12-07): «60/60/60 con 5 kg → «Subir a 7.5»» | alta |
| PR-23 | Tiempo + Peso, 45-45 s, 5 kg, 45/40/45 s | mantener 5 kg | P12 §8 (Probar P12-07): «45/40/45 → mantiene» | alta |
| PR-24 | asistida (decrease), 3×8-12, asistencia 20 kg, todas al máximo, salto 2.5 | «MENOS AYUDA 17.5 kg», delta −2.5 | P12 §2 (Probar P12-01): «↑ MENOS AYUDA 17.5 kg −2.5» | alta |
| PR-25 | etapa de descarga (`hold: 'deload'`), 60 kg, reps 12/12/12 | hold: mantener 60 kg; nunca up ni down, en ningún tipo de progresión | P06 §6: «nunca sale `type: 'up'` ni `'down'`, en ninguno de los 5 tipos» | alta |

**Preguntas para el usuario (1A)**

1. Salto por defecto de peso: P12 §2.2 dice «`defaultIncrement(type, def)` da el salto por defecto según lo que sube (1 rep, 5 s o `weightStep`)». P10 §5.3 dice que sentadilla y press de banca con barra tienen `weightStep` 5. Pero P12 §4 (Probar P12-03) da «Press banca … 12/12/12 con 60 kg → «Subir a 62.5»». Con la regla por defecto, el press con barra subiría 5 (65), no 2.5. ¿Es 62.5 porque el salto está guardado a 2.5, o porque ese ejercicio tiene paso 2.5?
2. Reps/Tiempo con «Parcial» o «RPE máx.»: P12 §4.4 dice «meta = serie más floja + salto» cuando «se cumple … con las series ≥ inicio». Si se cumple con 2 de 3 series, ¿la «más floja» es la peor de las tres (puede estar bajo el inicio, PR-20) o la peor de las que cumplen?
3. Porcentaje (P12 §4.4): ¿se redondea el incremento (3 → 2.5) o el peso resultante (63 → 62.5)? ¿Qué pasa en un empate exacto (5 % de 75 = 3.75 = 1.5 escalones)?
4. Subir desde 0 kg (sin carga): la spec dice solo que no baja con peso 0. ¿Sube a 2.5 o se queda?
5. Asistidas con fallos: la spec dice «espejo» y «más ayuda si fallan …» (P12 §5.2), sin número. ¿20 kg con 9/7/7 → 22.5? ¿Y con 0 kg de ayuda y todas al máximo?
6. La frase de regla de Reps dice «cuando todas las series pasen de 6» (P12 §5.2) y el motor evalúa «series ≥ inicio» (§4.4). ¿«Pasen de 6» significa 6 o más, o más de 6?
7. Coma flotante en `need = ceil(pctThreshold · sets)` (P12 §4.1): ¿se tolera un redondeo previo (por ejemplo 0.6×5)? La spec no menciona tolerancia.

### 1B. Por esfuerzo (RPE)

Supuesto: 3×5 @RPE 8, escalón 2.5 salvo que se diga otra cosa.

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| PE-01 | última: 80 kg × 5/5/5, RPE 8/8/8 | hold: 80 kg, sin delta (`why_effortOnTarget`); e1RM 98.7 | P10 §2.2: «80 kg × 5 @RPE 8 → e1RM 98,7 → objetivo 5 @8 → 80 kg (mantener)» | alta |
| PE-02 | última: 80 kg × 5/5/5, RPE 7/7/7 | up: 82.5 kg (+2.5); e1RM 101.3 | P10 §2.2: «Si el cliente apuntó RPE 7 → e1RM 101,3 → **82,5 kg**» | alta |
| PE-03 | última: 80 kg × 5/5/5, RPE 9/9/9 | down: 77.5 kg (−2.5); e1RM 96 | P10 §2.2: «e1RM 96 → **77,5 kg**» | alta |
| PE-04 | objetivo 3×4 @8; última 60 kg × 4/4/4 @7 (e1RM 74) | up: 62.5 kg (sin redondear 61.67) | P12 §4 (Probar P12-03): «3 × 4 @7 → «Subir a 62.5»» | alta |
| PE-05 | objetivo 3×4 @8; última 60 kg × 5/5/5 @8 | up: 62.5 kg (también) | P12 §4 (Probar P12-03): «3 × 5 @8 → también «Subir a 62.5»» | alta |
| PE-06 | caso PE-04 con escalón «Exacto» | 61.7 kg (raw 61.67 a 0.1 kg) | P12 §5.4-bis: «Exacto da 61.7 donde el escalón 2,5 da 62.5» | alta |
| PE-07 | 70 kg × 5/5/5 @RPE 4, objetivo 5 @8 | e1RM ≥ 93.3 (RPE 4 cuenta como 5); propone 75 kg y nunca baja | P10 §5.3: «el e1RM salía 81,7 en vez de ≥ 93,3» | media |
| PE-08 | última sesión sin RPE (80 kg × 5/5/5), no es descarga | hold: 80 kg, `why_effortNoRpe`, sin e1RM | P12 §6.5: «el chip sigue siendo `why_effortNoRpe`» | alta |
| PE-09 | objetivo 10 reps @RPE 6 (equivalen a 14), última con RPE | hold: peso máx. de la última, `why_effortUnreliable` | P10 §2.3: «> 12 → el motor no puede calcular» | alta |
| PE-10 | objetivo 10 @RPE 8 (equivalen a 12); última 70 kg × 10 @8 (e1RM 98) | calcula (no null): 70 kg, hold; el editor avisa en naranja | P10 §2.3: «reps + (10 − targetRpe) ≥ 12 → aviso naranja en el editor» | media |
| PE-11 | librería `weightStep` 5, última 80 kg × 5 @7 | up: 82.5 kg (no 80): tope 2.5 | P10 §5.3: «`min(weightStep, 2.5)`; los de 1,25 siguen en 1,25» | alta |
| PE-12 | `weightStep` 1, última 80 kg × 5 @7 | 82 kg (82.16 al múltiplo de 1) | P10 §5.3: «`min(weightStep, 2.5)`» | media |
| PE-13 | `weightStep` 0 o ausente, última 80 kg × 5 @7 | escalón 2.5 → 82.5 kg | P10 §2.2: «(o 2,5 si es 0 o falta)» | alta |
| PE-14 | `effortWhen: 'reach'`, última 80 kg × 5/5/5 @8 | up: 82.5 kg (`why_effortReached`) | P12 §4.4: «si el cálculo deja el peso igual … sube un `step`» | alta |
| PE-15 | `effortWhen: 'reach'`, última 80 kg × 5/5/4 @8 | hold: 80 kg (no todas llegaron) | P12 §4.4: «todas las series llegaron a las reps objetivo» | media |
| PE-16 | tres sesiones con 1RM 72, 74 y 76 | `e1rm` = 74, `e1rmSessions` = 3 | P12 §6.5: «el `e1rm` es 74» | alta |
| PE-17 | última de descarga con RPE (`lastDeload`); anteriores 1RM 72 y 74 | e1RM 73 (media de las anteriores); sin `why_effortNoRpe` | P12 §6.5: «el 1RM sale de las anteriores» | alta |
| PE-18 | misma sesión: 60 kg × 5 @8 y 70 kg × 5 @8; objetivo 5 @8 | e1RM medio 80.17 → peso 65 kg; como 65 < 70 (máx. de la última): down | P10 §4.2: «calculado > peso máx. de la última» | media |
| PE-19 | 60 kg × 15 @RPE 6 (equivale a 19) | e1RM mínimo 84 (tope de 12 equivalentes) → up: 67.5 kg | P10 §5.3: «más de 12 reps equivalentes como 12» | media |

**Preguntas para el usuario (1B)**

1. P10 §2.2 dice que el e1RM sale de la última sesión; P12 §6.5 lo cambia a la media de las tres últimas. ¿Rige P12? (Las filas suponen que sí.)
2. P10 §4.2 compara el peso calculado con el peso **máximo** de la última sesión. Con series de pesos distintos (PE-18), una sesión normal sale «down». ¿Es lo esperado?
3. P12 §4.4 revierte «Por esfuerzo redondea al escalón del ejercicio» y P12 §4.6.3 lo tacha, pero P12 §5.5 deja `weightStep` editable también por encima de 2.5. ¿Con escalón propio de 5 se respeta ese 5 aunque la regla diga tope 2.5?
4. Si el RPE medio sale fuera de 5-10 por arriba (11), la spec solo dice que `epley1RM` ignora RPE fuera de 5-10 y que `chipEffort` sube a 5 los menores. ¿Un RPE 10.5 o 11 se trata como 10?

### 1C. setPlan (el gris de cada serie) y línea de recomendación

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| SP-01 | rango 8-12, chip up 62.5, sin coach | gris 62.5 × 12 en las tres series, `source: 'plan'` | P12 §6 (Probar P12-05): «el gris de las tres series dice 62.5 × 12» | alta |
| SP-02 | chip hold (12/10/9 con 60 kg) | gris 60×12, 60×10, 60×9 (`source: 'last'`) | P12 §6 (Probar P12-05): «el gris repite 60 × 12 · 10 · 9» | alta |
| SP-03 | rango 8-12, chip down (9/7/7), peso 57.5 | gris 57.5 × 12 (máximo del rango) | P12 §4.5: «reps = la meta (reps fijas, o `maxReps` con rango)» | media |
| SP-04 | 5×5 fijas, chip up 102.5 | gris 102.5 × 5 | P12 §4.5: «reps = la meta (reps fijas, o `maxReps` con rango)» | media |
| SP-05 | override del entrenador `weight` 70, chip up 62.5 | peso 70, `source: 'coach'` (azul) | P12 §4.5: «Objetivo del entrenador (`overrideEx[campo]`)» | alta |
| SP-06 | Por esfuerzo reps 5, chip.effort con `suggestedWeight` 82.5 | peso 82.5, reps 5 (`minReps`) | P12 §4.5: «`chip.effort` → peso = `chip.suggestedWeight`; reps = `minReps`» | alta |
| SP-07 | Por esfuerzo, chip hold con 80 | peso 80 (plan), reps 5 | P12 §4.5 (misma regla, sin excluir hold) | media |
| SP-08 | Reps, chip up con `suggestedReps` 9, última 9/8/8 | reps 9 en las tres; peso de la última vez | P12 §4.5: «`chip.suggestedReps != null` y `chip.type === 'up'` → reps» | media |
| SP-09 | Reps, chip hold (última 7/6/5, inicio 6) | gris 7·6·5, no el inicio 6 | P12 §4.5: «En mantener, el gris es lo que hiciste» | alta |
| SP-10 | Tiempo, chip up 45 s | tiempo gris 45 s | P12 §4.5: «`chip.suggestedTime != null` y `chip.type === 'up'`» | media |
| SP-11 | Tiempo + Peso sube (60/60/60 con 5 kg) | peso 7.5 y tiempo 30 s (el mínimo) | P12 §8.2: «tiempo = **el mínimo**» | alta |
| SP-12 | Tiempo + Peso mantener (45/40/45 con 5 kg) | lo hecho: 45·40·45 con 5 kg | P12 §8.2: «En mantener, lo hecho.» | alta |
| SP-13 | sin historial, sin coach, sin chip | todos los campos `{ value: '', source: 'none' }` | P12 §4.5: «`{ value: '', source: 'none' }`» | alta |
| SP-14 | hay RPE en la última vez (8), sin coach | rpe vacío (`none`): el RPE solo tiene coach | P12 §4.5: «El RPE solo tiene `coach`» | alta |
| SP-15 | la última sesión tuvo 3 series, hoy hay 4; chip hold | ¿gris de la 4ª serie vacío o repite la 3ª? | P12 §4.5: «`lastSets[index][campo]`» | baja |
| SP-16 | descarga (hold deload), 60 kg | chip hold; gris = la última vez (60) | P12 §4.5 (sin chip up/down) | media |
| SP-17 | `saveSession` con una serie solo marcada ✓; plan 62.5, última 60 | guarda 62.5 | P12 §6.1: «guarda el peso del plan (62,5), no el de la última vez (60)» | alta |
| SP-18 | chip up a 62.5 desde 60 | línea «↑ SUBIR A 62.5 kg +2.5» | P12 §3.1 (13): «`↑ SUBIR A 62.5 kg +2.5`» | alta |
| SP-19 | Por esfuerzo, e1RM 73.6 kg | «1RM 74» (kg entero); en lb ¿162 (de 73.6) o 163 (de 74)? | P12 §6.3: «redondeado a kg entero y en la unidad del usuario» | baja |
| SP-20 | primera vez, con carga, 8-12 | «◇ BUSCA TU PESO · 8–12 reps» | P12 §6.3: «◇ BUSCA TU PESO · 8–12 reps» | alta |
| SP-21 | primera vez, dominadas (sin carga), 6-12 | «◇ HAZ LAS QUE PUEDAS · 6–12» | P12 §6.3: «◇ HAZ LAS QUE PUEDAS · 6–12» | alta |
| SP-22 | primera vez, tiempo 30-60 s | «◇ AGUANTA LO QUE PUEDAS · 30–60 s» | P12 §6.3: «◇ AGUANTA LO QUE PUEDAS · 30–60 s» | alta |
| SP-23 | primera vez, Por esfuerzo 5 @RPE 8 | «◇ BUSCA TU PESO · 5 @ RPE 8» | P12 §6.3: «5 @ RPE 8» | alta |

**Preguntas para el usuario (1C)**

1. 4ª serie sin equivalente en la última sesión: P12 §4.5 usa `lastSets[index]`. ¿Vacío, o la última serie conocida?
2. 1RM en libras: P12 §6.3 dice «kg entero y en la unidad del usuario». ¿Se redondea antes de convertir (74 kg → 163 lb) o después (73.6 kg → 162 lb)?
3. Bajar con plan: P12 §3.1 (4) dice «Si no se cumple, mantener o bajar»; P12 §4.5 pone las reps de «bajar» al máximo del rango (57.5 × 12). ¿Es intencionado pedir 12 reps tras fallar?
4. Por esfuerzo en hold: P12 §4.5 no distingue tipo. ¿El gris es el peso calculado también en hold, aunque no haya cambio?

### 1D. Configuración de la hoja (progressionForm) y lectura de lo guardado

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| CF-01 | «Parcial» con 3 series | «Tienen que llegar» elegible de 1 a 2 | P12 §3.2: «Parcial de 1 a M−1» | alta |
| CF-02 | Parcial 2 de 3; luego Parcial 1 de 3 | «Cuándo baja» mínimo 2; con Parcial 1 de 3 mínimo 3 | P12 §5 (Probar P12-04): «no baja de 3» | alta |
| CF-03 | Por esfuerzo con rango 8-12; luego reps fijas 5-5; luego rango otra vez | apagado con la pista naranja; elegible con fijas; al volver a rango vuelve a Por reglas | P12 §5.3: «Por esfuerzo necesita reps fijas: cámbialo en Volumen» | alta |
| CF-04 | «Cuándo sube = RPE máx.» | Registrar RPE encendido, bloqueado, se guarda `trackRpe: true` | P12 §5.4: «se guarda `trackRpe: true`» | alta |
| CF-05 | Por esfuerzo, RPE objetivo 8; luego 10 | «Dejar 2 en recámara»; RPE 10 → «Hasta el fallo» | P10 §4.3: «RPE 10 → «Hasta el fallo»» | alta |
| CF-06 | Por esfuerzo, 10 reps @RPE 8 | aviso naranja | P10 (Probar P10-02): «Reps objetivo 10 con RPE 8: aviso naranja» | alta |
| CF-07 | Por esfuerzo, 10 reps @RPE 9 | sin aviso | P10 (Probar P10-02): «10 con RPE 9: sin aviso» | alta |
| CF-08 | Por esfuerzo, 9 reps @RPE 7 | aviso naranja (9+3 = 12) | P10 (Probar P10-02): «9 con RPE 7: aviso» | alta |
| CF-09 | sin progresión guardada: `pull_up_supine` (paso 0), `pull_up` (2.5), `pull_up_assisted` | `reps`; `double`; `double` con dirección `decrease` | P12 §5.3-bis: «`pull_up_supine` (0) → `reps`» | alta |
| CF-10 | flexiones (sin carga); asistidas; sentadilla con barra; sentadilla pasa a medida Tiempo | Por esfuerzo no sale; no sale; sale; vuelve a Automática | P10 §2.4: `canEffort = metric === 'reps' && !isBodyweight(def)` | alta |
| CF-11 | `defaultIncrement` por tipo | Reps: 1; Tiempo: 5 s; Peso: `weightStep` | P12 §2.2: «1 rep, 5 s o `weightStep`» | alta |
| CF-12 | guardado `type: 'weight'`, rango 8-12, reps 8/8/8, 60 kg | se lee como `double` con meta = mínimo (8): sube a 62.5 | P12 §4.1: «`'double'` con meta = `minReps`» | alta |
| CF-13 | guardado `mode: 'pct'`, `pctThreshold` 0.6, 3 series | `part` con `need` 2 (ceil 1.8) | P12 §4.1: «`need = ceil(pctThreshold · sets)`» | alta |
| CF-14 | `part` sin `need` ni `pctThreshold`, 5 series | `need` = ceil(0.8 × 5) = 4 | P12 §4.1: «`need = ceil((pctThreshold ?? 0,8) · sets)`» | alta |
| CF-15 | guardado `increment.type: 'stepped'`; `minIncrement` presente | se lee `fixed` con el primer escalón; `minIncrement` se ignora | P12 §4.1 (tabla): «se ignora (lo sustituye `step`)» | media |
| CF-16 | `exConfig.weightStep` ausente; con paso de librería 5; con 0 | paso 5; paso 2.5 si la librería da 0 | P12 §4.1: «Ausente → `def.weightStep` si es > 0, si no 2,5» | alta |
| CF-17 | `weightStep: 'exact'` en Por esfuerzo; igual en Por reglas | esfuerzo: `step` numérico y `exact: true`; reglas: `exact: false`, se lee ausente | P12 §5.4-bis: «`resolveProgressionConfig` **nunca** devuelve un `step` que no sea número» | alta |
| CF-18 | plantilla con dirección `increase`, ejercicio asistido (`decrease`) | resuelve `decrease` (la del ejercicio manda) | P12 §2.3: «toma la del ejercicio (`def.progressionDirection`) por encima de la de la plantilla» | alta |
| CF-19 | asistida 20 kg, 9/7/7 | ¿22.5 kg de ayuda (espejo)? | P12 §4.2: «`chipDoubleDecrease` sigue siendo su espejo» | media |
| CF-20 | asistida 0 kg de ayuda, todas al máximo | la spec no dice qué propone (no hay menos ayuda) | P12 §10.2 (aparcada): «sin ayuda» solo aparece en la parte aparcada | baja |
| CF-21 | `type: 'none'` con `hold: 'deload'` | sin chip | P06 §6: «un ejercicio sin progresión sigue sin chip» | alta |
| CF-22 | Peso, 2.5 kg, todas, meta 12, baja 2 de 3 | «Sube 2.5 kg cuando todas las series lleguen a 12 · baja si fallan 2 de 3» | P12 §5.2: «Sube 2.5 kg cuando todas las series lleguen a 12 · baja si fallan 2 de 3» | alta |
| CF-23 | Peso con `down: 'never'` | misma frase sin la cola de «baja si fallan» | P12 §5.2: «Con `down: 'never'` sin la cola» | alta |
| CF-24 | Tiempo + Peso, 60 s, 2.5 kg, baja 2 de 3 | «Sube 2.5 kg cuando todas las series lleguen a 60 s · baja si fallan 2 de 3» | P12 §8.2: «Sube 2.5 kg cuando todas las series lleguen a 60 s» | alta |
| CF-25 | usuario en lb, salto 2.5 kg | `progressionRule` imprime «2.5 lb» (valor en kg con etiqueta lb) | P12 §6.4: «en lb sale «2.5 lb»: pendiente de los dos» | baja |

**Preguntas para el usuario (1D)**

1. P12 §6.4 deja anotado como pendiente que `progressionRule` muestra el valor en kg con etiqueta de lb. ¿La prueba (CF-25) debe fijar el comportamiento actual (2.5 lb) o el corregido (5.5 lb)?
2. Legado `pct`: `need = ceil(pctThreshold · sets)` puede dar `need = sets` (con 1.0), cuando la hoja solo permite 1 a M−1. ¿Se recorta o se deja como Todas?
3. P12 §3.1 (14) y §4.4 dicen que en Reps y Tiempo «Qué pides» es un valor de inicio, pero P12 §1 (tabla D, «Peso corporal: Reps») no dice qué hace un guardado antiguo con rango 6-12 en Reps (¿inicio = mínimo 6?). P12 §5.1 solo lo da «al pasar a Reps desde un rango».

---

## 2. 1RM (oneRm)

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| OR-01 | `epley1RM(80, 5)` sin RPE | 93.33 | T02 §2.1: «1RM = peso × (1 + reps / 30)» | alta |
| OR-02 | `epley1RM(80, 5, 8)` | 98.67 (r = 5+2 = 7) | P10 §2.2: «e1RM 98,7» | alta |
| OR-03 | `epley1RM(80, 5, 7)` | 101.33 (r = 8) | P10 §2.2: «e1RM 101,3» | alta |
| OR-04 | `epley1RM(80, 5, 9)` | 96.0 (r = 6) | P10 §2.2: «e1RM 96» | alta |
| OR-05 | `epley1RM(80, 5, 10)` | 93.33, igual que sin RPE | P10 §2.2: «reps + 10 − rpe» (r = reps con RPE 10) | media |
| OR-06 | `epley1RM(80, 5, 5)` | 106.67 (r = 10; el 5 está dentro del rango) | P10 §2.2: «`epley1RM` ignora RPE fuera de 5-10» | media |
| OR-07 | `epley1RM(70, 5, 4)` | 81.67 (RPE 4 ignorado, cuenta como al fallo) | P10 §5.3: «el e1RM salía 81,7» | alta |
| OR-08 | `epley1RM(80, 5, 7.5)` | 100.0 (r = 7.5; los medios se pueden escribir) | P10 §5.3: «los medios se pueden escribir» | media |
| OR-09 | `epley1RM(60, 12)` | 84.0 (12 reps aún cuenta) | T02 §2.1: «Se ignoran las series de más de {{maxReps}} reps» (12) | media |
| OR-10 | `epley1RM(60, 13)` | null | P10 §2.2: «devuelve `null` por encima de `MAX_RELIABLE_REPS = 12`» | alta |
| OR-11 | `epley1RM(60, 10, 6)` (r = 14) | null | P10 §2.2: «devuelve `null` por encima de `MAX_RELIABLE_REPS = 12`» | media |
| OR-12 | `e1rmAtLeast(70, 5, 4)` | 93.33 (RPE < 5 cuenta como 5) | P10 §5.3: «RPE < 5 cuenta como 5» | alta |
| OR-13 | `e1rmAtLeast(60, 15, 6)` | 84.0 (más de 12 equivalentes cuenta como 12) | P10 §5.3: «más de 12 reps equivalentes como 12» | alta |
| OR-14 | `weightForReps(98.667, 5, 8)` | 80.0 | P10 §2.2: «objetivo 5 @8 → 80 kg» | alta |
| OR-15 | `weightForReps(101.333, 5, 8)` | 82.16 sin redondear (82.5 tras escalón 2.5) | P10 §2.2: «**82,5 kg**» | alta |
| OR-16 | `weightForReps(100, 10, 8)` (r = 12) | 71.43 (no null) | P10 §2.2: «r > 12 → null» | alta |
| OR-17 | `weightForReps(100, 11, 8)` (r = 13) | null | P10 §2.2: «r > 12 → null» | alta |
| OR-18 | `weightForReps(100, 1, 10)` (r = 1) | 100 | P10 §2.2: «r === 1 → e1rm» | alta |
| OR-19 | `epley1RM(100, 1, 10)` frente a `weightForReps(103.33, 1, 10)` | la fórmula da 103.33, la inversa devuelve 103.33: la ida y vuelta no cierra en r = 1 (debería dar 100) | P10 §2.2: «r === 1 → e1rm» frente a T02 §2.1 «peso × (1 + reps / 30)» | baja |
| OR-20 | `epley1RM(0, 5)`, `epley1RM(80, 0)`, `weightForReps(0, 5, 8)` | la spec no dice si 0 da 0 o null | P10 §2.2 («series con peso, reps y RPE válidos») | baja |
| OR-21 | ida y vuelta 62.5 kg × 8 @9 → `weightForReps(…, 8, 9)` | 62.5 (e1RM 81.25; 81.25 / 1.3) | P10 §4.1: «tests de ida y vuelta contra `epley1RM`» | alta |
| OR-22 | 82.5 kg en libras | 181.9 lb (el cálculo es en kg, solo la UI convierte) | P10 §7: «con libras, 82,5 kg sale como 181,9 lb» | alta |
| OR-23 | dominadas con lastre +10 kg × 5, sin RPE | 11.67: el 1RM es el del lastre | P12 §10: «el 1RM de unas dominadas es el 1RM **del lastre**» | media |
| OR-24 | `recentE1RM`: sesión hace 3 semanas con e1RM 100 y hace 1 semana con 90 | mejor de las últimas 4 semanas: 100 | T04 §5.2: «el **mejor e1RM de las últimas 4 semanas**» | media |
| OR-25 | misma historia con la mejor sesión hace 5 semanas (100) y la última hace 1 (90) | ventana de 4 semanas: 90; ventana de 6 semanas (referencia de carga): 100 | T04 §5.2 (4 semanas) frente a P12 §6.3 «la mejor serie en 6 semanas» | baja |

**Preguntas para el usuario (2)**

1. Reps = 1: P10 §2.2 dice `weightForReps` con «r === 1 → e1rm» (peso = e1RM), pero T02 §2.1 dice «1RM = peso × (1 + reps / 30)» (una repetición a RPE 10 da 103.3, no 100). ¿La inversa a r = 1 devuelve e1RM por convención (y la ida y vuelta no cierra), o `epley1RM` debe dar el peso mismo con 1 rep?
2. Peso 0, reps 0 o campo vacío: ¿`epley1RM` devuelve 0 o null? La spec dice «series con peso, reps y RPE válidos» sin definir válido.
3. Ventanas del «mejor e1RM reciente»: T04 §5.2 dice 4 semanas (índice de Rendimiento, «mismo criterio que `recentE1RM`»), P12 §6.3 dice que el 1RM de Progreso es «la mejor serie en 6 semanas», T04 §3.3 usa «`weeks` semanas» (T02 §3.2 dice 6, `REF_WEEKS`). ¿Qué ventana usa realmente `recentE1RM`?
4. ¿Dónde se redondea el 1RM mostrado: la spec escribe 98,7 (un decimal) en P10 y «1RM 74» (entero) en P12 §6.3, pero no dice si `epley1RM` redondea.

---

## 3. Calentamiento (warmup)

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| WU-01 | auto, 1 serie, trabajo 100 kg | [60 kg × 5] | T05 §1 (tabla): «1 \| 60%×5» | alta |
| WU-02 | auto, 2 series, trabajo 60 kg | [27.5 × 8, 42.5 × 4] | T05 §1 (tabla): «45%×8 · 70%×4» | media |
| WU-03 | auto, 3 series, trabajo 100 kg | [40 × 10, 60 × 6, 80 × 3] | T05 §1 (tabla): «40%×10 · 60%×6 · 80%×3» | alta |
| WU-04 | auto, 4 series, trabajo 100 kg | [40 × 10, 55 × 8, 70 × 5, 85 × 2] | T05 §1 (tabla): «40%×10 · 55%×8 · 70%×5 · 85%×2» | alta |
| WU-05 | auto, 4 series, trabajo 83 kg | [32.5 × 10, 45 × 8, 57.5 × 5, 70 × 2] | T05 §2: «ej. 0.4×83=33.2→32.5» | media |
| WU-06 | custom 40 % × 10 sobre 83 kg | 32.5 kg (33.2 redondeado a 2.5) | T05 §2: «redondeo 2,5 (ej. 0.4×83=33.2→32.5)» | alta |
| WU-07 | 70 % × 4 sobre 62.5 kg (43.75, justo entre 42.5 y 45) | ¿42.5 o 45? La spec no fija el empate | T05 §2: «Redondeo: al múltiplo de **2,5 kg**» | baja |
| WU-08 | auto, 3 series, trabajo 20 kg | [7.5 × 10, 12.5 × 6, 15 × 3] | T05 §2: «Redondeo: al múltiplo de **2,5 kg**» | media |
| WU-09 | auto, 3 series, trabajo 2.5 kg (40 % = 1 kg) | ¿0 kg o mínimo 2.5? La spec no pone suelo | T05 §2 (sin suelo) | baja |
| WU-10 | `workWeightKg` null | pesos null; pills «40% × 10» | T05 §3: «las pills muestran el % y las reps pero sin kg» | alta |
| WU-11 | `workWeightKg` = 0 | ¿null (sin kg) o 0 kg? | T05 §3: «`workWeightKg == null`» (no menciona 0) | baja |
| WU-12 | custom [50 % × 5, 75 % × 3], trabajo 100 kg | [50 × 5, 75 × 3] | T05 §1: «`{ pct: number, reps: number }`» | media |
| WU-13 | `exConfig.warmup` null; auto con 0 o 5 series | la spec no dice qué devuelve `warmupSteps` (¿vacío?) | T05 §1: «ausente = sin calentamiento» | baja |
| WU-14 | override del entrenador 70, plan 62.5, última 60, tecleado 65 | trabajo = 70 | T05 §2: «Prescripción del entrenador (override `weight` de `pendingOverrides`)» | alta |
| WU-15 | sin override, chip up 62.5, última 60 | trabajo = 62.5 | P12 §6.2: «después del objetivo del entrenador y antes de la última sesión» | alta |
| WU-16 | sin override ni plan (hold), última 60/60/57.5 | trabajo = 60 (top set de la última) | T05 §2: «Peso del top set de la última sesión» | media |
| WU-17 | sin nada y teclea 65 en la primera serie | rampa sobre 65 | T05 §2: «se calculan en cuanto el usuario teclea el peso de su primera serie» | alta |
| WU-18 | última 60 y teclea 65 en la primera serie | ¿rampa sobre 60 (cascada) o 65 (recalculada «en cada render»)? | T05 §2 (3.º escalón) frente a §3 «SIEMPRE recalculada en cada render» | baja |
| WU-19 | ejercicio asistido (`chip.assist`) con plan de ayuda 17.5 y última 20 | el plan no entra en la cascada; usa la última | P12 §6.2: «el número del plan es la ayuda, no un peso» | media |
| WU-20 | trabajo 185 lb, auto 3 series | ¿[75 × 10, 110 × 6, 150 × 3] (5 lb) o convertidos desde kg (múltiplos de 2.5 kg)? | T05 §2: «(unidad lb: 5 lb)» frente a la firma `workWeightKg` | baja |
| WU-21 | `restSec` 60: tocar pill; tocar otra vez | verde + temporizador de 60 s; segundo toque vuelve a gris sin efecto | T05 §3: «Tocar una pill ya verde la desmarca … sin efecto secundario» | alta |
| WU-22 | `restSec` 0: tocar pill | cambia a verde, sin temporizador | T05 §3: «si es 0, la pill solo cambia de color, sin timer» | alta |
| WU-23 | duración: auto 3 series con `restSec` 60; custom 4 pasos con `restSec` 0 | 3 × (35 + 60) = 285 s; 4 × 35 = 140 s | T05 §4: «`nCalent × (35 + warmup.restSec)`» | alta |
| WU-24 | sesión con calentamiento tocado, guardar | `exercise.sets` sigue con solo series de trabajo; la progresión no lo ve | T05 §1: «El calentamiento **NO se guarda en el log**» | alta |
| WU-25 | cambiar el peso de la primera serie tras tocar una pill | las cifras se recalculan, la pill sigue verde | T05 §3: «los números de las pills — tocadas o no — se actualizan igual» | alta |

**Preguntas para el usuario (3)**

1. Cascada contra recálculo (WU-18): T05 §2 pone «teclea el peso» como último escalón («si no hay nada»), pero T05 §3 dice que el peso se recalcula siempre si el atleta cambia la primera serie. Con última sesión de 60 y tecleado 65, ¿qué manda?
2. Unidades (WU-20): T05 §2 dice «(unidad lb: 5 lb)», T02 §3.1 dice «redondeo a 2,5 kg» y P10 §7 dice que el cálculo va siempre en kg. ¿En lb se redondea a 5 lb, o se calcula en kg con 2.5 y se convierte (con lo que 185 lb daría números no múltiplos de 5)?
3. Empate al redondear (WU-07): «al múltiplo de 2,5» no dice si 43.75 va a 42.5 o a 45.
4. Suelo de peso (WU-09) y trabajo 0 (WU-11): ¿qué muestran una barra de 2.5 kg o un peso 0?
5. P12 §6.2: en asistidos el plan queda fuera de la cascada, pero la «última sesión» de un asistido es también ayuda, no peso. ¿Qué base usa el calentamiento de una dominada asistida?

---

## 4. Avance de etapa (stageProgress)

### 4A. Semanas, fin de etapa y estado

Supuestos de calendario: 2026-09-21 es lunes; 2026-09-22 martes; 2026-09-24 jueves; 2026-10-19 lunes.

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| SG-01 | `weekOne('2026-09-21')` (lunes) | '2026-09-21' | P08 §0 (3): «de lunes a miércoles cuenta esa semana» | media |
| SG-02 | `weekOne('2026-09-22')` (martes) | '2026-09-21' | P08 §3.3: «`weekOne('2026-09-22' /* martes */) === '2026-09-21'`» | alta |
| SG-03 | `weekOne('2026-09-24')` (jueves) | '2026-09-28' | P08 §3.3: «`weekOne('2026-09-24' /* jueves */) === '2026-09-28'`» | alta |
| SG-04 | `weekOne('2026-12-31')` (jueves) y `weekOne('2027-01-03')` (domingo) | los dos '2027-01-04' (cruza año) | P08 §4.4: «`weekOne` para los 7 días y cruzando mes y año» | media |
| SG-05 | inicio '2026-09-22', hoy '2026-09-27' (domingo) | `weekInStage` 1 | P08 §3.3: «`weekInStage = max(1, floor(díasEntre(weekOne(stageStartedOn), hoy) / 7) + 1)`» | media |
| SG-06 | inicio '2026-09-22', hoy '2026-09-28' | `weekInStage` 2 | P08 §3.3 (fórmula; 7 días desde el 21) | media |
| SG-07 | inicio '2026-09-24' (jueves), hoy '2026-09-25' (antes del lunes 28) | `weekInStage` 1 (el `max(1, …)`), `started` true | P08 §3.3: «1 mientras no haya empezado o antes de la semana 1» | alta |
| SG-08 | `stageStartedOn` null | `started` false, `weekInStage` 1, `ended` false | P08 §3.1: «`null` = aún no la ha empezado» | media |
| SG-09 | D=4, E=0, inicio '2026-09-22'; hoy '2026-10-18' y luego '2026-10-19' | `endsOn` '2026-10-19'; `ended` false el 18, true el 19 | P08 §3.4: «`endsOn = weekOne(stageStartedOn) + 7 × lengthWeeks días`» | alta |
| SG-10 | D=4, E=1 (alargada), misma fecha, 3 sesiones/semana | `lengthWeeks` 5, `endsOn` '2026-10-26', `expected` sigue 12 | P08 §3.4: «Las semanas añadidas no suben lo esperado.» | alta |
| SG-11 | D=4, 3 sesiones/semana (12), hechas 11 | `missing` 1, `missingWeeks` 0 (no se propone nada) | P08 §3.4: «Con 11 hechas, `round(1/3) = 0` → no se propone nada» | alta |
| SG-12 | igual, hechas 10 | `missing` 2, `missingWeeks` 1 | P08 §3.4: «Con 10, `round(2/3) = 1` → se propone 1 semana» | alta |
| SG-13 | igual, hechas 9, etapa terminada | `missingWeeks` 1: «Has hecho 9 de 12 sesiones. Te proponemos 1 semana más» | P08 §6.1: «Has hecho 9 de 12 sesiones. Te proponemos 1 semana más» | alta |
| SG-14 | D=4, 2 sesiones/semana (8), hechas 7 | `missing` 1; `round(1/2)`: ¿1 o 0 semanas? | P08 §3.4: «el redondeo es la tolerancia» (sin regla de empate) | baja |
| SG-15 | D=4, 3/semana, `weekInStage` 4 y hechas 12 | `earlyReady` true | P08 §3.4: «`earlyReady = started && weekInStage === lengthWeeks && done >= expected`» | alta |
| SG-16 | igual, hechas 11 | `earlyReady` false | P08 §3.4 (misma fórmula, `done >= expected`) | alta |
| SG-17 | D=4, `weekInStage` 3 (de 4), hechas 12 | `earlyReady` false: solo en la última semana | P08 §5.3: «`earlyReady` solo existe en la última semana» | alta |
| SG-18 | D=4, E=1 (`lengthWeeks` 5): semana 4 con 12 hechas; semana 5 con 12 hechas | semana 4: false; semana 5: true al entrar | P08 §6.1: «`earlyReady` se cumpliría al instante (última semana nueva y todo hecho)» | alta |
| SG-19 | D = null (sin límite), cualquier semana, 20 hechas | `ended` false, `earlyReady` false; ¿`expected`, `missingWeeks`, `endsOn`? | P08 §3.4: «no hay fin, ni aviso, ni comprobación» (no da valores) | baja |
| SG-20 | `recordSession` primera sesión de la etapa, hoy '2026-10-14', `inCurrentStage` true | `stageSessionsDone` 1, `stageStartedOn` y `programStartedOn` '2026-10-14' | P08 §3.1: «`saveSession` (si es `null`)» | alta |
| SG-21 | `recordSession` con `inCurrentStage` false (sesión libre) | `{}` (parche vacío) | P08 §4.1: «`{}` si no es de la etapa» | alta |
| SG-22 | `stageReset(2)` con progreso previo | etapa 2, `stageStartedOn` null, `stageSessionsDone` 0, `stageExtraWeeks` 0; no toca `programStartedOn` | P08 §3.1: «a `0` al cambiar de etapa» | media |
| SG-23 | `athleteProgress` con 3 etapas y `currentStageIndex` 5 | índice 2 (clampado) | P08 §4.1: «Índice clampado.» | alta |
| SG-24 | `fromLegacyProgress`: 2 semanas, 1 sesión abierta, 3 sesiones/etapa, hoy miércoles 2026-10-14 | `stageSessionsDone` 7; `stageStartedOn` '2026-09-28' (lunes 10-12 menos 14 días); `stageExtraWeeks` 0 | P08 §4.1: «ancla las fechas reconstruidas al **lunes de la semana de hoy**» | media |
| SG-25 | `closeOpenStage` con etapa sin límite en `weekInStage` 4 | `durationWeeks` 3; con `weekInStage` 1 → 1 | P08 §5.0: «se cierra en `max(1, weekInStage − 1)` semanas» | alta |

**Preguntas para el usuario (4A)**

1. Repetir la misma sesión: P08 §5.3 dice «Cliente repite la sesión A doce veces → Cuentan 12. La etapa **no** termina antes … `earlyReady` solo existe en la última semana». Pero con D=4 y 3 sesiones, en la semana 4 doce repeticiones de A cumplen `done >= expected` y activan `earlyReady`. C03 §8 (sustituida por P08) decía que no se da por terminada. ¿Es aceptable que 12 veces la sesión A termine la etapa en la última semana?
2. Empate del redondeo (SG-14): `missingWeeks = round(missing / dpw)`. Con 2 sesiones/semana y 1 sesión que falta (0.5), ¿se propone 1 semana (round hacia arriba) o 0?
3. Etapa sin límite: ¿qué valen `expected`, `missingWeeks`, `lengthWeeks` y `endsOn`? P08 §3.4 solo dice que no hay fin.
4. P08 §4.1 dice que `fromLegacyProgress` es idempotente y que manda `stageSessionsDone`, pero P08 §5.5 cambia la detección a «campos de ciclos»; si llegan los dos juegos, «mandan los nuevos». ¿Con `stageSessionsDone = 0` y `cycleCompletedIds` presente se migra?
5. `stageReset`: ¿incluye `currentStageIndex` en el parche? P08 §3.1 lo lista entre los campos que escribe «avanzar, cambiar de etapa», pero §4.1 solo dice «parche; no toca `programStartedOn`».

### 4B. Bloqueos de etapa (C03)

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| LK-01 | conectado (`slotId`), programa en `trainerProgramIds`, `currentStageIndex` 0, `idx` 1, `stages[1].locked` true | `isStageLocked` true | C03 §2: «`return !!program.stages?.[idx]?.locked`» | alta |
| LK-02 | igual, pero `idx` 0 con `locked` true | false (la actual nunca) | C03 §2: «la actual y las pasadas, nunca» | alta |
| LK-03 | `currentStageIndex` 2, `idx` 1 con `locked` true | false (una etapa ya pasada) | C03 §2: «da gratis "volver a una etapa ya hecha"» | alta |
| LK-04 | `idx` 1, `locked` ausente | false (nacen desbloqueadas) | C03 §0 (2): «Las etapas nuevas **nacen desbloqueadas**» | alta |
| LK-05 | sin `slotId` (no conectado), `idx` 1 `locked` true | false | C03 §2: «`if (!clientSync?.slotId) return false`» | alta |
| LK-06 | conectado, pero el programa es propio (id fuera de `trainerProgramIds`) | false | C03 §2.1: «Acota por programa, no por usuario» | alta |
| LK-07 | `trainerProgramIds` vacío o ausente (enlace antiguo) | false (cabo suelto conocido) | C03 §2.1: «En enlaces antiguos la lista está vacía y ni el candado ni este bloqueo se aplican» | media |
| LK-08 | `idx` fuera de rango (5 con 3 etapas) | false (`!!undefined`) | C03 §2 (código, sin caso explícito) | media |
| LK-09 | `currentStageIndex` ausente, `idx` 1 locked | tratado como 0 → true | C03 §2: «`program.currentStageIndex ?? 0`» | alta |
| LK-10 | `isTrainerProgram`: conectado y programa en la lista; no conectado | true; false | C03 §2.1: «`return !!clientSync.trainerProgramIds?.includes(program?.id)`» | alta |
| LK-11 | `mergeProgressOnImport` sin sello nuevo, cliente con `stageSessionsDone` 7 | conserva los campos del cliente | P08 §5.0: «Sin salto → los campos del cliente tal cual, índice clampado» | alta |
| LK-12 | sello nuevo y etapa entrante 2 (cliente en 0) | `stageReset(2)`: etapa 2, 0 hechas, `stageStartedOn` null | P08 §5.0: «Con salto → `stageReset(etapaEntrante)`» | alta |
| LK-13 | sello nuevo, etapa entrante igual a la etapa actual del cliente (1) | ¿resetea (P08) o conserva contadores (C03 §9)? | C03 §9: «un `incomingStage` que coincide con el del cliente no cuenta como movimiento» frente a P08 §5.3 «Entrenador activa otra etapa → Sello → `stageReset`» | baja |
| LK-14 | sello nuevo con programa distinto | además `programStartedOn` null | P08 §5.0: «si el programa es otro, además `programStartedOn: null`» | alta |
| LK-15 | cliente en etapa 5; el entrenador borró hasta dejar 3 | índice 2, contadores intactos | P08 §5.3: «Índice clampado, contadores intactos» | alta |
| LK-16 | `setCurrentStage` del entrenador sobre una etapa con `locked` true | la etapa destino queda desbloqueada | C03 §9.3: «**activar una etapa implica desbloquearla**» | alta |
| LK-17 | etapa nueva o duplicada | `locked` ausente | C03 §9.3: «las nuevas y las copias nacen desbloqueadas» | alta |
| LK-18 | `extendStage(programId, 1)` en programa del entrenador (móvil cliente); en programa propio | se niega; `stageExtraWeeks` +1 | P08 §5.1: «Solo en programas donde el móvil es el atleta» | alta |

**Preguntas para el usuario (4B)**

1. LK-13: ¿sello nuevo con la misma etapa que ya tiene el cliente borra su progreso (P08 §5.3, «Sello → `stageReset` al importar») o no cuenta como movimiento (C03 §9)? Las dos specs están marcadas como vigentes (C03 «Todo lo demás de stage-locks sigue vigente», dice P08).
2. LK-08: `idx` fuera de rango. La spec no lo menciona.
3. C03 sigue describiendo en §3 contadores muertos (`cycleCompletedIds`, `stageWeeksCompleted`); P08 los sustituye. ¿Se considera la tabla de C03 §3.1/§3.2 obsoleta para la auditoría?

### 4C. Sesión que toca (sessionPlan), totales y aviso

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| SH-01 | días A, B, C, ninguna hecha | hero A | P08 §0 (2): «Las nunca hechas van primero, en el orden del programa» | alta |
| SH-02 | A hecha t=10, B t=20, C nunca | hero C | P08 §3.5: «`días.minBy(d => lastDoneAt[d.templateId] ?? -Infinity)`» | alta |
| SH-03 | A=10, B=20, C=30, A=40, B=50 | hero C | P08 §3.5: «A B C A B, hero C» | alta |
| SH-04 | A y B hechas, repites A; C nunca | hero C | P08 §3.5: «Si te saltas C y repites A, sigue siendo C» | alta |
| SH-05 | A hecha; B y C nunca | hero B (orden del programa) | P08 §0 (2): «en el orden del programa (A, B, C…)» | alta |
| SH-06 | sesión a medias en B; A es la más antigua | hero B | P08 §0 (2): «La sesión a medias manda sobre todo» | alta |
| SH-07 | A y B con el mismo timestamp 10, C con 20 | hero A | P08 §3.5: «empate → orden del programa» | media |
| SH-08 | `sessionOrder: 'weekly'` con A hecha esta semana y B no; con todas hechas; luego `'free'` | B; A (la de arriba); ninguna toca | P08 §3.5: «con todas hechas, la de arriba» | media |
| SH-09 | 3 sesiones; esta semana A y B; luego A dos veces y B | «2 de 3 esta semana»; `weekDone` 3 (repeticiones incluidas) | P08 §4.2: «`done` = entrenos de la semana, repeticiones incluidas» | alta |
| SH-10 | sesión libre guardada esta semana | no cuenta | P08 §5.3: «Cliente hace una sesión libre → No cuenta» | alta |
| SH-11 | sesión el domingo 23:59 y hoy lunes | no cuenta como «esta semana» (la semana empieza el lunes) | P08 §4.2: «hecha desde el lunes (`startOfWeek`)» | media |
| SH-12 | `weeklySessions` de etapa con 3 días; con 0 días | 3; 1 | P08 §4.1: «nunca menos de 1» | alta |
| SH-13 | `programTotals`: etapas 4 sem × 3 ses y 3 sem × 2 ses | 7 semanas, 18 sesiones | P08 §6.5: «sesiones = Σ sesiones de la etapa × semanas» | media |
| SH-14 | `programTotals` con una etapa sin límite | total indeterminado: formato de salida (P06 hablaba de «12+») | P06 §3.2.f: «una etapa sin límite hace el total indeterminado → "12+ ciclos"» | baja |
| SH-15 | `stageWeekLabel`: semana 3 de 4, sin extras | «Semana 3 de 4» | P08 §6.5: ««Semana 3 de 4», «(+1)», «Semana 7», «Sin empezar»» | alta |
| SH-16 | `stageWeekLabel`: semana 3 con `stageExtraWeeks` 1 (`lengthWeeks` 5) | ¿«Semana 3 de 5 (+1)» o «Semana 3 de 4 (+1)»? | P08 §6.3: «con «(+1)» si hay semanas añadidas» | baja |
| SH-17 | `stageWeekLabel`: sin límite semana 7; sin empezar | «Semana 7»; «Sin empezar» | P08 §6.5: ««Semana 7», «Sin empezar»» | alta |
| SH-18 | `stageDetail`: semana 3, 4 semanas, 8 de 12 hechas | «Semana 3 de 4 · 8 de 12 sesiones» | P08 §7.1: ««Semana 3 de 4 · 8 de 12 sesiones»» | alta |
| SH-19 | aviso: `ended`, no última, snooze '2026-10-20'; hoy '2026-10-19' y hoy '2026-10-20' | oculto el 19; visible el 20 (`hoy < snooze` es estricto) | P08 §6.1: «`!(snooze && hoy < snooze)`» | alta |
| SH-20 | etapa última con `ended` true | no hay aviso (`!isLast`) | P08 §6.1: «`!isLast && (ended || earlyReady)`» | alta |

**Preguntas para el usuario (4C)**

1. SH-16: la etiqueta «(+1)» ¿acompaña a «de 5» (la duración real) o a «de 4» (la original)? P08 §6.3 solo dice «con «(+1)» si hay semanas añadidas».
2. SH-14: ¿cómo se pinta el total de semanas con una etapa sin límite?
3. `startOfWeek` y el cambio de hora (octubre, marzo): P08 §3.3 exige aritmética de calendario; ¿se aplica también a `startOfWeek` de `weekProgress.js`?

---

## 5. Prescripción de etapa (stageRx)

### 5A. applyRx y escalado

Supuestos: ejercicio de reps con 3 series, rango 8-12, 90 s de descanso, salvo que se indique.

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| RX-01 | `applyRx(exs, undefined)` y `applyRx(exs, {})` | mismo array (identidad) | P06 §4.3: «`rx` ausente o todo a cero ⇒ devuelve el array tal cual» | alta |
| RX-02 | `rx` = {setsDelta 0, repsShift 0, restPct 0, incrementScale 1, progressionHold null} | mismo array | P06 §4.3: «`rx` ausente o todo a cero ⇒ devuelve el array tal cual» | alta |
| RX-03 | `setsDelta` +1 sobre 3 series | 4 series | P06 §4.5: «cada `exConfig.sets` subió 1» | alta |
| RX-04 | `setsDelta` −1 sobre 3 series | 2 series | P06 §4.3: «`setsDelta` … suelo duro: 1 serie» | media |
| RX-05 | `setsDelta` −2 sobre 1 serie | 1 serie | P06 §9: «Queda en 1, no en −1» | alta |
| RX-06 | `setsDelta` −3 sobre 3 series | 1 serie (suelo) | P06 §4.3: «`sets ≥ 1`» | media |
| RX-07 | `repsShift` −3 sobre 8-12 | 5-9 | P06 §4.3: «8-12 con −3 → 5-9» | alta |
| RX-08 | `repsShift` −4 sobre 5-8 | 1-4 | P06 §9: «1-4, no 1-4 con min>max ni negativos» | alta |
| RX-09 | `repsShift` −6 sobre 5-8 | mín 1 (suelo); ¿máx 2 o también 1? | P06 §4.3: «`minReps ≥ 1`» (no habla del máximo) | baja |
| RX-10 | `repsShift` +4 sobre 8-12 | 12-16 (sin techo declarado) | P06 §4.3: «desplaza min Y max juntos» | media |
| RX-11 | `restPct` +25 sobre 120 s | 150 s | P06 §4.3 (DEFAULT_RX: `restPct` −50..+100) | media |
| RX-12 | `restPct` −50 sobre 60 s | 30 s | P06 §4.3: «`restPct` −50..+100» | media |
| RX-13 | `restPct` −50 sobre 20 s | 15 s (suelo) | P06 §4.3: «`restSec ≥ 15`» | alta |
| RX-14 | `restPct` +25 sobre 90 s (112.5) | ¿112.5, 112 o 113? La spec no dice si redondea | P06 §4.3 (sin regla de redondeo para descanso) | baja |
| RX-15 | ejercicio de tiempo (`minReps` null), `repsShift` −3, `setsDelta` +1, `restPct` +25 | reps intactos; 4 series; descanso +25 % | P06 §9: «Sin cambios en tiempo; sí aplica `setsDelta`/`restPct`» | alta |
| RX-16 | scope `'keys'`, `setsDelta` +1, dos ejercicios (isKey true y false) | solo el principal sube | P06 §7.3: «el rango corto es de los básicos» | alta |
| RX-17 | scope `'accessories'`, `setsDelta` +1, dos ejercicios | solo el accesorio sube | P06 §7.3: «las series extra van a los accesorios, no a la sentadilla pesada» | alta |
| RX-18 | scope `'keys'` con ejercicio sin `isKey` definido | ¿se trata como accesorio? | P06 §5: «nacen con `isKey: false`» (solo para los hechos a mano) | baja |
| RX-19 | `incrementScale` 0.5, `increment` fijo 2.5, escalón 1.25 | 1.25 | P06 §4.3: «`incrementScale` … Solo toca `increment.value`» | media |
| RX-20 | `incrementScale` 0.5, `increment` fijo 2.5, escalón 2.5 (1.25 es medio escalón) | ¿2.5 (no cambia) o 0? | P12 §4.1: «pasa a redondear al `step` resuelto» frente a P06 §4.3 («al múltiplo de `minIncrement`, si no a 0,25») | baja |
| RX-21 | `incrementScale` 0.5, `increment` tipo `pct` 5 | `pct` 2.5 | P06 §4.3: «en `increment.type === 'pct'` escala `pct`» | media |
| RX-22 | `progressionHold: 'deload'` sobre ejercicio sin `progression` guardada | `progression` materializada con `hold: 'deload'`; no se escriben `step` ni `direction` | P12 §4.1: «**no** escribe `step` ni `direction`» | alta |
| RX-23 | cualquier `rx` sobre ejercicio con `linkGroup`, `supersetWithNext`, `dropset`, `warmup`, notas | todos intactos, ids inalterados | P06 §4.3: «Nunca toca `exerciseId`, `order`, `linkGroup`, `supersetWithNext`, `dropset`, `warmup`, `trainerNote`, `limitationNote`» | alta |
| RX-24 | peldaño Intensidad 2 (`keys`, `repsShift` −5, `restPct` +50, `incrementScale` 0.5) sobre básico 5×(8-12) con 120 s | reps 3-7; descanso 180 s; series 5; accesorios sin tocar | P06 §7.3 (tabla): «`scope:'keys', repsShift:-5, restPct:+50, incrementScale:0.5`» | media |
| RX-25 | descarga (`setsDelta` −1, `progressionHold: 'deload'`) sobre 3 series con 90 s | 2 series, descanso 90, `progression.hold = 'deload'` | P06 §14.5: «`−1 serie`, `progressionHold: 'deload'` y 1 ciclo» | alta |

### 5B. Planificador: etapas derivadas, escaleras y nombres

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| PL-01 | `addStageToProgram(id)` sin opciones | copia literal de la última etapa, `tpl_*` nuevos, `derivedFrom` = plantilla origen | P06 §4.4: «Sin argumentos ⇒ comportamiento idéntico al actual» | alta |
| PL-02 | `addStageToProgram` con `rx` `setsDelta` +1 sobre base de 3 sesiones | 3 plantillas nuevas, `derivedFrom` al origen, cada `sets` +1, ningún `exerciseId` cambia | P06 §4.5: «los `tpl_*` son nuevos, `derivedFrom` apunta al origen» | alta |
| PL-03 | `templateChainIds('tpl3')` con tpl3→tpl2→tpl1 | ['tpl3', 'tpl2', 'tpl1'] | P06 §4.1: «[templateId, su derivedFrom, el derivedFrom de aquel, …]» | alta |
| PL-04 | cadena con un `derivedFrom` inexistente; y un ciclo a→b→a | corta sin romper; ¿el id inexistente aparece en la lista? ciclo: ['a', 'b'] | P06 §4.1: «Corta ante un id inexistente o un ciclo (Set de visitados)» | baja |
| PL-05 | `addStageLadder` con peldaños `setsDelta` +1 y +2 sobre una base de 3 series | etapas con 4 y 5 series (no 4 y 6) | P06 §2 (4): «Los peldaños … derivan de la etapa BASE, no del anterior» | alta |
| PL-06 | `buildRungs('linear')` | trabajo 4 sem +1 serie; trabajo 4 sem +2 series; descarga 1 sem −1 serie con hold | P06 §14.5: «5 Acumulación 1 +1 serie … 7 Descarga −1 serie · sin progresión» | media |
| PL-07 | `buildRungs('blank')` y aplicar con lista vacía | `[]`; el botón de aplicar no aparece; nunca se llama a `addStageLadder` con `[]` | P06 §14.8: «El botón no está; nunca se llama a `addStageLadder` con `[]`» | alta |
| PL-08 | `newRung('work')`; `newRung('deload')` | `{ kind:'work', durationWeeks:4, rx:{} }`; descarga 1 sem, `setsDelta` −1, hold | P06 §14.6: «`{ kind:'work', durationWeeks:4, rx:{} }`» | alta |
| PL-09 | lista [trabajo, descarga, trabajo] | el tercero se llama con `n` = 2 | P06 §14.8: «se llama con `n` = 2, no 3» | alta |
| PL-10 | `baseStageIdx` con [a mano, rx, rx]; con [a mano, a mano] | 0; 1 | P06 §7.4: «La base es la última etapa SIN regla» | alta |
| PL-11 | `baseStageIdx` con todas las etapas con `rx` | la spec no dice qué índice devuelve | P06 §7.4 (no cubre el caso) | baja |
| PL-12 | `describeRx` de {setsDelta 1, scope accessories}; {repsShift −3, restPct 25, scope keys}; noop | «+1 serie en accesorios»; «−3 reps en básicos · +25% descanso»; «sin cambios» | P06 §14.4/§14.5: «−3 reps en básicos · +25% descanso» | alta |
| PL-13 | rangos de campos del plan | series −3…+3; reps −6…+6; descanso −50…+100 paso 5; semanas 1-52 | P06 §14.3: «−3…+3», «−6…+6», «−50…+100, paso 5» | alta |
| PL-14 | `setsDelta` +3 y +5 aplicados a `applyRx` directamente | ¿recorta a ±3, o la UI es lo único que limita? | P06 §4.3 («−2..+2») frente a P06 §14.3 («−3…+3») | baja |
| PL-15 | programa viejo sin `stages` con 15 rotaciones | `ensureStages`: 1 etapa con `durationWeeks` null (no 15 ni 4) | P06 §3.2.g: «La migración usa `durationWeeks: null`» frente a P06 §9 «`max(stageWeeksCompleted, 4)`» | baja |
| PL-16 | duplicar la etapa del medio | copia al final, con `derivedFrom` sellado | P06 §14.4: «**añade al final**, no detrás de la fila tocada» | alta |
| PL-17 | preset Intensidad por defecto | trabajo 1: `keys` −3 reps +25 % descanso; trabajo 2: `keys` −5 reps +50 % `incrementScale` 0.5; más descarga | P06 §7.3 (tabla de escaleras) | media |
| PL-18 | preset Volumen por defecto | trabajo 1: `accessories` +1 serie; trabajo 2: `accessories` +2 series; más descarga | P06 §7.3 (tabla, tercer peldaño +3 solo en la tabla original) | media |

### 5C. Propuesta de etapa (P07, aparcada entera el 4-oct-2026)

Estas filas solo valen si `stageProposal.js` llegó a existir; la spec está marcada «aparcada entera».

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| PS-01 | 7 semanas de log (o 1 ciclo cerrado) | `null`: el planificador se abre vacío | P07 §5: «<8 semanas de log o <2 ciclos cerrados ⇒ **`null`**» | alta |
| PS-02 | adherencia 69 % con rendimiento plano | R1: repetir igual (noop), misma duración | P07 §5: «adherencia <70% ⇒ **repetir igual**» | alta |
| PS-03 | adherencia exactamente 70 % | R1 no dispara (el umbral es «<70%») | P07 §5: «adherencia <70%» | media |
| PS-04 | coste alto, rendimiento no sube, etapa previa no descarga | R2: descarga de 1 ciclo (`setsDelta` −1, hold) | P07 §5: «Coste alto + rendimiento no subiendo ⇒ DESCARGA**, 1 ciclo» | alta |
| PS-05 | igual pero la etapa que cierra ya era descarga | R2 no dispara; cae a R5 | P07 §5: «si `stageCharacter === 'deload'`, esta regla no dispara» | alta |
| PS-06 | 6 ciclos sin descarga y rendimiento plano | R3: descarga | P07 §5: «≥6 ciclos sin descarga y rendimiento no subiendo ⇒ DESCARGA» | alta |
| PS-07 | rendimiento bajando, ejecución buena | R6: dos etapas, descarga de 1 ciclo y vuelta a la base (noop, 4 ciclos) | P07 §5: «descarga (1 ciclo) + vuelta a la base (noop, 4)» | alta |
| PS-08 | sin ninguna regla aplicable | R7: repetir la base con `setsDelta` +1 durante 4 ciclos | P07 §5: «repetir la base con `setsDelta:+1`, 4 ciclos» | alta |
| PS-09 | duración propuesta: etapa cerrada de 8 ciclos; de 2; sin límite | 5; 3; 4 | P07 §5.1: «acotada a 3-5 ciclos. Si era "sin límite", 4.» | media |
| PS-10 | última sesión hace 11 días; hace 10 días | sin propuesta («sin datos recientes»); con 10 días la regla es «>10», así que sí propone | P07 §7: «Si la última sesión tiene **>10 días**, no se propone» | media |
| PS-11 | cliente sin `sessionRpe` | propone igual, `confidence: 'low'` | P07 §2.1: «(1 ⇒ `high`, 2 y 3 ⇒ `low`)» | alta |
| PS-12 | empate entre descarga, repetir y subir | gana la más conservadora: descarga | P07 §5.1: «descarga > repetir > subir» | alta |
| PS-13 | cliente vinculado en un programa del entrenador | ni se calcula ni se muestra | P07 §1.2: «**ni se calcula**» | alta |
| PS-14 | la misma etapa con y sin `stage.rx` | misma propuesta | P07 §3: «**Ninguna regla puede leer `stage.rx`**» | alta |

**Preguntas para el usuario (5)**

1. Escalado del incremento (RX-20): P06 §4.3 redondeaba a `minIncrement` o a 0.25; P12 §4.1 lo cambia a «redondear al `step` resuelto». Con `incrementScale` 0.5 y paso 2.5 el resultado cae en un empate (1.25 entre 0 y 2.5). ¿El preset Intensidad deja el salto en 2.5 (inútil) o a 0 (sin progresión)? Con el paso 5 de la librería (sentadilla), 2.5 también cae al empate.
2. Redondeos sin regla: restPct sobre 90 s (RX-14), suelo del máximo de reps (RX-09), `isKey` ausente (RX-18). ¿Cuál es el comportamiento esperado?
3. Rangos (PL-14): P06 §4.3 dice `setsDelta` −2..+2, `repsShift` −4..+4; §14.3 dice −3…+3 y −6…+6 y manda actualizar los comentarios. ¿`applyRx` recorta o confía en la UI?
4. P06 §3.2.g (migración a `durationWeeks: null`) contradice P06 §9 («`durationWeeks = max(stageWeeksCompleted, 4)`») y P06 §9 (programa sin etapas) sigue en la tabla de QA. ¿Cuál vale?
5. `templateChainIds` (PL-04): si `derivedFrom` apunta a una plantilla borrada, ¿el id borrado aparece en la lista devuelta? P06 §4.1 dice «Corta ante un id inexistente» pero no si lo incluye.
6. P07 está aparcada y usa «ciclos» (R0 «<2 ciclos cerrados», R3 «≥6 ciclos») mientras P08 eliminó los ciclos cerrados. Si se retoma, ¿las reglas pasan a semanas?
7. P06 §7.3 admite `incrementScale` sobre `'stepped'` (escala cada `steps[].value`); P12 §4.1 dice que `stepped` se lee como `fixed`. ¿Se prueba aún el caso `stepped`?

---

## 6. Carga de entrenamiento y volumen semanal (trainingLoad, weeklyVolume)

### 6A. Duración, carga interna y externa

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| TL-01 | 1 ejercicio, 3 series sin tiempo propio, `restSec` 90, algo registrado | modelSec = 3×(35+90) + 180 + 480 = 1035 s = 17.25 min | T04 §3.1: «Σ_ejercicios [ Σ_series (work + rest) + 180 ]» y «+ 480» | alta |
| TL-02 | mismo modelo (17.25 min), reloj de pared 20 min | `sessionMinutes` 20 (dentro de 8.625-34.5) | T04 §3.1: «clamp(entry.duration / 60000, 0.5 × modelSec/60, 2 × modelSec/60)» | media |
| TL-03 | mismo modelo, reloj 60 min, `sessionRpe` 7 | `sessionMinutes` 34.5 (techo 2×); carga interna 241.5 | T04 §3.1 (clamp) y §3.2 (`internalLoad`) | media |
| TL-04 | mismo modelo, reloj 5 min | `sessionMinutes` 8.625 (suelo 0.5×) | T04 §3.1 (clamp) | media |
| TL-05 | mismo modelo, `duration: 0`, `sessionRpe` 7 | no 0 ni NaN; ¿8.625 (suelo del clamp) o 17.25 (el modelo)? | T04 §7: «el clamp cae al modelo; no debe dar 0 ni NaN» | baja |
| TL-06 | sesión con un ejercicio presente y 0 series | `sessionMinutes` distinto del suelo de 4 min; el valor exacto no está | T04 §3.1: «un ejercicio presente con 0 series no es una sesión … suelo de 4 minutos» | baja |
| TL-07 | serie con tiempo real 60 s y `restSec` 120 | cuenta 60 + 120 = 180 s (no 35 + 120) | T04 §3.1: «work = el tiempo REAL de la serie si la tiene, si no 35 s» | media |
| TL-08 | ejercicio sin `restSec` | descanso 90 s | T04 §3.1: «rest = ex.restSec ?? 90» | alta |
| TL-09 | `sessionRpe` 7, reloj 78 min dentro del clamp | carga interna 546 | T04 §5.5: «Carga de la sesión: 546 · +12% vs media 7d» | media |
| TL-10 | sesión sin `sessionRpe` | `internalLoad` null (no 0) | T04 §3.2: «hueco en la serie, NUNCA 0» | alta |
| TL-11 | 5 reps × 80 kg, referencia 100 | `setLoad` 4.0 | T04 §3.3: «`setLoad(set, ref) = reps × (effectiveWeight / ref)`» | alta |
| TL-12 | serie con peso y reps sin ninguna referencia | `setLoad` null y sesión `partial: true` | T04 §3.3: «`null` → esas series no computan y la sesión sale `partial: true`» | alta |
| TL-13 | `isBodyweight`: equipo ['pullup_bar']; []; ['parallettes','dip_bar']; ['resistance_band'] | true en los cuatro | T04 §3.3: «NO vale "equipment está vacío": las dominadas llevan ['pullup_bar']» | alta |
| TL-14 | `isBodyweight`: ['barbell']; ['dumbbells']; ejercicio desconocido (`def` borrado) | false; false; false | T04 §3.3: «def desconocido (ejercicio borrado) → false, default seguro» | alta |
| TL-15 | `effectiveWeight` dominadas, peso corporal 75, lastre 10; sin lastre | 85; 75 | T04 §3.3: «bodyWeight + (set.weight \|\| 0)» | alta |
| TL-16 | `effectiveWeight` asistida (`decrease`), peso corporal 75, asistencia 20 | 55 | T04 §3.3: «bodyWeight − (set.weight \|\| 0)» | alta |
| TL-17 | peso corporal ejercicio sin `bodyWeight` ni fallback | null; sesión `partial` | T04 §3.3: «Sin bodyWeight, los casos 2 y 3 devuelven null» | alta |
| TL-18 | asistida con asistencia 80 kg y peso corporal 75 (75 − 80) | la spec no dice si queda −5 o se corta a 0 | T04 §3.3: «bodyWeight − (set.weight \|\| 0)» (sin suelo) | baja |
| TL-19 | 3 series de 5 reps a 80 kg; mejor e1RM previo 100 (dentro de la ventana) | carga externa 12.0 | T04 §3.3 (referencia 1): «Mejor e1RM del ejercicio en las `weeks` semanas **anteriores**» | media |
| TL-20 | ejercicio estrenado hoy: una serie 80 kg × 5 sin RPE, sin historial | referencia = su e1RM de hoy 93.33; `setLoad` 4.29 | T04 §3.3 (referencia 2): «Mejor e1RM **de la propia sesión**» | media |
| TL-21 | accesorio solo con 15 reps a 20 kg (nunca hay e1RM) | referencia = peso máx. 20; `setLoad` 15.0 | T04 §3.3 (referencia 3): «**Peso efectivo máximo visto**» | alta |
| TL-22 | serie de 15 reps a 60 kg con referencia previa 100 | `setLoad` 9.0 (las de >12 reps sí cuentan) | T04 §3.3: «Series de >12 reps **sí cuentan**» | alta |
| TL-23 | series de tiempo sin reps (plancha) | no computan y no marcan la sesión como parcial | T04 §3.3: «no computan y tampoco marcan la sesión como parcial» | alta |
| TL-24 | PR de hoy en un ejercicio; la carga de una sesión de hace 3 meses | la sesión antigua no cambia (histórico inmutable) | T04 §3.3: «un PR de esta semana no puede reescribir la carga de hace tres meses» | alta |
| TL-25 | bloque AMRAP con 720 s activos | aporta 720 × 0.04 = 28.8 | T04 §3.4: «`BLOCK_LOAD_PER_SEC = 0.04`» | media |

### 6B. Series diarias, monotonía, estado y rendimiento

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| AG-01 | `rollingMean([10,20,30], 7)` | [10, 15, 20] (ventana expansiva) | T04 §3.4: «Ventana expansiva mientras no haya n días de historial» | media |
| AG-02 | `monotony([1,2,3,4,5,6,7])` | 2.0 (media 4, desviación poblacional 2) | T04 §3.4: «media / desviaciónTípicaPoblacional» | alta |
| AG-03 | `strain` de los mismos siete días | 56 (suma 28 × monotonía 2) | T04 §3.4: «suma × monotony(sieteDias)» | alta |
| AG-04 | siete días iguales [5,5,5,5,5,5,5] | monotonía null, strain null | T04 §3.4: «null si SD === 0» | alta |
| AG-05 | semana con 2 sesiones | UI oculta monotonía y strain; ¿la función devuelve número o null? | T04 §4 (4): «se ocultan si la semana tiene <3 sesiones» | baja |
| AG-06 | `loadState(70, 100)` | 'unloading' (0.7) | T04 §3.4: «'unloading' (<0.8)» | alta |
| AG-07 | `loadState(80, 100)` | 'steady' (0.8 incluido) | T04 §3.4: «'steady' (0.8-1.3)» | media |
| AG-08 | `loadState(130, 100)` | 'steady' (1.3 incluido) | T04 §3.4: «'steady' (0.8-1.3)» | media |
| AG-09 | `loadState(131, 100)` | 'loading' | T04 §3.4: «'loading' (>1.3)» | alta |
| AG-10 | `loadState(50, 0)` | la spec no dice qué pasa con la media de 28 días a 0 | T04 §3.4 (sin caso) | baja |
| AG-11 | `indexTo100([50, 60, 75])` | [100, 120, 150] | T04 §5.2 (4): «La base 100 es el **primer punto de la ventana visible**» | alta |
| AG-12 | `indexTo100([0, 10, 20])` (primer punto 0) | la spec no dice cómo se indexa | T04 §5.2 (4) (sin caso) | baja |
| AG-13 | Rendimiento: ejercicio A 100→110 y B 40→44 | índice medio 110 | T04 §5.2 (5): «se promedian los índices, no los kilos» | media |
| AG-14 | Rendimiento: A 100→110 y B con un solo dato 40 | solo A entra: 110 | T04 §5.2 (5): «Un ejercicio solo entra con línea base **y** al menos una observación posterior» | alta |
| AG-15 | Rendimiento semanal con e1RM por semana [100, 100, 100, 90] (semana de descarga) | el índice usa el mejor de las 4 últimas semanas: 100, sin caída | T04 §5.2 (5): «Cada semana toma el **mejor e1RM de las últimas 4 semanas**» | media |
| AG-16 | `dailySeries`: sesiones el día 1 y el día 4 | 4 puntos; los días 2 y 3 con internal 0 y external 0 | T04 §3.4: «Días sin entrenar → { internal: 0, external: 0 }» | alta |
| AG-17 | `dailySeries`: dos sesiones el mismo día | un punto con `sessions` 2 y las cargas sumadas | T04 §3.4: «`sessions`» por día de calendario | media |
| AG-18 | `dailySeries` con sesiones el 2026-10-24 y 2026-10-26 (cambio de hora del 25) | 3 puntos (un día natural cada uno) | T04 §3.4: «Un punto por DÍA DE CALENDARIO local» | media |
| AG-19 | día entrenado sin `sessionRpe` | `internal` ¿null (hueco) o 0? | T04 §3.4 (días sin entrenar a 0) frente a §4 (5) «Hueco en la línea, nunca 0» | baja |
| AG-20 | `effortTrend` con carga externa +5 % y rendimiento +0.5 % entre bloques de 4 semanas | la spec no fija el umbral de «↑» y «=» | T04 §5.2 (4): «`effortTrend` compara **medias de bloque de 4 semanas**» | baja |
| AG-21 | kg a lb en todo el cálculo | el cálculo es en kg; solo la UI convierte | T04 §7: «todo el cálculo en kg; sólo la UI convierte» | alta |

### 6C. Series por grupo muscular (weeklyVolume)

| nº | entrada | resultado esperado | cita | conf. |
|---|---|---|---|---|
| WV-01 | 12 series de pecho (primaryGroup) en los últimos 7 días | barra en accent (dentro de 10-20) | T04 §5.2 (6): «marcas verticales del rango 10-20 series» | media |
| WV-02 | 9 series de pecho en 7 días | barra en naranja (por debajo) | T04 §5.2 (6): «fuera (por arriba o por abajo) = `orange`» | alta |
| WV-03 | 21 series de pecho en 7 días | barra en naranja (por arriba) | T04 §5.2 (6): «fuera (por arriba o por abajo) = `orange`» | alta |
| WV-04 | exactamente 10 y exactamente 20 series | ¿dentro del rango (inclusivo) o fuera? | T04 §5.2 (6): «rango 10-20 series» (no dice si inclusivo) | baja |
| WV-05 | grupo entrenado hace 20 días y 0 esta semana | aparece con 0 series | T04 §5.2 (6): «salen a cero, no desaparecen de la lista» | alta |
| WV-06 | grupo entrenado hace 30 días | no aparece | T04 §5.2 (6): «entrenados en los últimos 28 días» | alta |
| WV-07 | grupo entrenado hace exactamente 28 días | ¿entra o no? | T04 §5.2 (6): «en los últimos 28 días» | baja |
| WV-08 | sesión el domingo y hoy es lunes por la mañana | cuenta en la ventana móvil de 7 días | T04 §5.2 (6): «Ventana móvil de 7 días, no semana natural» | media |
| WV-09 | ejercicio con grupo principal pecho y secundario tríceps | cuenta solo para pecho | T04 §5.2 (6): «barras horizontales por `primaryGroup`» | media |
| WV-10 | series sin completar, drops y calentamientos | la spec no dice si cuentan | T04 §5.2 (6) (sin mención) | baja |
| WV-11 | etapa con 3 sesiones: A con 6 series de pecho, B con 4, C con 0 | «Series por grupo y semana»: pecho 10 | P08 §8.3: ««SERIES POR GRUPO Y SEMANA» … con la misma suma de series de las sesiones de la etapa» | media |

**Preguntas para el usuario (6)**

1. Duración 0 (TL-05) y sesión sin series (TL-06): T04 §7 dice «el clamp cae al modelo»; la fórmula literal da el suelo 0.5× (8.625), no el modelo (17.25). ¿Cuál de los dos? ¿Y qué valor sale con un ejercicio sin series tras el guard de los 480 s?
2. Referencia de 1RM: T04 §3.3 dice «`weeks` semanas anteriores» sin número; T02 §3.2 dice «referencia de 6 semanas». ¿Es `REF_WEEKS` = 6? Contrasta con la ventana de 4 semanas del índice de Rendimiento.
3. Monotonía con menos de 3 sesiones (AG-05): ¿la regla de ocultar está en la función o solo en la UI?
4. Días entrenados sin sRPE (AG-19): ¿`internal` es null o 0? T04 §3.4 dice que los días sin entrenar valen 0 y §4 (5) que sin sRPE el hueco no es 0, pero no define el caso de un día entrenado sin sRPE.
5. Series por grupo: límites 10 y 20 inclusivos (WV-04), 28 días exactos (WV-07), qué series cuentan (WV-10), y si la ventana de 7 días son 168 horas o 7 días naturales hasta hoy.
6. Umbral de `effortTrend` (AG-20): T04 §5.2 describe los cuatro cuadrantes sin porcentajes. ¿Cuánto es «↑» y cuánto «=»?
7. Asistidas con más asistencia que peso corporal (TL-18): ¿`effectiveWeight` negativo o suelo en 0?
8. Peso con coma decimal: T04 §3.3 usa `parseFloat(set.weight)`; con «62,5» da 62. P12 §9.3 solo trata la coma en el peso corporal. ¿Los pesos de series admiten coma?
