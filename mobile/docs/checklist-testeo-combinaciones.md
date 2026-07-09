# Checklist — testeo en dispositivo de combinaciones de features

Cada feature grande (calentamiento, dropset, superserie, vinculación, bloques)
se verificó aislada; esta checklist cubre las **junturas**, que es donde suele
romper. Orden pensado para reutilizar la preparación de un caso en el
siguiente. Marca cada caja solo si el resultado esperado se cumple tal cual.

## 1. Calentamiento + dropset en el mismo ejercicio

Preparación: un ejercicio con calentamiento Auto ×2 y dropset activado, con
al menos una sesión previa guardada (para tener peso de referencia).

- [ ] En el workout el orden visual es: filas C1/C2 (hundidas) → series de trabajo → drops D1… al final.
- [ ] Las C vienen pre-rellenas con % del peso de la última sesión, redondeado a 2,5 kg.
- [ ] El prefill del drop (−20%) parte del peso de la última serie de TRABAJO, no de una C.
- [ ] La card no se colapsa hasta marcar TODO: C + trabajo + drops.
- [ ] Al guardar, el recap: el volumen incluye drops y excluye las C; ningún PR sale de una C.
- [ ] La siguiente sesión: la sugerencia de progresión ignora las C (no baja porque las C pesen poco).

## 2. Calentamiento + superserie

Preparación: superserie A1+A2; calentamiento configurado en A1 (y luego repetir con A2).

- [ ] Marcar ✓ en una C de A1 dispara el timer con el descanso del calentamiento (no el del ejercicio, no la lógica de superserie).
- [ ] Marcar ✓ en una serie de trabajo de A1 (miembro no-último) NO dispara descanso.
- [ ] Marcar ✓ en la serie de trabajo de A2 (último miembro) SÍ dispara el descanso del grupo.
- [ ] Con calentamiento en A2 (miembro intermedio/último): las filas C se ven razonables dentro del SupersetBlock, sin romper el layout de filas fusionadas.
- [ ] `C×N` aparece en la meta line del miembro que tiene calentamiento, no en el otro.

## 3. Calentamiento + ejercicios vinculados (linkGroup)

Preparación: dos ejercicios vinculados en sesiones distintas; calentamiento en el segundo; entrena primero el otro miembro del grupo con un peso claro.

- [ ] El peso de referencia de las C sale de la última sesión DEL GRUPO (el miembro entrenado), no solo del ejercicio propio.
- [ ] Sin historial en todo el grupo: banner de "se calculan al escribir tu primer peso" y las C se rellenan al teclear el primer peso de trabajo.

## 4. Cambiar la config de calentamiento entre sesiones

Preparación: ejercicio con calentamiento ×3 y una sesión guardada con las C hechas.

- [ ] Cambiar a ×1 en el editor → la siguiente sesión muestra 1 sola C (sin filas fantasma de las 3 anteriores).
- [ ] Cambiar de Ninguno a ×2 con sesión EN CURSO → las filas C aparecen sin perder lo ya tecleado en las series de trabajo.
- [ ] Cambiar a Personalizado con 4 pasos → 4 filas C con sus % correctos.
- [ ] Matar la app a mitad de sesión con C marcadas → al reabrir, las C conservan valores y ✓.
- [ ] Guardar con C sin marcar pero trabajo completo → en el historial las C se autofillan de las C de la sesión previa (emparejadas C-con-C, no por posición absoluta).

## 5. Prescripción del entrenador + calentamiento

Preparación: cliente conectado; el entrenador envía un ajuste de peso para un ejercicio que tiene calentamiento.

- [ ] Las C del cliente se calculan sobre el peso PRESCRITO (la prescripción gana a "última vez" en la cascada).
- [ ] Consumida la prescripción (sesión guardada), la siguiente sesión vuelve a calcular las C desde "última vez".

## 6. Duplicar sesión / etapa con todo configurado

Preparación: sesión con un ejercicio con calentamiento + dropset, una superserie y un bloque EMOM.

- [ ] Duplicar la sesión → la copia conserva calentamiento, dropset, superserie (cadena entera, no flag huérfano) y el bloque con sus movimientos.
- [ ] Duplicar la etapa → ídem en todas las sesiones.

## 7. Export / import / envío al cliente

Preparación: programa con un bloque EMOM que use un ejercicio custom que NO aparezca como ejercicio normal (verifica el fix `f4a06ad`), más un ejercicio con calentamiento y dropset.

- [ ] Exportar a archivo e importar (en el otro perfil o tras borrar datos): el movimiento del bloque muestra su NOMBRE, no un id crudo.
- [ ] La config de calentamiento y dropset del ejercicio sobrevive al viaje.
- [ ] Enviar el programa a un cliente por Supabase: mismo resultado en el lado cliente.
- [ ] Exportar CON historial: una sesión antigua con C y drops se ve bien en el historial importado.

## 8. Bloques + resto de la sesión

- [ ] Sesión con ejercicios normales + bloque For time: la duración estimada del editor es plausible (±25% de lo real cronometrado).
- [ ] Completar el bloque y guardar: el recap muestra la sección Bloques con delta vs la última vez.
- [ ] El reloj de sesión y el wall-clock del bloque no se pisan (pausar/reanudar app durante un EMOM).
