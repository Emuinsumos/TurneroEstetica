# Turnero

Sistema de turnos (React + Vite + Firebase Realtime Database).

## Correr en la PC
```
npm install
cp .env.example .env
npm run dev
```

## Deploy en Vercel
1. Subí el proyecto a GitHub (sin `node_modules` ni `.env`; el `.gitignore` ya los excluye).
2. vercel.com/new → importar el repo (detecta Vite solo).
3. Environment Variables: las 6 que están en `.env.example`.
4. Deploy.

## Admin (Etapa 6)
Ruta `/admin`. El PIN se verifica en `api/admin-login.js` (servidor), no en el navegador.
Credenciales de fábrica TEMPORALES: usuario `admin`, contraseña `1234` (o las de las variables `ADMIN_USER` y `ADMIN_PIN` en Vercel).
El dueño las cambia desde el panel: pestaña **Acceso**. Se guarda solo el hash (scrypt) en `adminAuth/credentials`, que ningún cliente puede leer.
Si el dueño olvida la contraseña: en Firebase, borrá el nodo `.../businesses/{id}/adminAuth/credentials` y vuelven las de fábrica.
Variable obligatoria en Vercel: `FIREBASE_SERVICE_ACCOUNT` (contenido completo del .json de la cuenta de servicio, en una sola línea).
Nunca subas ese .json a GitHub. Bloqueo: 5 intentos fallidos = 15 min.
El login solo anda desplegado en Vercel (o con `vercel dev`), no con `npm run dev`.

## Datos en Firebase
Todo vive bajo `/turneroEstetica/businesses/{businessId}/`.
Reglas en `database.rules.json` (ya publicadas, fusionadas con el otro proyecto).

## Campos opcionales de `config` (se ven en la página si existen)
`logo`, `heroImage`, `gallery` (lista de URLs), `instagram`, `facebook`, `tiktok`,
`mapsUrl`, `address`, `whatsapp` (con código de país, ej. 5491122334455), `cancelPolicy`, `accentColor`.
Los profesionales aceptan `photo`.
Las fotos se suben desde el celular en el admin (Negocio y Profesionales): se achican y comprimen solas y se guardan en `media/{id}`; en los datos queda `m:{id}`. Los links de imagen viejos siguen funcionando.

## Reservas (Etapa 4)
Ruta `/reservar`: servicio → profesional (con carrusel de trabajos) → día → hora → datos → confirmación.
La base evita reservas dobles con una escritura atómica (ver `docs/DATABASE.md`).
Pestaña **Turnos** del admin: vistas día/semana/mes/todos, filtros (profesional, servicio, estado),
crear turno manual, modificar (fecha, hora, profesional, servicio, datos, precio), cambiar estado
(pendiente/confirmado/completado/ausente), cancelar (libera el horario y conserva el registro) e historial de cambios.
Tras crear/modificar/confirmar/cancelar se ofrece avisar al cliente por WhatsApp (link, no automático).
**Resumen**: turnos de hoy, pendientes, confirmados, cancelados, ocupación y próximos por profesional.
⚠️ Hay que **volver a publicar `database.rules.json`** en Firebase (el admin ya no puede pisar horarios ocupados, solo liberarlos).
Para que cada servicio lo haga cada profesional, editá el servicio y tildá quién lo realiza
(si no tildás a nadie, lo pueden hacer todos).

## Etapas
1 ✅ base · 2 ✅ reglas · 3 ✅ página pública · 4 ✅ reservas · 5 ✅ WhatsApp automático (ver `docs/WHATSAPP.md`) · 6 ✅ admin · 7 ✅ (servicios, equipo, agenda, negocio, gestión de turnos) · 8 ✅ pruebas (`npm test`) y pulido · ver `docs/CHECKLIST.md` antes de producción

## Manual de usuario

Guía completa para el dueño del negocio: `docs/MANUAL.md` (versión para imprimir o enviar: `docs/MANUAL.pdf`).
