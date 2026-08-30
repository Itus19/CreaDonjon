import { randomBytes, createHash } from "node:crypto";

/**
 * Jeton d'invitation (V2-M4, Lot M) — meme forme que `src/core/shareLinks/token.ts`
 * (32 octets aleatoires, SHA-256 hexadecimal), mais un module a part : ce
 * jeton-ci EST la seule preuve d'identite de la personne invitee (pas
 * seulement une cle de lecture), donc jamais conserve en clair nulle part,
 * contrairement a `share_links.token` (V2, choix explicite). Duplication
 * assumee plutot qu'un module partage premature (regle des trois, CLAUDE.md).
 */

/** 32 octets aleatoires encodes en base64url : assez d'entropie pour ne jamais etre devine, court dans une URL. */
export function generateCampaignInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hexadecimal — meme fonction cote creation (avant insertion) et cote resolution (`app.resolve_campaign_invite`, meme algorithme cote SQL). */
export function hashCampaignInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
