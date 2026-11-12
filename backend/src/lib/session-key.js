import { createHash } from "node:crypto";

export function sessionFingerprint(sessionId) {
  return createHash("sha256").update(String(sessionId)).digest("hex");
}
