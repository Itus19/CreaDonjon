"use server";

import { createClient } from "@/lib/supabase/server";
import { setVerifiedInvitePassword } from "@/lib/campaignInvites/passwordCookie";
import { verifyInvitePassword } from "@/src/server/services/campaignInvites";

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
    // V3.1-142 : la preuve est signée par le hash du mot de passe, que seul le serveur connaît.
    if (!(await setVerifiedInvitePassword(token))) return { error: "Ce lien n'existe plus." };
    return { ok: true };
  }

  if (result === "locked") {
    return { error: "Trop de tentatives. Ce lien ne peut plus être déverrouillé par mot de passe." };
  }
  return { error: "Mot de passe incorrect." };
}
