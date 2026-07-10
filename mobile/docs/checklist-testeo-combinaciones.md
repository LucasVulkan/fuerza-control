# Checklist — testeo en dispositivo de combinaciones de features

Cada feature grande (calentamiento, dropset, superserie, vinculación, bloques)
se verificó aislada; esta checklist cubre las **junturas**, que es donde suele
romper. Orden pensado para reutilizar la preparación de un caso en el
siguiente. Marca cada caja solo si el resultado esperado se cumple tal cual.

## 1. Calentamiento + dropset en el mismo ejercicio

Preparación: un ejercicio con calentamiento Auto ×2 y dropset activado, con
al menos una sesión previa guardada (para tener peso de referencia).

- [ ] En el workout el orden visual es: fila de pills de calentamiento (gris, encadenadas con flecha) → series de trabajo → drops D1… al final.
- [ ] Las pills muestran peso×reps calculado del peso de la última sesión, redondeado a 2,5 kg.
- [ ] El prefill del drop (−20%) parte del peso de la última serie de TRABAJO (las pills no participan en absoluto de ese cálculo).
- [ ] Tocar una pill la pone verde y dispara el timer de descanso configurado; tocarla otra vez la vuelve a gris sin más efecto.
- [ ] La card se colapsa solo con trabajo + drops completos — las pills tocadas o no tocadas no influyen en el colapso.
- [ ] Al guardar, el recap: el volumen y los PRs salen solo de trabajo + drops (el calentamiento nunca se registra, no hay nada que excluir).
- [ ] La siguiente sesión: la sugerencia de progresión se calcula igual que si no hubiera calentamiento (nunca vio esos datos).
- [ ] Cerrar la card y reabrirla (o cambiar de sesión y volver): las pills vuelven a gris — no hay estado que recordar.

## 2. Calentamiento + superserie

Preparación: superserie A1+A2; calentamiento configurado en A1 (y luego repetir con A2).

- [ ] Tocar una pill de A1 dispara el timer con el descanso del calentamiento (no el del ejercicio, no la lógica de superserie) y no interfiere con el estado de la cadena.
- [ ] Marcar ✓ en una serie de trabajo de A1 (miembro no-último) NO dispara descanso (comportamiento de superserie sin cambios).
- [ ] Marcar ✓ en la serie de trabajo de A2 (último miembro) SÍ dispara el descanso del grupo.
- [ ] Con calentamiento en A2: la fila de pills se ve razonable dentro del SupersetBlock, sin romper el layout de filas fusionadas.

## 3. Calentamiento + ejercicios vinculados (linkGroup)

Preparación: dos ejercicios vinculados en sesiones distintas; calentamiento en el segundo; entrena primero el otro miembro del grupo con un peso claro.

- [ ] El peso de referencia de las pills sale de la última sesión DEL GRUPO (el miembro entrenado), no solo del ejercicio propio.
- [ ] Sin historial en todo el grupo: las pills muestran `%×reps` sin kg (o el mensaje de referencia pendiente) hasta que escribes tu primer peso de trabajo — entonces se recalculan en vivo.

## 4. Recalculo en vivo y cambios de config

Preparación: ejercicio con calentamiento Auto ×3, sin sesión previa (para forzar el estado "sin referencia").

- [ ] Sin escribir nada: las pills muestran `%×reps`.
- [ ] Al escribir el peso de la primera serie de trabajo: las pills recalculan su kg al instante, sin recargar la pantalla.
- [ ] Tocar una pill (se pone verde) y LUEGO cambiar el peso de la primera serie de trabajo: la pill sigue verde pero su número se actualiza igual que las no tocadas (siempre en vivo, confirmado por el usuario — no debe quedar congelada).
- [ ] Cambiar el nº de series de calentamiento en el editor (×3 → ×1) y volver al workout: la fila de pills se ajusta al nuevo nº sin arrastrar nada de antes.

## 5. Prescripción del entrenador + calentamiento

Preparación: cliente conectado; el entrenador envía un ajuste de peso para un ejercicio que tiene calentamiento.

- [ ] Las pills del cliente se calculan sobre el peso PRESCRITO (la prescripción gana a "última vez" en la cascada).
- [ ] Consumida la prescripción (sesión guardada), la siguiente sesión vuelve a calcular las pills desde "última vez".

## 6. Duplicar sesión / etapa con todo configurado

Preparación: sesión con un ejercicio con calentamiento + dropset, una superserie y un bloque EMOM.

- [ ] Duplicar la sesión → la copia conserva calentamiento, dropset, superserie (cadena entera, no flag huérfano) y el bloque con sus movimientos.
- [ ] Duplicar la etapa → ídem en todas las sesiones.

## 7. Export / import / envío al cliente

Preparación: programa con un bloque EMOM que use un ejercicio custom que NO aparezca como ejercicio normal (verifica el fix `f4a06ad`), más un ejercicio con calentamiento y dropset.

- [ ] Exportar a archivo e importar (en el otro perfil o tras borrar datos): el movimiento del bloque muestra su NOMBRE, no un id crudo.
- [ ] La config de calentamiento (nº de series/pasos, restSec) y dropset del ejercicio sobreviven al viaje (viven en `exConfig`, no en el log).
- [ ] Enviar el programa a un cliente por Supabase: mismo resultado en el lado cliente.
- [ ] Exportar CON historial: una sesión antigua con drops se ve bien en el historial importado (el calentamiento nunca aparece en el log, así que no hay nada que comprobar ahí).

## 8. Bloques + resto de la sesión

- [ ] Sesión con ejercicios normales + bloque For time: la duración estimada del editor es plausible (±25% de lo real cronometrado).
- [ ] Completar el bloque y guardar: el recap muestra la sección Bloques con delta vs la última vez.
- [ ] El reloj de sesión y el wall-clock del bloque no se pisan (pausar/reanudar app durante un EMOM).
