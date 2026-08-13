# Spec — Modelo de conexión entrenador ↔ cliente

> Estado: **SQL escrito, SIN desplegar. App SIN implementar** (ago 2026).
> El SQL vive en `supabase/connection_model.sql`. Desplegarlo **rompe la app
> actual** (`get_slot_by_code` cambia de firma), así que servidor y app van
> juntos.
>
> Origen: la tanda C de [auditoria-tecnica.md](auditoria-tecnica.md) (fallos 5,
> 7, 8) más el **fallo 26**, que apareció al leer el SQL que no estaba en el
> repositorio y resultó ser el peor del sistema.
>
> **Ventaja de partida:** la app no está publicada. No hay retrocompatibilidad
> que respetar ni datos de usuarios reales que migrar.

## 1. Por qué existe esta spec

Cada análisis del sistema de conexión sacaba fallos nuevos. La causa no era
mala suerte: **la autorización se decidía en cuatro funciones distintas con
cuatro criterios distintos**, y dos de ellas ni siquiera estaban en el
repositorio.

| Función | Comprobaba |
|---|---|
| `release_client_slot` | `where client_id = auth.uid()` ✅ |
| `transfer_client_slot` | caller = nuevo dueño **y** dueño actual coincide ✅ |
| `link_client_to_slot` | nada ❌ |
| `claim_trainer_slots` | **nada** ❌❌ |

Mientras no haya una regla común, arreglar un caso deja el siguiente abierto.

## 2. El modelo

Cada fila de `trainer_clients` es un **hueco** con dos asientos:

- **`trainer_id`** — el dueño. Nunca vacío.
- **`client_id`** — el ocupante. Puede estar vacío.

Todo lo que ocurre es alguien sentándose o levantándose.

### La regla única

> **Un asiento vacío se ocupa con la llave. Un asiento ocupado solo lo libera
> quien está sentado, o el dueño del hueco. Nadie se concede a sí mismo un
> asiento que otro ocupa.**

Consecuencia que compramos: **un código filtrado nunca mete a nadie en un hueco
ocupado.** Solo abre asientos vacíos.

### Estados

| Estado | `client_id` | `disconnected_at` | Significado |
|---|---|---|---|
| **LIBRE** | null | null | Recién creado, nunca ocupado |
| **OCUPADO** | usuario | null | Hay un cliente dentro |
| **VACANTE** | null | fecha | Estuvo ocupado y se liberó |

LIBRE y VACANTE se comportan igual para entrar; la diferencia es informativa
para el entrenador.

## 3. Escenarios del cliente

### 3.1 Primera conexión
El entrenador crea el cliente → sale el código → se lo pasa. Asiento LIBRE, el
código abre, entra.

**Aquí se ofrece vincular Google o Apple**, y es la decisión que convierte 3.2
en automático. Debe ser la opción recomendada, con "seguir sin cuenta" visible
pero secundaria.

### 3.2 Reinstala y está vinculado con Google/Apple
**Automático, sin teclear nada.** Inicia sesión y `getClientSlotByUserId`
encuentra su hueco: la identidad es la misma. Ya funciona hoy.

### 3.3 Reinstala siendo anónimo → pide código nuevo
La identidad anónima **se pierde con la instalación**: era una clave en el
móvil, no una cuenta. El asiento queda OCUPADO por un usuario que ya no existe.

**El servidor no puede distinguir "soy yo otra vez" de "soy otro con su
código".** Las dos peticiones son idénticas byte a byte. No es una limitación
de implementación: no hay nada que comprobar.

Así que decide el entrenador, que es quien conoce a su cliente:

1. El cliente introduce el código → `SLOT_OCCUPIED`.
2. La app dice: *pide a tu entrenador un código nuevo*.
3. El entrenador toca **"Generar código nuevo"** en la ficha.
4. Entra con el código nuevo. **Su historial sigue ahí.**

En una app de masas esto sería fricción inaceptable. Aquí el cliente siempre
tiene un entrenador que le conoce: es un mensaje y un toque.

### 3.4 Ha perdido el código
Mismo camino que 3.3: el entrenador reemite. Hoy **no hay ninguna salida** —
los códigos no se pueden regenerar.

### 3.5 Cambia de móvil
Con Google/Apple: como 3.2. Anónimo: como 3.3.

### 3.6 Se desconecta él mismo
`release_client_slot`, que ya está bien hecha. Suelta el asiento y **borra lo
suyo** (historial, contadores, prescripciones), dejando programa y nombre, que
son del entrenador. El hueco queda VACANTE.

### 3.7 Alguien consigue su código
Asiento OCUPADO → rechazado, sin desalojo ni confirmación que gestionar. Si
estuviera VACANTE sí entraría, pero entonces no hay nadie a quien perjudicar y
el remedio es reemitir.

### 3.8 El entrenador le borra
La fila desaparece. **La app del cliente tiene que detectarlo y decírselo**, no
quedarse en "pendiente de sincronizar" para siempre → depende de §5.

## 4. Escenarios del entrenador

### 4.1 Reinstala y tiene su código
**No hace falta transferir nada.** La cuenta por código es determinista: el
correo sintético sale del código, así que al recuperarla es *el mismo user id*
y sus huecos siguen siendo suyos.

