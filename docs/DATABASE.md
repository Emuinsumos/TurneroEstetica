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
