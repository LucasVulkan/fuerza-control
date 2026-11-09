# Guía del .blend: qué es cada cosa y cómo trabajar

Para el usuario. El detalle técnico está en [HANDOFF.md](HANDOFF.md); la estructura del catálogo, en la spec [X03](../../mobile/docs/specs/X03-maniqui-v1-catalogo.md).

## 1. Qué hay en el outliner y quién lo toca

```
Scene Collection
├─ 🔴 1 · Maniquí · NO TOCAR          rig y malla. Se posa, no se edita
├─ 🟢 2 · Props para posar · TUYO      barra, discos, asiento, respaldo, plataforma: solo para ver al posar, no se exportan
└─ 🟢 3 · Manos · TUYO
      ├─ Manerales de polea            (ocultos con el ojo) dónde va cada maneral en la mano; su geometría se remodela
      └─ FF_asas                       cilindros de 28 y 40 mm: dónde va el asa en la mano
```

En *2 · Props* está también **`FF_banco`**: el banco, el asiento del jalón o el cajón. Es una sola caja colgada del hueso `BANCO` del rig, y **cada acción lo keya**: dónde está y su medida (la escala del hueso: ancho, largo y alto en metros) o escondido (escala 0,001). Para moverlo en una acción, posa el hueso `BANCO` y keya.

- **No renombres** las colecciones `FF_*` ni los objetos `FF_*`: los scripts los buscan por su nombre. Los grupos de colores sí se pueden renombrar.
- Los **ejercicios** son acciones. Se eligen en el panel **FormFit** (barra lateral N del visor 3D) o en el Action Editor. Las **manos** están en la **biblioteca de poses** (§3).

| Tuyo | De Claude |
|---|---|
| retocar la pose de cada ejercicio y marcarla lista | crear la acción base de cada ejercicio por script (`blender/ejercicios/`) |
| posar las variantes complejas (acción propia) | variantes por script (el visor) y tipos de base |
| posar y retocar las manos de la biblioteca | exportador, `organizar.py`, catálogo |
| la geometría de manerales y props | |

## 2. De Blender a la app

```
 mano.<id> (biblioteca) ── se aplica al posar ──┐
                                               ▼
 acción del ejercicio (frame 1 inicio, 30 final, con sus dedos)
        │
        └── export.py (Guardar y exportar ──┬─ poses.json ── visor (WebView) ── app
            en el panel FormFit)            └─ mannequin.glb (la malla)
```

Cada acción lleva unas propiedades (Action Editor › barra lateral N › Action › Custom Properties). Las que tocas tú:

| Propiedad | Qué es | Valores |
|---|---|---|
| `ff_status` | en qué punto está | `borrador` · `revisar` · `ok` |
| `ff_mano` | con qué mano de la biblioteca la posaste (solo de referencia) | el id sin `mano.` (`colgado_prono`); vacío = manos distintas en cada lado |
| `ff_name` | el nombre que se ve | texto |
| `ff_base` | cómo la mueve el visor | `stand`, `hinge`, `hang`… o `libre` (tal cual, sin ajustes; las `libre` todavía no llegan a la app) |
| `ff_plan` | en las `libre`, la base que tendrá | `bench`, `split`, `floor`, `cable` |

Las demás (`ff_variant_of`, `ff_axis`, `ff_value`, `ff_pulley`…) las pone el script; no hace falta tocarlas.

**De dónde salen los dedos en la app:** cada acción (ejercicio o variante con acción propia) enseña **sus** dedos, los que keyaste. Una variante sin acción propia (por script) usa los de su ejercicio, o, si cambia el implemento o el maneral, los que pone la app (asas de 28 y 40 mm, `mano.<maneral>`). Por eso retocar una mano de la biblioteca **no** cambia los ejercicios ya posados: vuelve a aplicarla en las acciones que la usan (su `ff_mano`).

## 3. La biblioteca de manos

Cada mano es una **pose** guardada (acción `mano.<id>`, marcada como asset) con solo los huesos de la mano (dedos, palmas y pulgar; los dos lados). Está en el **Asset Shelf**: en **Pose Mode**, la franja de abajo del visor 3D, con sus catálogos *Manos › Barra · Por grosor · Manerales de polea*.

| Grupo | Manos |
|---|---|
| Barra | Colgado, prono · Colgado, supino · Barra en la espalda · Barra de peso muerto y remo |
| Por grosor | Asa 28 mm (mancuerna) · Asa 40 mm (kettlebell) · Mano abierta |
| Manerales de polea | Triángulo · Asa en D · Barra recta · Barra supina · Cuerda |

Las cuatro de *Barra* son nuevas: salen de los dedos del frame 1 de `pullup`, `Chinup`, `back_squat` y `deadlift`, como punto de partida. **Están por retocar.**

**Aplicar una mano** a un ejercicio: Pose Mode, selecciona los huesos de la mano y pulsa la pose en el Asset Shelf. Solo cambian los huesos seleccionados; sin nada seleccionado, cambian las dos manos. Clic derecho › *Apply Pose Flipped* la aplica invertida. Luego, keya (I) en los frames que toque.

**Retocar una mano** de la biblioteca:

1. Pose Mode. Aplica la mano (sin nada seleccionado).
2. Retoca la izquierda. Para la derecha, con la izquierda seleccionada: Ctrl+C y Ctrl+Shift+V (pega invertida).
3. Selecciona los huesos de las dos manos y, en el Asset Shelf, clic derecho sobre esa mano › *Adjust Pose Asset › Replace* (o *Modify*, según la versión).
4. La miniatura: clic derecho › *Refresh Preview* (los scripts no pueden generarla).

Los manerales (triángulo, cuerda…) tienen además su objeto en *3 · Manos › Manerales de polea*: enciende el ojo, mueve el maneral en la mano **izquierda** y deja que Claude ejecute el reflejo (`_manerales.py … reflejar`), que coloca el derecho.

**Una mano nueva** (por ejemplo, la de la goblet): posa la mano y, con sus huesos seleccionados, Pose › *Create Pose Asset* (o el + del Asset Shelf), en *Current File*, con nombre `mano.<id>` y en su catálogo. Apúntala en `ff_mano` de los ejercicios que la usen.

## 4. Recetas

**Retocar un ejercicio y darlo por bueno**

1. Panel FormFit › elige el ejercicio (o el Action Editor). Frames 1 y 30: inicio y final; puedes añadir claves en medio.
2. Retoca y keya **todo** el rig en cada frame que toques (A con todo seleccionado, I).
3. `ff_status` = `ok`.
4. Panel FormFit › **Guardar y exportar al visor**. Avisa a Claude para que pase los tests y lo suba.

**Posar una variante compleja** (acción propia, como la dominada supina)

1. Action Editor con el ejercicio puesto › botón de duplicar junto al nombre. Renómbrala y pulsa el escudo (fake user).
2. En sus propiedades: `ff_variant_of` = el ejercicio, `ff_axis` = el eje (`grip`, `impl`…), `ff_value` = el valor (`supino`), `ff_status` = `borrador`, y `ff_mano` si cambia de mano.
3. Pósala y sigue la receta de arriba.

**El catálogo** (qué ejercicios y variantes queremos, y en qué punto está cada uno): `npm run catalogo` en `formfit-mannequin/` escribe `docs/catalogo.html` con lo que diga el .blend tras exportar. Lo que se quiere está en `catalogo.js`; pídele a Claude que lo cambie.

**Si algo se rompe**: el `.blend` está en git, y Claude puede volver a la versión anterior. `blender/organizar.py` vuelve a ordenar el archivo sin cambiar nada de lo que ya está en su sitio.
