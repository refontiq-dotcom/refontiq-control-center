import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Comparaison de secrets à temps constant, quelle que soit la longueur :
 * les deux valeurs sont d'abord hachées, ce qui donne deux empreintes de même taille.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer <jeton>`. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? "");
  return match ? match[1].trim() : null;
}
