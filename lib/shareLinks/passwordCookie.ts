import "server-only";
import { cookies } from "next/headers";
import { hashShareToken } from "@/src/core/shareLinks/token";
import { signPasswordProof, verifyPasswordProof } from "@/src/core/shareLinks/access";

/**
 * Cookie de vérification du mot de passe d'un lien de partage (V1-C4,
 * V3.1-142). Module serveur ordinaire, JAMAIS un fichier `"use server"` :
 * une fonction exportée d'un tel fichier devient une action que n'importe
 * quel navigateur peut appeler, avec les arguments qu'il veut.
 *
 * Nom dérivé du jeton (jamais le jeton lui-même), cookie limité au chemin du
 * lien (`/partage/<token>`) : un cookie posé pour un lien ne dit rien d'un
 * autre. Sa VALEUR est une preuve signée (`src/core/shareLinks/access.ts`) :
 * le nom se devine, la valeur non.
 */
const DUREE_MS = 6 * 60 * 60 * 1000;

function cookieName(token: string): string {
  return `sv_${hashShareToken(token).slice(0, 16)}`;
}

/** Pose la preuve, après un mot de passe vérifié par le serveur. */
export async function setVerifiedSharePassword(token: string, passwordHash: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(token), signPasswordProof(passwordHash, token, Date.now() + DUREE_MS), {
    path: `/partage/${token}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DUREE_MS / 1000,
  });
}

/** Le visiteur a-t-il donné le mot de passe de CE lien, tel qu'il est AUJOURD'HUI ? */
export async function hasVerifiedSharePassword(token: string, passwordHash: string): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyPasswordProof(cookieStore.get(cookieName(token))?.value, passwordHash, token, Date.now());
}
