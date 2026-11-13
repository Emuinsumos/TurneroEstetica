// firebase-admin simulado, en memoria. Solo lo que usan los endpoints de este proyecto.
const TS = "__SERVER_TIMESTAMP__";
export const state = { tree: {}, apps: [], counter: 0 };
export const reset = () => { state.tree = {}; state.counter = 0; };

const parts = (p) => String(p).split("/").filter(Boolean);
const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const resolveTs = (v) => (v === TS ? Date.now() : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveTs(x)])) : v);
const prune = (v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) { const p = prune(x); if (p !== null && p !== undefined) o[k] = p; }
    return Object.keys(o).length ? o : null;
  }
  return v === undefined ? null : v;
};
function getAt(ps) {
  let cur = state.tree;
  for (const k of ps) { if (cur === null || typeof cur !== "object") return null; cur = cur[k]; if (cur === undefined) return null; }
  return clone(cur);
}
function setAt(ps, val) {
  const v = prune(resolveTs(val));
  let cur = state.tree;
  for (let i = 0; i < ps.length - 1; i++) {
    if (cur[ps[i]] === null || typeof cur[ps[i]] !== "object") { if (v === null) return; cur[ps[i]] = {}; }
    cur = cur[ps[i]];
  }
  if (v === null) delete cur[ps[ps.length - 1]]; else cur[ps[ps.length - 1]] = v;
}
const snap = (v, key) => ({
  key, val: () => clone(v), exists: () => v !== null,
  forEach: (cb) => { for (const [k, x] of Object.entries(v || {})) cb({ key: k, val: () => clone(x) }); },
});

function ref(path = "") {
  const ps = parts(path);
  return {
    key: ps[ps.length - 1] || null,
    get: async () => snap(getAt(ps), ps[ps.length - 1]),
    set: async (v) => setAt(ps, v),
    remove: async () => setAt(ps, null),
    update: async (obj) => { for (const [k, v] of Object.entries(obj)) setAt([...ps, ...parts(k)], v); },
    push: () => ({ key: `k${String(++state.counter).padStart(6, "0")}` }),
    orderByChild: (c) => ({
      equalTo: (val) => ({
        get: async () => {
          const node = getAt(ps) || {};
          const hit = Object.fromEntries(Object.entries(node).filter(([, x]) => x && x[c] === val));
          return snap(hit, ps[ps.length - 1]);
        },
      }),
    }),
    // Imita a Firebase: la 1ª pasada puede llegar con null y se reintenta con el valor real.
    transaction: async (fn) => {
      const actual = getAt(ps);
      let res = fn(null);
      if (actual !== null && JSON.stringify(res) !== JSON.stringify(null)) res = fn(actual);
      else if (actual !== null) res = fn(actual);
      if (res === undefined) return { committed: false, snapshot: snap(actual) };
      setAt(ps, res);
      return { committed: true, snapshot: snap(getAt(ps)) };
    },
  };
}

const TOKENS = {
  "admin-token": { role: "admin", businessId: "b1" },
  "otro-negocio": { role: "admin", businessId: "zzz" },
  "cliente-token": { role: "client", businessId: "b1" },
};
function database() { return { ref }; }
database.ServerValue = { TIMESTAMP: TS };

const admin = {
  get apps() { return state.apps; },
  initializeApp: () => { state.apps.push(1); },
  credential: { cert: () => ({}) },
  auth: () => ({ verifyIdToken: async (t) => { if (TOKENS[t]) return TOKENS[t]; throw new Error("token inválido"); } }),
  database,
};
export default admin;
