# Workout Screen with training block (`260:2796`)

## Qué muestra
**Hallazgo principal: este frame es un duplicado exacto de `109:510` ("Workout Screen header collapse").** Se comparó el código generado por `get_design_context` para ambos nodos (normalizando node-ids y URLs de assets, que cambian en cada request) y el diff resultante son únicamente 2 líneas: el nombre de la función (`WorkoutScreenHeaderCollapse` → `WorkoutScreenWithTrainingBlock`) y el `data-name` del frame raíz (`"Workout Screen header collapse"` → `"Workout Screen with training block"`). El resto del árbol — header colapsado, las 4 Exercise Cards (Puente de glúteo, Pull-down vertical compacta, Dominadas, y footer de botones), textos, colores, tamaños — es 100% idéntico, incluso a nivel de node-id interno de cada capa (109:xxx en un archivo, 260:xxx en el otro, pero en las mismas posiciones relativas).

En otras palabras: **pese al nombre, esta pantalla NO contiene ningún bloque de entrenamiento tipo AMRAP/EMOM/for-time integrado.** Es una copia sin modificar de la variante de header colapsado, probablemente creada como punto de partida para diseñar el estado "con bloque de entrenamiento" y aún no desarrollada, o mal nombrada por error.

## Componentes reconocidos
(Idénticos a `109:510` — ver ese archivo para el detalle completo)
- SesionHeader (colapsado, 36.7px)
- Exercise Card expandida (calentamiento + tabla S1/S2/S3 + drops) x2 ("Puente de glúteo", "Dominadas")
- Exercise Card compacta/completada ("Pull-down vertical") con Icons "Check" y EstructuraVisualizacionDatosEjercicios
- Buttons footer (GUARDAR SESIÓN / Descartar sesión)

No se encontró ningún componente, texto o estructura relacionado con AMRAP, EMOM, for-time, rondas, cronómetro de bloque, superserie o circuito en el código ni en las búsquedas de texto sobre el árbol completo.

## Patrones de layout sin componente propio
Idénticos a `109:510` (bloque de calentamiento anidado, sección DROPS anidada, grupo de pills de resumen). Ver ese archivo.

## Sizing en contexto (fill/hug/fixed)
Idéntico a `109:510` — mismas medidas exactas en cada capa (496px, 122px, 532px, 496px de alto para las 4 cards; mismo ancho FILL, etc).

## Notas / cosas a confirmar
- **Confirmar con el diseñador si este frame fue efectivamente diseñado o si es un duplicado accidental/placeholder.** Si la intención era mostrar un bloque AMRAP/EMOM integrado junto a ejercicios normales, ese diseño todavía no existe en el archivo de Figma (al menos no en este nodeId) y habría que pedirlo o buscarlo en otra parte del canvas.
- Si se necesita documentar cómo debería verse un bloque de entrenamiento por tiempo/rondas dentro del Workout Screen, esta pantalla no sirve como referencia — se recomienda no usarla para ese propósito y en su lugar solicitar el nodeId correcto o diseñar el patrón desde cero basándose en las Exercise Cards ya documentadas.
