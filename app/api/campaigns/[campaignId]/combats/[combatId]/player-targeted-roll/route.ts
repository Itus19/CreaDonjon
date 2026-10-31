import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { playerTargetedRollSchema } from "@/lib/combats/schemas";
import { TARGETED_ROLL_MESSAGES } from "@/lib/combats/targetedRollMessages";
import { checkSheetActionAccess } from "@/src/server/services/sheetActionAccess";
import { resolveTargetedRoll } from "@/src/server/services/targetedRoll";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), combatId: z.string().uuid() });

/**
 * V3.1-107 (ADR 0069) — « Cibler » pour un joueur, avec son PJ. Le moteur lit
 * la cible par une lecture signée et écrit ce qui n'est pas au joueur par un
 * changement signé (ADR 0041) ; la réponse ne porte ni la CA ni les PV d'un
 * adversaire. Il faut pouvoir modifier la fiche de l'acteur, dans cette
 * campagne (porte des actions de fiche).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const adresse = zParams.safeParse(await params);
  if (!adresse.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsed = playerTargetedRollSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { access } = await checkSheetActionAccess(supabase, { userId: user.id, entityId: parsed.data.actor.entityId, campaignId: adresse.data.campaignId });
  if (access === "not_found") return NextResponse.json({ error: "Fiche ou campagne introuvable." }, { status: 404 });
  if (access !== "ok") return NextResponse.json({ error: "Vous n'avez pas le droit d'agir avec cette fiche." }, { status: 403 });

  try {
    const result = await resolveTargetedRoll(supabase, {
      campaignId: adresse.data.campaignId,
      combatId: adresse.data.combatId,
      callerId: user.id,
      locale: (await getLocale()) as Locale,
      input: { ...parsed.data, critical: false, secret: false },
      callerIsGm: false,
    });
    if (!result.ok) {
      const { status, error } = TARGETED_ROLL_MESSAGES[result.reason];
      return NextResponse.json({ error, ...(result.detail ? { detail: result.detail } : {}) }, { status });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (erreur) {
    // Clé du moteur absente, ou lecture / écriture signée refusée par la base : jamais muet.
    console.error("Jet ciblé d'un joueur en échec", erreur);
    return NextResponse.json({ error: "Le moteur n'a pas pu résoudre ce jet. Prévenez le MJ." }, { status: 503 });
  }
}
