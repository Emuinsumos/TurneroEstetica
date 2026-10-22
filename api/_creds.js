// Lógica pura de credenciales (sin Firebase): se puede probar con node.
// El archivo empieza con "_" para que Vercel NO lo publique como endpoint.
import crypto from "node:crypto";

export const DEFAULT_USER = "admin";
export const DEFAULT_PIN = "1234";

const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();
export const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
export const normUser = (u) => String(u ?? "").trim().toLowerCase();

export function hashPin(pin, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(pin), salt, 32).toString("hex");
  return { salt, hash };
}

export function verifyPin(pin, { salt, hash }) {
  const a = Buffer.from(crypto.scryptSync(String(pin), salt, 32));
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// creds: lo guardado en la base ({user, salt, hash}) o null → usa las de entorno/por defecto
export function checkLogin(user, pin, creds, env = {}) {
  if (creds && creds.salt && creds.hash) {
    return same(normUser(user), normUser(creds.user)) && verifyPin(pin, creds);
  }
  const okUser = same(normUser(user), normUser(env.ADMIN_USER || DEFAULT_USER));
  const okPin = same(pin, env.ADMIN_PIN || DEFAULT_PIN);
  return okUser && okPin;
}

const WEAK = new Set(["123456", "1234567", "12345678", "000000", "111111", "password", "contraseña", "qwerty", "abc123"]);

// Devuelve un texto de error o "" si está bien
export function validateNewCreds(user, pin) {
  const u = String(user ?? "").trim();
  const p = String(pin ?? "");
  if (u.length < 3 || u.length > 30) return "El usuario debe tener entre 3 y 30 caracteres";
  if (!/^[a-zA-Z0-9._@-]+$/.test(u)) return "El usuario solo puede tener letras, números y . _ @ -";
  if (p.length < 6 || p.length > 60) return "La contraseña debe tener al menos 6 caracteres";
  if (WEAK.has(p.toLowerCase())) return "Esa contraseña es muy fácil de adivinar. Elegí otra";
  if (normUser(u) === p.toLowerCase()) return "La contraseña no puede ser igual al usuario";
  return "";
}
