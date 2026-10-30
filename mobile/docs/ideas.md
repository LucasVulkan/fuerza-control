# Ideas

Lo escribes tú; Claude lo lee y no lo toca salvo para quitar lo que ya es spec.
Sale en `estado.html` (bloque «Ideas») al hacer `npm run estado`.

Cada `## ` es una idea. El código es opcional y va delante, separado por `·`:

- `## P17 · Título` → reserva la spec P17 (la letra es el tema: E M O P T C U A I).
- `## P16-06 · Título` → una tarea nueva de una spec que ya existe.
- `## Título` → sin código todavía.

Debajo, texto libre: notas, listas, dudas, enlaces. Cuando digas «vamos con P17»,
Claude la convierte en spec y la borra de aquí (si no, `npm run estado` avisa
de que el código está repetido).

Lo que va antes del primer `## ` (esto) no sale en la página.

## Ejemplo de idea sin código

Bórrala cuando apuntes la primera de verdad.

## U16 · Textos

Revisar todos los textos

## T10 · Copiar sesiones ya hechas como texto

En el historial de sesiones, poder copiar una sesión como texto, con el mismo formato que ya tenemos. Para poder pasarla por whatsapp o lo que sea.

## P17 · Etapas con objetivos de rendimiento

explorar si es posible que una etapa dure hasta que consigas X objetivos de rendimeinto. % de mejora, de reps, de un ejercicio o del global, volumen, carga determinada.

## Backup en la Landing

Hablar del backup con drive y del backup y sistema de archivos en la landing.

## P20 · Plantillas de progresión

Elegir una plantilla arriba de la hoja de Progresión y guardar la propia («Guardar como plantilla»). La plantilla incluye también **qué sube** (Peso, Reps…), no solo cuánto y cuándo: al elegirla cambian las tarjetas y los ajustes. Unas vienen con la app (Lineal, Hipertrofia, Peso corporal) y otras las guarda el usuario. Si lo que tienes no coincide con ninguna: «Personalizada». Está como idea en la maqueta `mockups/progresion-hoja-3.html` (versión 1) y sale de P19.

## P21 · Peso objetivo: hasta dónde llega

«Quiero llegar a 60 kg»: con la progresión elegida, cuántas subidas y cuántas semanas harían falta (un rango entre «si todo sale a la primera» y «con calma», 2-3 sesiones por subida), en una gráfica en escalones. Y poder guardarlo como objetivo. Avisar de que es el mejor caso: cuanto más pesado, más cuesta. Encaja con las marcas de la progresión por intención (meta visible con tendencia real, sin dictar el peso de cada sesión). Está en la maqueta `mockups/progresion-hoja-2.html` (versión 2, camino C).
