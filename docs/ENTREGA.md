# Alta de una barbería nueva (Firebase barberias-ad65c)

Un repo, un proyecto de Vercel por barbería. Cada una con su VITE_BUSINESS_ID.

1. Vercel: importar este repo como proyecto nuevo.
2. Variables: las de `.env.example` + VITE_BUSINESS_ID propio +
   FIREBASE_SERVICE_ACCOUNT (JSON de la clave del proyecto) + ADMIN_USER + ADMIN_PIN (de fábrica; el dueño la cambia desde el panel).
3. Datos iniciales: importar `docs/seed-barberia.json` en
   `turneroEstetica/businesses/{VITE_BUSINESS_ID}` (script de Termux).
4. Redeploy, entrar a /admin, cargar nombre, WhatsApp, logo/fotos, servicios, barberos y horarios.
5. Probar una reserva y confirmarla desde el admin.

Reglas: `database.rules.json` (ya aísla cada barbería por businessId).

## Entregar al cliente
- Pasale el link, el usuario y la contraseña de fábrica (`ADMIN_USER` / `ADMIN_PIN`).
- Pedile que entre a /admin → **Acceso** y los cambie. Desde ahí, las de Vercel dejan de valer.
- Si se olvida la contraseña: Firebase → Realtime Database → borrar
  `turneroEstetica/businesses/{id}/adminAuth/credentials`. Vuelven las de fábrica.
