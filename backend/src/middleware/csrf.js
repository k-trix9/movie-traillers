import { randomBytes, timingSafeEqual } from "node:crypto";

export function issueCsrfToken(req, res) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  res.json({ csrfToken: req.session.csrfToken });
}

export function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const expected = req.session?.csrfToken;
  const supplied = req.get("x-csrf-token");
  if (!expected || !supplied) {
    return res.status(403).json({ error: { message: "CSRF token is missing." } });
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ error: { message: "CSRF token is invalid." } });
  }

  next();
}
