# Spec — Pulido de UI (apuntes)

> Tema: ui
> En corto: Cinco mejoras visuales apuntadas el 29-sep-2026 para más adelante: el segmentado de Progresión arrastra las pantallas, el recap se lee mejor, las hojas de opciones llevan icono y son todas iguales, las sesiones libres sin hueco delante y los botones del programa de cliente fuera de la tarjeta.
> Fase U28 · pendiente · Progresión: las pantallas se deslizan con el segmentado · §1
> Fase U29 · pendiente · Recap: distribución y legibilidad · §2
> Fase U30 · pendiente · Hojas de opciones con icono y estandarizadas · §3
> Fase U31 · pendiente · Sesiones libres: icono delante o sin hueco · §4
> Fase U32 · pendiente · Programa de cliente: botones fuera de la tarjeta · §5
>
> Estado: **apuntes sin investigar** (29-sep-2026). Son notas del usuario, no
> spec cerrada: antes de implementar cualquiera hay que leer el código y cerrar
> el diseño. Fases independientes entre sí.

## 1. U28 — Progresión: las pantallas se deslizan con el segmentado

Al cambiar en el control segmentado entre Ejercicios, Carga e Historial, el
contenido cambia de golpe. Tiene que desplazarse de lado a la vez que el
resalte del segmentado, como un pager.

## 2. U29 — Recap: distribución y legibilidad

El recap tiene muchas cosas y hoy se lee mal. Necesita mejor jerarquía y
reparto del espacio.

## 3. U30 — Hojas de opciones con icono y estandarizadas

Las hojas deslizables con listas de opciones tienen que llevar icono en cada
fila y ser todas la misma pieza. Sospecha del usuario: en Plantillas quedan
hojas antiguas, y algún menú de long press de cliente que no usa la hoja nueva.
Hay que inventariar todas antes de tocar nada.

## 4. U31 — Sesiones libres: icono delante o sin hueco

Las filas de sesiones libres dejan un espacio vacío delante. O se pone un icono
en ese hueco o se elimina el espacio.

## 5. U32 — Programa de cliente: botones fuera de la tarjeta

En el programa de un cliente, los botones van pegados a la tarjeta. Tienen que
separarse como en el tab «Programa» (ver [tab-programa.md](tab-programa.md)).

## Fases

| Fase | Qué | Estado | Coste |
|---|---|---|---|
| U28 | Pager sincronizado con el segmentado de Progresión | pendiente | 🟡 |
| U29 | Rediseño de la distribución del recap | pendiente | 🟡 |
| U30 | Inventario de hojas de opciones + icono y pieza común | pendiente | 🟡 |
| U31 | Hueco delante de las sesiones libres | pendiente | 🟢 |
| U32 | Botones del programa de cliente fuera de la tarjeta | pendiente | 🟢 |
