# Group 32 (`233:4271`)

## Qué muestra
No es una pantalla ni un mockup de app — es un **grupo decorativo aislado** de 3 formas geométricas: 2 barras negras sólidas y 1 barra con solo borde negro, todas rotadas ~-68.7° y dispuestas en diagonal paralela, tipo marca de comillas / tally marks o "acento gráfico". Es el mismo elemento que aparece pegado abajo-a-la-izquierda del banner en `banner-1.md` (ahí como nodos 235:4355/4356/4357, contenidos en un wrapper llamado igual "Group 32" / id `235:4354`).

## Componentes reconocidos
- Ninguno — es en sí mismo una pieza decorativa (probablemente un ícono/adorno gráfico), no compone otros componentes de la librería.

## Patrones de layout sin componente propio
- No aplica (no es un layout de contenido, es una decoración gráfica de 3 formas superpuestas con `contents` + posicionamiento absoluto).

## Sizing en contexto (fill/hug/fixed)
- Contenedor: `contents relative size-full` — no tiene tamaño propio, hereda del padre. Cada una de las 3 barras es fixed (~19px x 7px) con rotación fija.

## Notas / cosas a confirmar
- Este grupo es exactamente el elemento decorativo que **banner-1 (235:4343) usa y banner-2 (233:4260) / el banner final de HomeView ya no usan** — ver `banner-1.md`. Esto confirma la lectura de que banner-1 es una iteración de diseño anterior/descartada: "Group 32" quedó suelto en la página como resto de esa iteración, sin estar renombrado ni limpiado.
- Visualmente podría interpretarse como comillas tipográficas ("） o como una marca de progreso/racha (streak) de 3 elementos (2 completos + 1 vacío en outline) — la combinación "2 sólidas + 1 outline" es sugerente de un patrón "N de M completados" (similar al selector de días de HomeView con dots llenos/vacíos), pero no hay contexto adicional en el archivo para confirmarlo. Vale la pena preguntar al diseñador qué representaba antes de descartarlo.
- No requiere ninguna acción de implementación — se documenta solo por completitud, ya que el nodo estaba en la lista de pantallas a revisar y no es una pantalla real de la app.
