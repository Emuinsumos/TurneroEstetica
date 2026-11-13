import { auth } from "../../config/firebase";

// Llamada a un endpoint de admin con el token de la sesión.
export async function adminCall(url, method, body) {
  const t = await auth.currentUser?.getIdToken();
  if (!t) throw new Error("Tu sesión venció. Salí y volvé a ingresar.");
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sin conexión con el servidor. Revisá tu internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar");
  return data;
}
