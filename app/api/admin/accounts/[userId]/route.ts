import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminDeleteAccount } from "@/src/server/services/adminAccounts";

/**
 * Supprime n'importe quel compte de la plateforme (V3.1-10, ADR 0031) —
 * généralise l'ancien `deleteInvitedAccount`, dont le garde-fou ("jamais un
 * compte créé à la main") ne tenait plus une fois les comptes "tag"
 * libre-service possibles. La vérification superadmin vit dans le service
 * (`adminAccounts.ts`), pas ici.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await adminDeleteAccount(supabase, { callerId: user.id, targetUserId });
  if (!result.ok) {
    const messages = { not_authorized: "Réservé au superadmin.", not_found: "Compte introuvable." };
    const status = result.reason === "not_authorized" ? 403 : 404;
    return NextResponse.json({ error: messages[result.reason] }, { status });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
