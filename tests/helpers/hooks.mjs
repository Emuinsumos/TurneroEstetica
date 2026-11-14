const FAKE = new URL("./fake-admin.mjs", import.meta.url).href;
const FAKE_WEBPUSH = new URL("./fake-webpush.mjs", import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier === "firebase-admin") return { url: FAKE, shortCircuit: true };
  if (specifier === "web-push") return { url: FAKE_WEBPUSH, shortCircuit: true };
  return next(specifier, context);
}
