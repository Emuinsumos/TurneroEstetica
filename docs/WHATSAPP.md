# WhatsApp automático (Etapa 5)

Usa la **WhatsApp Cloud API de Meta**. Si no está configurada, todo sigue andando con los links manuales (wa.me).

## Qué se envía solo
- Cliente reserva en la web → mensaje "turno registrado" al cliente + aviso al dueño.
- Admin crea / confirma / modifica / cancela un turno → mensaje al cliente.
Si el envío falla, el panel muestra el botón manual de WhatsApp.

## Variables en Vercel (Settings → Environment Variables)
| Nombre | Valor |
|---|---|
| WHATSAPP_TOKEN | token permanente de la app de Meta |
| WHATSAPP_PHONE_ID | "Identificador del número de teléfono" (no es el número) |
| OWNER_WHATSAPP | (opcional) número del dueño; si no, usa el WhatsApp de la pestaña Negocio |
| WA_TEMPLATE_CREADO / _CONFIRMADO / _MODIFICADO / _CANCELADO / _DUENO | (opcional) nombre de plantilla aprobada |
| WA_TEMPLATE_LANG | (opcional) idioma de las plantillas, por defecto `es_AR` |
Después de cargarlas: Deployments → Redeploy.

## Alta en Meta (una sola vez)
1. developers.facebook.com → Crear app → tipo "Negocios" → agregar producto **WhatsApp**.
2. WhatsApp → Configuración de la API: ahí está el *Phone number ID* y un número de prueba.
3. Para producción: agregar y verificar el número real del negocio, y crear un **usuario del sistema** en Business Settings con token permanente (permiso `whatsapp_business_messaging`).
4. Con el número de prueba solo se puede escribir a números agregados como destinatarios de prueba.

## Importante: ventana de 24 h
WhatsApp solo deja mandar **texto libre** a quien te escribió en las últimas 24 h. Para avisar a clientes
que nunca te escribieron hay que usar **plantillas aprobadas** por Meta. Cada plantilla lleva 5 variables, en este orden:
`{{1}}` nombre, `{{2}}` servicio, `{{3}}` profesional, `{{4}}` fecha, `{{5}}` hora.
Ejemplo (CONFIRMADO): "Hola {{1}}, tu turno de {{2}} con {{3}} el {{4}} a las {{5}} está confirmado."
Creala en WhatsApp Manager → Plantillas (categoría Utilidad), y poné su nombre en `WA_TEMPLATE_CONFIRMADO`.
Sin plantilla configurada se manda texto libre (puede fallar fuera de la ventana de 24 h).

## Seguridad
- `/api/notify` arma el texto en el servidor a partir del turno guardado: no se pueden mandar mensajes arbitrarios.
- Aviso "nuevo" (público): solo turnos pendientes de los últimos 10 min y una única vez por turno.
- Avisos de admin: exigen el token de sesión de admin.
- Los envíos quedan registrados en `notifLog/{idTurno}` (solo lectura del servidor).