Esto prueba que `claim_trainer_slots` nunca fue necesaria para el escenario más
común.

### 4.2 Cambia de modo de cuenta (código ↔ Google/Apple)
Único uso legítimo de transferir el asiento de entrenador, porque el user id sí
cambia. **Cede quien posee, no reclama quien recibe:**

1. Inicia sesión con Google → anota el user id nuevo.
2. Se reautentica con el código → vuelve a ser el dueño viejo.
3. `transfer_my_slots_to(nuevo_id)` → `where trainer_id = auth.uid()`.
4. Vuelve a Google.

Ese baile de sesiones **ya lo hace `TrainerSyncModal` hoy**: recupera la sesión
de código, lista los huecos y restaura la social. Solo cambia en qué sesión se
ejecuta la transferencia.

### 4.3 Pierde su código sin Google/Apple
**No hay recuperación. La cuenta y todos sus clientes son inaccesibles para
siempre.** El dominio del correo es sintético a propósito, así que no hay a
dónde mandar un enlace.

No es un fallo de seguridad, es un agujero de producto, y es más grave que
varios de los ya arreglados. La pantalla de revelado (`TrainerSyncModal`,
`screen === 'code_reveal'`) **ya dice lo correcto** — *"es la única forma de
recuperar la cuenta"* — pero le faltan dos cosas:

- **"YA LO HE GUARDADO" es una declaración, no una prueba.** Pedir que reescriba
  los últimos 4 caracteres separa a quien lo guardó de quien pulsó por inercia.
- **No se ofrece vincular Google/Apple ahí mismo**, que es la recuperación de
  verdad. El modal ya soporta los modos sociales.

### 4.4 Reemite el código de un cliente
Una sola operación con dos efectos: código nuevo **y** asiento liberado. Por
separado no sirven — un código nuevo sobre un asiento ocupado se estrella
contra la misma pared.

**No borra el historial**, al contrario que 3.6: allí el cliente se va y el
hueco puede acabar en otras manos; aquí vuelve la misma persona.

Sirve igual como **revocación**: si un código se filtra, se reemite. El cliente
conectado queda fuera y vuelve a entrar con el nuevo, que es lo que se quiere al
revocar.

## 5. De qué depende que esto se note

El modelo solo funciona si los fallos dejan de ser silenciosos.
`uploadHistoryToTrainer` captura *cualquier* error y pone `pendingUpload: true`:
sin cobertura, sesión caducada o haber sido expulsado del hueco se ven igual. Y
no hay reintento automático, solo el botón del banner.

Sin esto, un cliente puede pasar semanas creyendo que su entrenador ve sus
entrenos. **Es parte del trabajo, no un extra.**

## 6. Superficie de cambios

### SQL — `supabase/connection_model.sql`, escrito, sin desplegar

| Operación | Cambio |
|---|---|
| `claim_trainer_slots` | **se borra** (fallo 26) |
| `transfer_my_slots_to` | nueva — el espejo correcto |
| `trainer_reissue_client_code` | nueva — sostiene 3.3, 3.4 y 4.4 |
| `new_client_code` | nueva — ayudante interno |
| `link_client_to_slot` | rechaza si está ocupado; misma firma |
| `get_slot_by_code` | sin `client_id`, sin `trainer_id`, sin `program_json`; devuelve `is_linked` y `program_name` |
| `release_client_slot` | sin cambios ✅ |
| `transfer_client_slot` | sin cambios ✅ (deja de ser atacable al no publicarse `client_id`) |

### App — pendiente

- `linkToTrainer` descarga el programa **después** de vincularse
  (`get_slot_by_code` ya no lo devuelve).
- `validateClientCode` usa `is_linked` y `program_name`.
- Mensaje de `SLOT_OCCUPIED` que dirija a pedir código nuevo.
- Ficha de cliente: acción "Generar código nuevo".
- `TrainerSyncModal`: transferencia en la sesión del dueño viejo; retirar
  `claimTrainerSlots`; puerta real en `code_reveal` + oferta de vincular
  Google/Apple.
- Import muerto de `claimTrainerSlots` en `store/useStore.js:25` (hoy es uno de
  los errores de lint).
- §5: distinguir tipos de fallo y reintentar en primer plano.

## 7. Lo que NO cambia

El modelo de datos —una tabla, una fila por cliente, buzón compartido— es
correcto y no se toca. Tampoco se cambia Supabase, ni se mete un backend
propio, ni fusión de cambios campo a campo. El problema nunca estuvo ahí.

## 8. Decidido, no volver a abrir

- **El código de cliente se conserva.** Es buena UX y el daño si se filtra queda
  acotado. Lo que cambia es que deja de ser una credencial permanente e
  irrevocable.
- **El código de entrenador seguirá siendo el mecanismo de recuperación**, pero
  el fallo 8 de la auditoría (que sea literalmente la contraseña de la cuenta)
  sigue abierto y se trata aparte.
- **Reinstalación anónima = código nuevo del entrenador.** Decisión del usuario
  (ago 2026) frente a la alternativa de que el código desaloje con
  confirmación, que habría dejado el fallo 7 visible pero abierto.
