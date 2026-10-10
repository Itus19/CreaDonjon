import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkSheetActionAccess } from "@/src/server/services/sheetActionAccess";
import type { CampaignTableSettings, PlayerEditableField } from "@/src/core/campaigns/tableSettings";

/**
 * V3.1-108 (ADR 0043) — la porte commune des routes
 * `/api/entities/[id]/actions/**` qui n'en avaient aucune : adresse et corps
 * valides (Zod, regle absolue 4), appelant connecte, droit d'editer la
 * fiche, campagne du meme monde, et interrupteur de table pour un geste
 * manuel sur un champ regle (`field`). Une route n'ecrit sa logique
 * qu'apres `ok: true` ; sinon elle renvoie `response`.
 */
const zSheetRouteParams = z.object({ id: z.string().uuid() });

type Guarded<T> =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      entityId: string;
      body: T;
      settings: CampaignTableSettings;
    }
  | { ok: false; response: NextResponse };

export async function guardSheetActionRoute<T extends { campaignId: string | null }>(
  request: NextRequest,
  rawParams: Promise<{ id: string }>,
  bodySchema: z.ZodType<T>,
  field?: PlayerEditableField
): Promise<Guarded<T>> {
  const parsedParams = zSheetRouteParams.safeParse(await rawParams);
  if (!parsedParams.success) {
    return { ok: false, response: NextResponse.json({ error: "Adresse invalide." }, { status: 400 }) };
  }
  const body: unknown = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return { ok: false, response: NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  }

  const entityId = parsedParams.data.id;
  const { access, settings } = await checkSheetActionAccess(supabase, {
    userId: user.id,
    entityId,
    campaignId: parsedBody.data.campaignId,
    field,
  });
  if (access === "forbidden") {
    return { ok: false, response: NextResponse.json({ error: "Vous n'avez pas le droit d'agir sur cette fiche." }, { status: 403 }) };
  }
  if (access === "switch_off") {
    return { ok: false, response: NextResponse.json({ error: "Le MJ s'est réservé ce geste pour cette campagne." }, { status: 403 }) };
  }
  if (access === "not_found") {
    return { ok: false, response: NextResponse.json({ error: "Fiche ou campagne introuvable." }, { status: 404 }) };
  }
  return { ok: true, supabase, userId: user.id, entityId, body: parsedBody.data, settings };
}
