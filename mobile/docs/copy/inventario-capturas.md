# Inventario de capturas para revisar el copy

Objetivo: ver **en contexto** cada texto de la app, sobre todo los explicativos
(subtítulos, ayudas, pantallas vacías, avisos, hojas de documentación).

- Móvil: Xperia J9210, 1080×2520, Expo Go. Datos de prueba.
- Capturas en `mobile/docs/copy/capturas/NNN-area-que.png`.
- Reglas al capturar: en avisos de borrar/descartar **siempre «Cancelar»**; en el
  paywall **nunca comprar**; si un estado falla dos veces → `PENDIENTE` y seguir.
- Plan FREE/PRO: Menú ≡ → sección *Developer* → cambiar plan (solo en desarrollo).
- Los toasts duran ~2 s: capturar justo tras la acción.

Leyenda: ★ = muchos textos explicativos (prioridad) · ✎ = solo texto, no se puede
provocar fácilmente (va a la revisión por texto, `textos-por-pantalla.md`).

## 1. Menú ≡ (cabecera, en cualquier pestaña)

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 001 | Menú de ajustes, arriba | ≡ |
| 002 | Menú de ajustes, abajo (Preferencias, Cuenta, Developer) | ≡ → deslizar |
| 003 | Programas archivados (hoja) | ≡ → «Programas archivados» |
| 004 | Exportar (hoja) | ≡ → «Exportar» |
| 005 | Importar archivo | ≡ → «Importar archivo» → capturar selector y volver (atrás) |
| 006 ★ | Entrenador (vincular) | ≡ → «Entrenador» |
| 007 ★ | Copia en Google Drive | ≡ → «Copia en Google Drive» |
| 008 ★ | Sincronización con clientes (modal) | ≡ → «Sincronización con clientes» (solo PRO) |
| 009 | Unidades / Peso corporal / Tema / Idioma | ≡ → tocar cada fila, una captura por selector |
| 010 | Pestañas de entrenador / Sesiones en pestañas / Regla al deslizar | ≡ → filas con interruptor (una captura) |
| 011 ★ | Plan → paywall | ≡ → «Plan» (en FREE) |
| 012 ★ | Documentación | ≡ → «Documentación» → una captura por sección (desplazar) |
| 013 ★ | Eliminar mi cuenta (modal) | ≡ → «Eliminar mi cuenta» → capturar, **cancelar** |

## 2. Sesión (pestaña Inicio)

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 020 | Inicio con programa | pestaña «Sesión» |
| 021 | Inicio desplazado (sesiones libres) | desplazar abajo |
| 022 | Hoja «Sesión libre» | botón de sesión libre |
| 023 | Hoja «Desde tus plantillas» | Sesión libre → «Desde tus plantillas» |
| 024 | Banner de sesión activa | empezar una sesión y volver a Inicio |
| 025 | Aviso «Descartar sesión» | con sesión activa, empezar otra → **cancelar** |
| 026 | Inicio en pestañas (U13) | activar «Sesiones en pestañas» en ≡ y volver |
| 027 ✎ | Aviso de actualización de programa (entrenador) | — |

## 3. Entreno (Workout) y resumen

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 030 | Workout, primer ejercicio | Inicio → empezar una sesión con ejercicios (Sesión B) |
| 031 | Serie marcada + temporizador de descanso | marcar una serie |
| 032 | Regla al deslizar | arrastrar sobre el peso/reps |
| 033 | Notas del ejercicio | icono de notas |
| 034 | Variantes del ejercicio | selector de variante |
| 035 | Objetivo puntual (AdHocTarget) | según tarjeta de ejercicio |
| 036 | Superserie | sesión con superserie, si existe |
| 037 ★ | Bloque de condicionamiento | sesión con bloque, si existe |
| 038 | Aviso cancelar bloque | bloque → cancelar → **cancelar** |
| 039 ★ | Resumen de la sesión (Recap) | terminar la sesión |
| 040 | Siguiente sesión | desde el resumen |

