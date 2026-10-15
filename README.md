# Turnero Estética

Sistema de turnos para centro de estética (lifting de pestañas, depilación, uñas, etc.).
Misma estructura que el turnero de barbería (React + Vite + Firebase Realtime Database + WhatsApp + panel admin).

## Aislamiento de datos
- Comparte el proyecto de Firebase, pero TODO vive bajo `/turneroEstetica/businesses/{businessId}/`.
- La barbería vive en `/turneroProfesionales/` y otros proyectos en sus propias carpetas: no se mezclan.
- El admin de la estética lleva en su token `root: "turneroEstetica"`; las reglas impiden que toque otra carpeta (y el de la barbería no puede tocar esta).
- `database.rules.json` es UN solo archivo con las dos zonas. Publicalo en Firebase (reemplaza al anterior).

## Puesta en marcha
1. Subir a un repo NUEVO de GitHub y crear un proyecto NUEVO en Vercel.
2. Variables de Vercel: las 6 `VITE_*` (mismas del proyecto de Firebase, con `VITE_BUSINESS_ID=estetica-demo`), `FIREBASE_SERVICE_ACCOUNT`, y para cambiar el acceso `ADMIN_USER` / `ADMIN_PIN` (por defecto admin / 1234).
3. Publicar `database.rules.json` en Firebase → Realtime Database → Reglas.
4. Cargar datos de ejemplo (opcional): ver `docs/seed-estetica.json` (se importa en Firebase en el nodo `turneroEstetica/businesses/estetica-demo`).
5. Entrar a `/admin` y editar Negocio, Servicios, Profesionales y Agenda.

Novedades vs. barbería: tema claro rosado, servicios agrupados por **categoría** (Uñas, Depilación…), selección de varios servicios en un mismo turno activada por defecto.

Más detalles: `docs/` (DATABASE.md, WHATSAPP.md, CHECKLIST.md). Tests: `npm test`.
