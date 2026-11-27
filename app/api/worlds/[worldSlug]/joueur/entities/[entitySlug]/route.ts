import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getPlayerEntityDetail } from "@/src/server/services/playerEntityDetail";
import { listCampaigns } from "@/src/server/services/campaigns";
import { discoverEntity } from "@/src/server/services/discoveries";
import type { Locale } from "@/src/i18n/request";

/** Un slug de monde ou de fiche : minuscules, chiffres, tirets (règle 4 : un paramètre d'adresse est une entrée). */
const zParams = z.object({
  worldSlug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  entitySlug: z.string().regex(/^[a-z0-9-]{1,200}$/),
});

/**
 * ADR 0120 (V3.2-57) — Une fiche du wiki, en vue joueur, pour le volet de
 * consultation de l'écran de jeu : la même lecture que la page
 * `/joueur/wiki/[entitySlug]` (`getPlayerEntityDetail`, visibilité résolue
 * côté serveur pour CE compte, règle 5), rendue côté client par le même corps
 * de fiche (`PublicEntityBody`). Lue au clic seulement, jamais au rendu de la
 * page solo (docs/CABLAGE.md, C1 ; docs/QUOTAS.md : une fiche ouverte = les
 * lectures d'une page du wiki, ni plus ni moins).
 *
 * Comme la page, ouvrir la fiche entière l'enregistre comme découverte au
 * niveau « detailed » (V3-C4), sans jamais bloquer l'affichage.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string; entitySlug: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const { worldSlug, entitySlug } = parsed.data;

  const supabase = await createClient();
  const [world, user] = await Promise.all([getWorldBySlug(supabase, worldSlug), getAuthUser(supabase)]);
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  // La RLS de `worlds` ne rend le monde qu'à ses membres : un monde étranger et un monde absent répondent pareil.
  if (!world) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });

  const detail = await getPlayerEntityDetail(supabase, { worldId: world.id, worldSlug, entitySlug, userId: user.id, locale: (await getLocale()) as Locale });
  if (!detail) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });

  const campaigns = await listCampaigns(supabase, world.id);
  if (campaigns[0]) {
    try {
      await discoverEntity(supabase, { campaignId: campaigns[0].id, userId: user.id, entityId: detail.entity.id, level: "detailed" });
    } catch (erreur) {
      console.error("Découverte de la fiche non enregistrée", erreur);
    }
  }

  // Le fond du wiki ne sert pas dans le volet : on ne l'envoie pas.
  return NextResponse.json({ entity: detail.entity, blocks: detail.blocks, relations: detail.relations, portraitLayout: detail.portraitLayout, npcView: detail.npcView }, { status: 200 });
}
