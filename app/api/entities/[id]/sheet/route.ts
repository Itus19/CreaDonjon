import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrInitializeRuntimeState, resolveCharacterActionContext } from "@/src/server/services/characterActions";
import type { Locale } from "@/src/i18n/request";
import { entityCampaignQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";

/**
 * Fiche derivee + etat de jeu d'une entite (V1-B5) : les blocs
 * character/inventory/spellcasting/resources arrivent deja au client via
 * `EntityBlocks` (meme mecanisme generique que le reste du wiki) — cette
 * route ne renvoie que ce qui exige le serveur : la fiche calculee et
 * l'etat de jeu (initialise au besoin). Les donnees d'arme resolues
 * (`ctx.weaponByKey`) ne sont plus renvoyees ici depuis V1-C10 : elles ne
 * se rafraichissaient qu'apres une action de jeu (attaque, repos...),
 * jamais apres un changement d'inventaire seul — l'onglet Actions les lit
 * desormais via `useResolvedRuleset` (meme source deja reactive que
 * l'armure/le poids), `ctx.weaponByKey` restant interne a la resolution
 * des actions elles-memes (attaque/degats).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  // `?campaignId=` (valeur vide) vaut "pas de campagne" : le client l'envoie
  // ainsi (`campaignId ?? ""` dans l'URL). Sans cette normalisation, ""
  // descendrait jusqu'a `putRuntimeState` qui l'insere tel quel dans une
  // colonne uuid et echoue. Le schema la porte desormais (`zOptionalGuid`),
  // pour les deux routes qui en ont besoin.
  const parsedQuery = entityCampaignQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }
  const campaignId = parsedQuery.data.campaignId ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const locale = (await getLocale()) as Locale;
  const ctx = await resolveCharacterActionContext(supabase, entityId, campaignId, locale);
  if (!ctx) {
    return NextResponse.json({ error: "Fiche de personnage introuvable ou sans ruleset resolvable." }, { status: 404 });
  }

  const runtimeState = await getOrInitializeRuntimeState(supabase, ctx);

  return NextResponse.json(
    { sheet: ctx.sheet, hitDiceTotals: ctx.hitDiceTotals, runtimeState },
    { status: 200 }
  );
}
