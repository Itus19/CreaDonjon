"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hashCampaignInviteToken } from "@/src/core/campaignInvites/token";
import { verifyInvitePassword } from "@/src/server/services/campaignInvites";

/**
 * Cookie de vérification du mot de passe d'un lien d'invitation (V2-M4
 * suite, retour utilisateur 30 août) — même mécanisme que
 * `app/partage/[token]/passwordActions.ts` : nom dérivé du jeton (jamais
 * le jeton lui-même dans le nom), scopé au chemin de CE lien précis,
 * `httpOnly` (jamais lisible ni falsifiable depuis un script client).
 */
function cookieName(token: string): string {
  return `iv_${hashCampaignInviteToken(token).slice(0, 16)}`;
}

export type VerifyInvitePasswordState = { error: string } | { ok: true } | null;

export async function verifyInvitePasswordAction(
  token: string,
  _prevState: VerifyInvitePasswordState,
  formData: FormData
): Promise<VerifyInvitePasswordState> {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const result = await verifyInvitePassword(supabase, token, password);

  if (result === "ok") {
    const cookieStore = await cookies();
    cookieStore.set(cookieName(token), "1", {
      path: `/rejoindre/${token}`,
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

export async function hasVerifiedInvitePassword(token: string): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName(token))?.value === "1";
}