## 4. Programa (pestaña)

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 050 | Programa, arriba | pestaña «Programa» |
| 051 | Programa, abajo | desplazar |
| 052 | Más opciones (hoja) | «…» / Más opciones |
| 053 | Archivar (hoja) | Más opciones → «Archivar» → capturar, cerrar |
| 054 | Aviso eliminar programa | Más opciones → «Eliminar programa» → **cancelar** |
| 055 | Detalle del programa | tocar el programa / «Ver» |
| 056 | Sin programa (NoProgram) | solo si hay un programa archivable; si no ✎ |

## 5. Editores

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 060 | Editor de programa (etapas) | Programa → editar |
| 061 | Ajustes de la etapa (⚙) | editor → ⚙ |
| 062 | Aviso borrar etapa | ajustes de etapa → borrar → **cancelar** |
| 063 | Etapa vacía (sin sesiones) | crear etapa nueva con «+» |
| 064 ★ | Planificador de etapas | editor → «Ver plan ›» |
| 065 | Editor de sesión | editor → Sesión B |
| 066 | Aviso borrar sesión | editor de sesión → borrar → **cancelar** |
| 067 | Selector de ejercicios | editor de sesión → añadir ejercicio |
| 068 | Selector: búsqueda sin resultados | escribir «zzz» |
| 069 ★ | Editor de ejercicio | tocar un ejercicio |
| 070 ★ | Hoja de progresión | editor de ejercicio → progresión |
| 071 | Editor de bloque | sesión → añadir bloque de condicionamiento |
| 072 ★ | Ejercicio personalizado | selector → crear ejercicio |
| 073 | Pegar entreno | según entrada «Pegar» |

## 6. Progresión (pestaña)

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 080 | Progresión, pestaña principal | pestaña «Progresión» |
| 081 ★ | Carga (LoadTab) + calendario | sub-pestaña Carga |
| 082 ★ | Info de métricas (MetricInfo) | icono ⓘ en cada métrica, una captura por métrica |
| 083 | Historial | sub-pestaña Historial |
| 084 | Aviso borrar historial | historial → borrar → **cancelar** |
| 085 | Tarjeta de sesión (detalle) | tocar una sesión del historial |

## 7. Entrenador (PRO: activar pestañas de entrenador)

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 090 | Clientes, panel | pestaña «Clientes» |
| 091 | Clientes vacío / plan FREE (FreeClientsSheet) | en FREE |
| 092 ★ | Código de cliente (modal) | añadir cliente |
| 093 | Ficha de cliente | tocar un cliente |
| 094 | Menús y avisos de la ficha | cada «…» → capturar, **cancelar** destructivos |
| 095 | Plantillas | pestaña «Plantillas» |
| 096 | Aviso borrar plantilla | **cancelar** |

## 8. Onboarding

| # | Qué | Cómo llegar |
|---|-----|-------------|
| 100 ★ | Onboarding, cada paso | ≡ → «Nuevo programa» → una captura por paso, **sin terminar** al final (atrás) |
| 101 ★ | Hoja de ajustes (AdjustSheet) | dentro del onboarding |
| 102 ★ | Panel de adaptación | paso de adaptación |

## ✎ Solo por texto (no capturables sin forzar errores)

Errores de red/Drive/Google/Apple, sincronización, archivo inválido, sesión de
Drive caducada, «No se pudo generar el programa», enviar a cliente sin conexión,
notificación del temporizador. Van en `textos-por-pantalla.md`.

## Hallazgos al hacer el inventario

- [ClientsScreen.jsx:2430](../../src/screens/ClientsScreen.jsx#L2430): toast
  **sin traducir** («N sesiones nuevas» / «Historial al día» escrito a mano en español).
- [OnboardingScreen.jsx:619](../../src/screens/OnboardingScreen.jsx#L619): textos de
  respaldo en español dentro de `t(…)`; si la clave existe no se ven, pero sobran.
- ~550 claves de `es.json` no aparecen como `t('clave')` literal. Muchas se usan
  de forma dinámica (plurales, `docs.sections`, meses), pero algunas pueden estar
  muertas: conviene revisarlas aparte antes de corregir su copy.
