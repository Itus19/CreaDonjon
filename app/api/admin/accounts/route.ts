import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAccountsForAdmin } from "@/src/server/services/adminAccounts";

/**
 * Tous les comptes de la plateforme (V3.1-10, panneau superadmin) — jamais
 * `handle_tag` (critère du ticket). `null` distingue "pas superadmin" de
 * "liste vide", jamais confondus.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const accounts = await listAccountsForAdmin(supabase, user.id);
  if (accounts === null) {
    return NextResponse.json({ error: "Réservé au superadmin." }, { status: 403 });
  }
  return NextResponse.json({ accounts }, { status: 200 });
}
