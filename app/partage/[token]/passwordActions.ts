"use server";

import { setVerifiedSharePassword } from "@/lib/shareLinks/passwordCookie";
import { resolveShareLink, verifyShareLinkPassword } from "@/src/server/services/publicShare";

export type VerifySharePasswordState = { error: string } | { ok: true } | null;

export async function verifySharePasswordAction(
  token: string,
  _prevState: VerifySharePasswordState,
  formData: FormData,
): Promise<VerifySharePasswordState> {
  const password = String(formData.get("password") ?? "");
  const result = await verifyShareLinkPassword(token, password);

  if (result === "ok") {
    // V3.1-142 : la preuve est signée par le hash du mot de passe, que seul le serveur connaît.
    const resolved = await resolveShareLink(token);
    if (!resolved?.passwordHash) return { error: "Ce lien n'existe plus." };
    await setVerifiedSharePassword(token, resolved.passwordHash);
    return { ok: true };
  }

  if (result === "locked") {
    return { error: "Trop de tentatives. Ce lien ne peut plus être déverrouillé par mot de passe." };
  }
  return { error: "Mot de passe incorrect." };
}
