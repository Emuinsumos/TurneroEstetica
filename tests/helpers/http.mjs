export function call(handler, { method = "POST", token, body, ip = "9.9.9.9" } = {}) {
  const req = { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "x-forwarded-for": ip }, body };
  const res = {
    code: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(o) { this.body = o; return this; },
  };
  return Promise.resolve(handler(req, res)).then(() => res);
}
