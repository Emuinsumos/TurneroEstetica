const FAKE = new URL("./fake-admin.mjs", import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier === "firebase-admin") return { url: FAKE, shortCircuit: true };
  return next(specifier, context);
}
