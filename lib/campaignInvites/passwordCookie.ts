import "server-only";
import { cookies } from "next/headers";
import { hashCampaignInviteToken } from "@/src/core/campaignInvites/token";
import { signPasswordProof, verifyPasswordProof } from "@/src/core/shareLinks/access";
import { readInvitePasswordHash } from "@/src/server/services/accountProvisioning";

/**
 * Cookie de vérification du mot de passe d'un lien d'invitation (V2-M4
 * suite, V3.1-142). Même mécanisme que `lib/shareLinks/passwordCookie.ts` :
 * module serveur ordinaire (jamais `"use server"`), nom dérivé du jeton,
 * cookie limité au chemin du lien, et une VALEUR signée par le hash du mot
 * de passe de l'invitation, que seul le serveur lit (migration
 * 20261013150000). Avant, elle valait « 1 » : n'importe qui ayant le
 * lien pouvait la poser et rejoindre la campagne sans le mot de passe.
 */
const DUREE_MS = 6 * 60 * 60 * 1000;

function cookieName(token: string): string {
  return `iv_${hashCampaignInviteToken(token).slice(0, 16)}`;
}

/** Pose la preuve, après un mot de passe vérifié par le serveur. `false` si l'invitation n'a plus de mot de passe (ou n'existe plus). */
export async function setVerifiedInvitePassword(token: string): Promise<boolean> {
  const passwordHash = await readInvitePasswordHash(token);
  if (!passwordHash) return false;
  const cookieStore = await cookies();
  cookieStore.set(cookieName(token), signPasswordProof(passwordHash, token, Date.now() + DUREE_MS), {
    path: `/rejoindre/${token}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DUREE_MS / 1000,
  });
  return true;
}

/** Le visiteur a-t-il donné le mot de passe de CETTE invitation, tel qu'il est AUJOURD'HUI ? */
export async function hasVerifiedInvitePassword(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName(token))?.value;
  if (!value) return false;
  const passwordHash = await readInvitePasswordHash(token);
  return passwordHash !== null && verifyPasswordProof(value, passwordHash, token, Date.now());
}
