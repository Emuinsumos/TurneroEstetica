# Checklist de puesta en marcha

## Antes de salir a producción
- [ ] `npm install && npm run build && npm test` sin errores (en la PC).
- [ ] Reglas de `database.rules.json` publicadas en Firebase (Realtime Database → Reglas).
- [ ] Authentication habilitado en Firebase (Comenzar). No hace falta activar ningún proveedor.
- [ ] Variables en Vercel: las 6 `VITE_*` + `FIREBASE_SERVICE_ACCOUNT` (+ WhatsApp si se usa).
- [ ] **Cambiar el PIN**: variables `ADMIN_USER` y `ADMIN_PIN` en Vercel (el `1234` es temporal) y Redeploy.
- [ ] **Rotar la clave de la cuenta de servicio** si alguna vez se pegó en un chat: Google Cloud → IAM → Cuentas de servicio → Claves → borrar la vieja, crear una nueva y actualizar `FIREBASE_SERVICE_ACCOUNT`.
- [ ] Cargar en el admin: Negocio (nombre, WhatsApp, dirección), Servicios, Profesionales, Agenda.

## Prueba manual (5 minutos)
1. Entrar a `/reservar` desde el celular y reservar un turno → aparece en Admin → Turnos como *pendiente*.
2. Intentar reservar el mismo horario desde otro navegador → debe decir que se ocupó.
3. Admin: confirmar, modificar la hora, cancelar → el horario cancelado vuelve a verse libre en `/reservar`.
4. Admin: crear un turno manual; ver el historial del turno.
5. Bloquear un día en Agenda → no se puede reservar ese día.
6. `/admin` sin sesión pide usuario y PIN; 5 PIN incorrectos bloquean 15 min.
7. Una URL inexistente (ej. `/hola`) muestra "Página no encontrada".

## Límites conocidos
- Horarios, descansos, anticipación mínima y días máximos se validan en el navegador; las reglas de Firebase evitan dobles reservas pero no impiden una reserva armada a mano fuera de horario. Si hace falta, el siguiente paso es mover la reserva a una función del servidor.
- WhatsApp automático requiere cuenta de Meta y plantillas (ver `WHATSAPP.md`).
- Subida de fotos: por ahora se pegan URLs (hace falta Storage/Cloudinary para subir archivos).
