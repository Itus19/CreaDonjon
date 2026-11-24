import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setTableNameSchema } from "@/lib/entities/schemas";
import { setTableName } from "@/src/server/services/nomPourLaTable";

/**
 * AG-12 (ADR 0105) — remplir, changer ou vider le « Nom pour la table »
 * d'une fiche. MJ du monde seulement (vérifié par le service, et par la RLS
 * d'`entity_true_names`).
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Fiche invalide." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = setTableNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const result = await setTableName(supabase, { entityId: id, userId: user.id, expectedVersion: parsed.data.version, tableName: parsed.data.tableName });
  if (!result.ok) {
    const statut = { not_found: 404, forbidden: 403, conflict: 409 }[result.reason];
    const message = {
      not_found: "Fiche introuvable.",
      forbidden: "Réservé au MJ.",
      conflict: "Cette fiche a été modifiée entre-temps. Rechargez avant de réessayer.",
    }[result.reason];
    return NextResponse.json({ error: message }, { status: statut });
  }
  return NextResponse.json(result, { status: 200 });
}
