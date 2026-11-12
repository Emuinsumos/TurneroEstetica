# Base de datos (Firebase Realtime Database)

Todo vive bajo `/turneroEstetica/businesses/{businessId}/`. Nada fuera de esa raíz.

| Ruta | Contenido | Lectura | Escritura |
|---|---|---|---|
| `config` | datos del negocio y reglas de reserva | pública | admin |
| `services/{id}` | nombre, precio, duración, `professionalIds`, `active`, `deleted` | pública | admin |
| `professionals/{id}` | nombre, foto, `gallery`, `active`, `deleted` | pública | admin |
| `availability/{profId}/weekly/{0-6}` | `open`, `from`, `to`, `breakFrom`, `breakTo` | pública | admin |
| `blockedSlots/{id}` | `date`, `professionalId` (o `all`), `from`/`to` opcionales | pública | admin |
| `appointments/{id}` | datos del cliente y del turno | **solo admin** | crear: cualquiera · editar/borrar: admin |
| `slotLocks/{profId}/{YYYY-MM-DD}/{HHmm}` | id del turno que ocupa esa celda | pública (sin datos personales) | crear si está libre · borrar: admin |
| `auditLog` | cambios administrativos | admin | admin |

`dayOfWeek`: 0 = domingo … 6 = sábado.

## Cómo se evita la doble reserva
Cada turno ocupa celdas de **5 minutos** en `slotLocks`. Ejemplo: un servicio de 30 min a las 09:30
ocupa `0930, 0935, 0940, 0945, 0950, 0955`.

El navegador manda **una sola escritura atómica** con el turno y todas sus celdas.
La regla de las celdas es `solo se puede crear si no existe`. Si otra persona ya tomó
una sola de esas celdas, Firebase rechaza **toda** la escritura y no se guarda nada.
Además, cada celda solo se acepta si existe el turno que la reclama, con el mismo profesional y fecha.

La granularidad fija de 5 minutos hace que el sistema siga siendo correcto aunque después se cambie
el "intervalo de turnos" en la configuración.

Al cancelar un turno (admin), se borran sus celdas (`slots` guarda la lista) y el turno queda con
estado `cancelado`: se libera el horario y se conserva el historial.

## Estados
`pendiente` (lo único que puede crear un cliente) · `confirmado` · `cancelado` · `completado` · `ausente`.

## Precio histórico
`priceAtBooking` se guarda al reservar. Cambiar el precio del servicio no altera turnos anteriores.

## Límites conocidos de las reglas
Las reglas de Firebase no pueden calcular horarios. Por eso, **estas validaciones están en el navegador** y no
las impone la base:
- que el horario esté dentro del horario laboral y no caiga en un descanso o bloqueo;
- la anticipación mínima y el máximo de días a futuro.

Lo que **sí** impone la base: formato de los datos, largo de los campos, estado inicial `pendiente`,
que nadie lea los turnos, y que no se puedan pisar dos reservas.
Un usuario malintencionado que arme la escritura a mano podría reservar fuera de horario
o llenar la agenda con turnos falsos. Si eso pasa, se resuelve con una función en el servidor (ver README).

## Etapa 7.2: modificar / cancelar
- Cada cambio de turno es UNA escritura atómica (turno + celdas) armada por `src/lib/appointmentPlan.js`.
- Reglas de `slotLocks/.../$slot`: cualquiera puede **crear** una celda libre; el admin solo puede **borrar**. Nadie puede pisar una celda ocupada.
- Cancelar: se borran las celdas del turno y se conserva `appointments/{id}` con `status: "cancelado"`.
- `history/{pushId}`: `{at, by, action, detail}` por cada movimiento hecho desde el admin.

## Fotos (`media`)
- `media/{id}`: string con la imagen comprimida (`data:image/webp;base64,...`, máx. ~300 KB). Lectura pública, escritura solo admin.
- `config.logo`, `config.heroImage`, `config.gallery[]`, `professionals/*.photo` y `.gallery[]` guardan `"m:{id}"` (o un link http normal).
- El navegador baja cada foto una vez y la guarda en localStorage. Las fotos reemplazadas quedan huérfanas en `media` (ocupan poco; se pueden borrar desde la consola de Firebase).

## Seña (monto fijo, manual)
**Datos de pago** — `payment`: `enabled`, `amount` (entero), `alias`, `holder`, `bank`, `updatedAt`.
- Lectura pública (la clienta necesita ver a dónde transferir). **Escritura: nadie desde el navegador** (`".write": false`).
- Lo escribe únicamente `api/payment.js` (servidor, clave de servicio). Para cambiarlo hace falta sesión de admin **y** volver a escribir la contraseña (con bloqueo por intentos); si todavía está la contraseña de fábrica, lo rechaza.
- Cada cambio queda en `auditLog/{id}` (`kind: "payment"`, hora del servidor, qué campo cambió: `from` → `to`). `auditLog`: lo lee el admin, **no lo escribe nadie desde el navegador**.

**Turno** — `appointments/{id}`: `depositAmount` (pesos), `depositStatus` (`pendiente` | `recibida` | `eximida`), `depositPaidAt`.
- Las reglas obligan a que una reserva de cliente traiga `depositStatus: "pendiente"` y el monto exacto de `payment/amount` (o el precio del servicio si es menor) cuando la seña está activa. Pasarla a `recibida`/`eximida` es solo del admin.
- `createdAt` tiene que ser la hora del servidor (`=== now`): de eso depende el plazo y nadie puede falsearlo.

**Línea de tiempo** (desde la reserva; el horario queda bloqueado todo el tiempo):
| Horas | Qué pasa |
|---|---|
| 0 – 24 | plazo normal para pagar |
| 24 – 72 | en rojo: "todavía no señó" (alerta en Resumen y contador en Turnos) |
| 72 | `api/sweep.js` lo cancela solo (estado `cancelado`, historial "Cancelación automática", horario liberado) |

El admin puede cancelar a mano en cualquier momento, marcar "Seña recibida" o "Eximir seña" (ambas lo confirman y ya no se cancela solo).
`api/sweep.js` corre al abrir la pantalla de reservas y el admin (como máximo 1 vez por minuto) y con un cron diario (`vercel.json`) como respaldo. Decide con su propio reloj y vuelve a verificar dentro de una transacción, así que es seguro dejarlo público.

**Reglas**: `database.rules.json` es el archivo completo de reglas de la base de Firebase de la estética (base propia, distinta de la de la barbería). Se pega entero en Realtime Database → Reglas.
Límite conocido: las reglas no pueden evitar que alguien arme reservas falsas a mano para ocupar horarios; ahora esas reservas se cancelan solas a las 72 hs si no hay seña.
