# Spec — Modelo de conexión entrenador ↔ cliente

> Estado: **App IMPLEMENTADA (fases 1a y 1b). SQL DESPLEGADO** (ago 2026).
> Verificado en el servidor: `claim_trainer_slots` ya no existe y las seis
> funciones restantes siguen siendo `security definer`.
>
> **Falta la prueba en dispositivo** de los dos escenarios que no se pueden
> simular — ver §7.
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

### SQL — `supabase/connection_model.sql` ✅ desplegado (ago 2026)

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

### App — fase 1a ✅ (store y servicios)

- `linkToTrainer` descarga el programa **después** de vincularse. El orden es la
  garantía de que la consulta por código no tenga que publicar nada
  aprovechable, y hay un test que lo vigila comparando el orden de llamada.
- `validateClientCode` usa `is_linked` y `program_name`.
- `reissueClientCode(clientId)` — acción nueva del entrenador.
- `supabaseSync`: `reissueClientCode`, `transferMySlotsTo`, y un `rpcError()`
  que extrae el código seco de la RPC a `err.code`, para que quien llama
  ramifique por código y no por subcadena del mensaje (lección del §19).
- Import muerto de `claimTrainerSlots` retirado del store.
- **Todos los `require()` de `supabaseAuth` y `config/supabase` pasan a import
  estático.** No era opcional: `require` lo resuelve Node saltándose Vite, así
  que ni alias ni mocks llegan y esas funciones quedaban fuera del alcance de
  los tests. Lint del store: 15 → 5 errores. Solo queda el de
  `react-native-purchases`, que sí es una carga perezosa deliberada.

### App — fase 1b ✅ (pantallas)

- `ClientCodeModal`: aviso cuando el hueco ya está ocupado, y `SLOT_OCCUPIED`
  traducido a "pide a tu entrenador un código nuevo — tu historial se conserva"
  en vez del código crudo. **No se bloquea en la validación**: si el ocupante
  resulta ser el mismo usuario el servidor deja pasar (es idempotente), así que
  decide él y no la pantalla.
- Ficha de cliente (`ClientCodeBlock`, pestaña Info): acción "Generar código
  nuevo" con confirmación que explica qué se conserva y para qué sirve. Vive en
  la tarjeta permanente, no en la del tab de Programa, que desaparece en cuanto
  el cliente canjea — que es justo cuando hace falta.
- `TrainerSyncModal`: las **tres** llamadas a `claimTrainerSlots` fuera.
  - Login social: `transferMySlotsTo(nuevoId)` dentro del tramo autenticado con
    el código viejo. Desaparece la recolección de identificadores de huecos: el
    servidor filtra por `trainer_id = auth.uid()` y no hay nada que enumerar.
  - Alta de cuenta por código: se captura el código anterior antes de que
    `setTrainerSyncMode` lo sustituya, y se cede desde su sesión.
  - `handleReconnect`: la llamada se borra sin sustituto. Recuperar por código
    devuelve **siempre el mismo user id**, así que los huecos ya son suyos: ese
    `claimTrainerSlots` no arreglaba ningún escenario real y sí abría el fallo 26.
- `claimTrainerSlots` retirada de `supabaseSync`.

**Limitación conocida y heredada:** el traspaso solo funciona si la cuenta
anterior era de tipo código, la única que se puede recuperar en silencio. De una
cuenta social a otra haría falta que el usuario entrase en la vieja.

### Pendiente

- §4.3: puerta real en `code_reveal` (reescribir los últimos 4 caracteres) y
  oferta de vincular Google/Apple como recuperación.
- §5: distinguir tipos de fallo y reintentar en primer plano.

## 7. Prueba en dispositivo — pendiente

**Probar en dispositivo.** Ciclo de reinstalación: cliente anónimo conectado → borrar datos de la app → mismo código debe ser rechazado → el entrenador genera código nuevo → entra y el historial sigue ahí. Más conexión limpia y cambio de modo de cuenta.

Lo único que queda del modelo, y no se puede simular desde los tests: dependen
de perder de verdad la identidad anónima y de que Supabase emita sesiones.

**A. Conexión limpia.** Crear cliente → pasar código → conectar desde otro
dispositivo. Debe entrar y bajarse el programa. Comprueba de paso el orden nuevo
(vincular primero, descargar después).

**B. Ciclo de reinstalación**, que es el escenario que motivó todo:
1. Cliente anónimo conectado y con alguna sesión registrada.
2. Borrar los datos de la app del cliente (no basta con cerrarla: hay que
   perder la identidad anónima).
3. Introducir el mismo código → **debe rechazarlo** con el mensaje de pedir uno
   nuevo, no dejar entrar.
4. El entrenador toca "Generar código nuevo" en la pestaña Info.
5. Entrar con el nuevo → **el historial tiene que seguir ahí**.

**C. Cambio de modo de cuenta del entrenador** (solo si la anterior era por
código): pasar a Google y comprobar que los clientes siguen en la lista.

## 8. Lo que NO cambia

El modelo de datos —una tabla, una fila por cliente, buzón compartido— es
correcto y no se toca. Tampoco se cambia Supabase, ni se mete un backend
propio, ni fusión de cambios campo a campo. El problema nunca estuvo ahí.

## 9. Decidido, no volver a abrir

- **El código de cliente se conserva.** Es buena UX y el daño si se filtra queda
  acotado. Lo que cambia es que deja de ser una credencial permanente e
  irrevocable.
- **El código de entrenador seguirá siendo el mecanismo de recuperación**, pero
  el fallo 8 de la auditoría (que sea literalmente la contraseña de la cuenta)
  sigue abierto y se trata aparte.
- **Reinstalación anónima = código nuevo del entrenador.** Decisión del usuario
  (ago 2026) frente a la alternativa de que el código desaloje con
  confirmación, que habría dejado el fallo 7 visible pero abierto.
