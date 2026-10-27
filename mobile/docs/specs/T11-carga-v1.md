# Spec — Carga v1: que la vista Carga sirva a todos y no engañe

> Tema: entrenamiento
> En corto: La vista Carga deja de quedarse vacía si no apuntas el esfuerzo de la sesión, compara las series de cada grupo con lo previsto, y deja de decir cosas que no son (descargando por faltar un día, rendimiento subiendo cuando estás estancado). Sin rehacer la pantalla: la versión nueva entera es la v2.
> Fase T11-01 · pendiente · Sin sRPE la vista no se vacía · §3
> Fase T11-02 · pendiente · Series por grupo contra lo previsto · §4
> Fase T11-03 · pendiente · Rendimiento: el número dice las últimas 4 semanas · §5
> Fase T11-04 · pendiente · El estado de carga no presupone una descarga · §6
> Fase T11-05 · pendiente · Monotonía y strain en una subtarjeta, con sRPE · §7
> Fase T11-06 · pendiente · Datos con sentido: casos y bordes · §8
>
> Estado: **spec escrita, sin implementar** (27-oct-2026). Sale de la revisión de
> la carga semanal que siguió al replanteo de la progresión
> ([P18](P18-motor-progresion.md)), con el mismo método: cinco personas pasadas
> por los cálculos reales de `trainingLoad.js` semana a semana en el **visor de
> carga** (`scripts/visor-carga/`, publicado en
> https://claude.ai/artifact/VY98E7ks2Tet15v2guqr8F), y una maqueta de la v2
> ([`carga-semanal.html`](../mockups/carga-semanal.html), publicada en
> https://claude.ai/artifact/KTR8SannLp66b9FjWgQe5N).
>
> **Alcance acotado por el usuario (27-oct): v1 = que los datos tengan sentido, que
> funcione sin sRPE y arreglar lo que está mal. No se rehace la pantalla.** Todo lo
> demás está en §9 (v2). Sigue mandando [T04](T04-training-load.md) en todo lo que
> esta spec no toca.

---

## 1. Por qué

Lo que enseñó el visor sobre la vista Carga de hoy (`LoadTab.jsx`):

| Persona (fila del visor) | Qué pasa hoy |
|---|---|
| Ana y Luis, sin sRPE (todas) | La vista entera sale vacía («Aún no hay datos de esfuerzo»), y con ella Rendimiento y Series por grupo, que no dependen del sRPE |
| Carlos falta un día (carlos-7) | «−36 % · Estás descargando» |
| Carlos estancado desde la semana 4 (carlos-10) | Rendimiento «+27 %» fijo: con el periodo por defecto (3M) compara con el principio de la ventana y no se ve el estancamiento |
| Ana entrena 2 días (todas) | Series por grupo de los últimos 7 días contra una banda de 10-20: siempre «por debajo» |
| Javi, 3-4 sesiones (javi-6) | La monotonía sale siempre «variada»; el strain % se calcula y no se pinta |

## 2. Para qué sirve la carga (y por qué la v1 no toca los periodos)

La **semana** dice cómo voy; el **periodo** (1M/3M/6M/Todo) dice hacia dónde voy: si
acumulo trabajo poco a poco o a saltos, si la descarga bajó la carga y volví más
fuerte, si en este bloque la fuerza sube mientras sube el trabajo. El selector de
periodo se queda como está (T04 §4: el cálculo va siempre sobre el log entero, el
periodo solo recorta lo que se pinta).

## 3. T11-01 — Sin sRPE la vista no se vacía

Hoy `hasRpe = loads.some((l) => l.internal != null)` y, si es falso, `LoadTab`
enseña el estado vacío `load.emptyNoRpe` en lugar del panel.

- Sin ninguna sesión con sRPE, el panel se pinta igual **con la carga externa**
  (el trabajo hecho, `sessionLoads().external`, que se calcula siempre) en lo que
  hoy usa la interna: la tarjeta CARGA 7D, el estado de carga y el gráfico de
  evolución (barras diarias + medias de 7 y 28 días). La ficha de la métrica (T02)
  dice cuál se está usando.
- Se ven siempre: SESIONES, Rendimiento y Series por grupo.
- Solo con sRPE: monotonía y strain (§7) y «Esfuerzo vs carga» (necesita las dos).
  En su sitio, una línea: «Apunta el esfuerzo al acabar cada sesión (de 1 a 10) y
  verás también cuánto te cuesta.»
- Con sRPE todo sigue como hoy (carga interna). Si en el periodo hay semanas con y
  sin sRPE, manda la interna, como hoy: las sesiones sin sRPE son hueco, no cero
  (T04 §4.5).
- El estado vacío solo queda para «aún no hay sesiones».

## 4. T11-02 — Series por grupo contra lo previsto

Sustituye a la ventana de 7 días con banda de 10-20 (T04 §5.2.6), que castigaba a
quien entrena 2 días o fuerza con pocas series. Decisión del usuario (27-oct): es
una **referencia de cómo distribuyes**, no un objetivo de volumen.

- **Semana natural** (lunes a domingo), con el selector de semana que ya haya o la
  semana en curso: un entreno aún no hecho sale como pendiente, no como falta.
- Cada grupo: **hechas de previstas** («6 de 6»). Previstas = series del plan de esa
  semana por grupo, con `plannedSetsByGroup` sobre las sesiones de la etapa activa
  (ya existe, junto a `setsByMuscleGroup`). Sin programa activo, solo las hechas.
- La marca de cada barra es **lo previsto**, no un rango; rejilla **cada 10
  series** para leerla de un vistazo. Por debajo de lo previsto, en `orange`
  (nunca rojo, UI-MIGRATION §4.9); los grupos hechos sin estar previstos salen al
  final.
- Se quita la banda de 10-20 y su texto (`load.groupsHint`).

## 5. T11-03 — Rendimiento: el número dice las últimas 4 semanas

Hoy la cifra de la tarjeta es el cambio desde el principio del periodo visible
(3M por defecto): quien mejoró al principio y lleva dos meses estancado ve
«+27 %», que se lee como «estoy mejorando».

- La **cifra** pasa a ser el cambio de las **últimas 4 semanas** (índice de esta
  semana contra el de hace 4, con `performanceWeekly` tal cual), y lo dice: «+3 %
  en 4 semanas».
- El **gráfico** sigue el periodo, como hoy: ahí se ve la tendencia larga.

## 6. T11-04 — El estado de carga no presupone una descarga

`loadState` < 0,8 dice «Estás descargando», pero la carga no sabe si fue una
descarga o una semana en la que faltaste. En la v1 solo cambian las palabras
(es/en), no la lógica:

| Estado | Hoy | v1 |
|---|---|---|
| `unloading` | Estás descargando. | Esta semana has entrenado menos que en tu último mes. |
| `steady` | Carga estable. | Esta semana, en línea con tu último mes. |
| `loading` | Estás acumulando carga. | Esta semana has entrenado más que en tu último mes. |

## 7. T11-05 — Monotonía y strain en una subtarjeta, con sRPE

Decisión del usuario (27-oct): no merecen tarjeta propia.

- Salen de la fila de tres tarjetas cuadradas a **una subtarjeta estrecha** debajo,
  solo con sRPE y con 3 sesiones o más (T04 §4.4): «Días variados · Estrés +12 %
  sobre tu mes».
- La tercera tarjeta cuadrada pasa a ser **SERIES** de la semana (hechas / previstas).
- **Revisar los umbrales de monotonía**: con 3-4 sesiones sale siempre «variada»
  (0,86-1,15 en el visor). Se fijan mirando el visor y se documentan en la ficha.
- Se pinta el strain % sobre la base, que hoy se calcula y no se enseña; la tira de
  strain semana a semana se queda.

## 8. T11-06 — Datos con sentido: casos y bordes

- Los casos del visor de carga como tests con literales (una semana por persona y
  situación: sin sRPE, falta un día, descarga, estancado, bloque duro).
- Los bordes que dejó abiertos la tabla del oráculo de I01 (módulo 6,
  `docs/auditoria-tests/tablas-de-casos.md`): sesión de duración 0 o sin series,
  semana con sesiones pero sin sRPE (hueco, no 0), referencia de 1RM (6 semanas)
  frente a la ventana de rendimiento (4), límites de 7 y 28 días. Cada uno con su
  decisión escrita aquí y su test.
- Ningún `NaN`, `Infinity` ni negativo en lo que se pinta.

## 9. v2 (anotado, fuera de esta spec)

- **«Tu semana» en frases**, con números concretos y diciendo siempre contra qué se
  compara (nada de «lo normal para ti»): sesiones y series contra lo previsto,
  esfuerzo frente a semanas con un trabajo parecido, fuerza frente a hace 4 semanas.
  Maqueta: `carga-semanal.html`.
- **Un aviso por cliente** en la lista del entrenador («No viene», «Se está
  pasando», «Plano», «Le falta…»), el más importante. Enlaza con C02 (triaje,
  aparcada).
- **Coste por sesión**: comparar cada sesión con la misma sesión de otras semanas,
  en vez de semanas enteras.
- **El trabajo contra lo previsto**, no contra la media.
- **«Tu zona» de series por grupo** (volumen adaptativo) con historial suficiente,
  y bandas de referencia por nivel.
- Arreglar el retraso del chip «Esfuerzo vs carga» (en las descargas dice «fatiga»
  o «adaptación» con semanas de retraso).
- Qué enseña cada periodo para tomar decisiones.

## 10. Fases

| Fase | Qué | Toca | Coste |
|---|---|---|---|
| T11-01 | Panel con carga externa si no hay sRPE | `LoadTab.jsx`, locales | 🟡 |
| T11-02 | Series por grupo contra lo previsto | `LoadTab.jsx` (+ plantillas de la etapa) | 🟡 |
| T11-03 | Rendimiento a 4 semanas | `LoadTab.jsx`, locales | 🟢 |
| T11-04 | Textos del estado de carga | locales | 🟢 |
| T11-05 | Subtarjeta de monotonía y strain | `LoadTab.jsx`, `trainingLoad.js` (umbrales) | 🟢 |
| T11-06 | Casos y bordes con test | `trainingLoad.test.js` | 🟡 |

Las pruebas en dispositivo se escriben al cerrar cada fase.
