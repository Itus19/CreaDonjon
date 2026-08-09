"use server";

import { cookies } from "next/headers";
import { hashShareToken } from "@/src/core/shareLinks/token";
import { verifyShareLinkPassword } from "@/src/server/services/publicShare";

/**
 * Cookie de verification du mot de passe d'un lien de partage (V1-C4).
 * Nom derive du jeton (jamais le jeton lui-meme en clair dans le nom, par
 * precaution) et porte scope' au chemin de ce lien precis
 * (`/partage/<token>`) : un cookie pose pour un lien ne dit jamais rien sur
 * un autre. `httpOnly` : jamais lisible ni falsifiable depuis un script
 * cote client.
 */
function cookieName(token: string): string {
  return `sv_${hashShareToken(token).slice(0, 16)}`;
}

export type VerifySharePasswordState = { error: string } | { ok: true } | null;

export async function verifySharePasswordAction(
  token: string,
  _prevState: VerifySharePasswordState,
  formData: FormData,
): Promise<VerifySharePasswordState> {
  const password = String(formData.get("password") ?? "");
  const result = await verifyShareLinkPassword(token, password);

  if (result === "ok") {
    const cookieStore = await cookies();
    cookieStore.set(cookieName(token), "1", {
      path: `/partage/${token}`,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 6,
    });
    return { ok: true };
  }

  if (result === "locked") {
    return { error: "Trop de tentatives. Ce lien ne peut plus être déverrouillé par mot de passe." };
  }
  return { error: "Mot de passe incorrect." };
}

export async function hasVerifiedSharePassword(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName(token))?.value === "1";
}
