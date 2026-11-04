import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { listUnplayableRules } from "@/src/server/services/rulePlayableBlocks";
import ReglesNonJouables from "@/components/rules/ReglesNonJouables";
import type { Locale } from "@/src/i18n/request";

/**
 * V3.1-132 — la vue « règles non jouables » du ruleset actif : aptitudes, sorts
 * et objets magiques non évalués ou partiels, pour décider quoi rendre jouable
 * ensuite. Réservée au MJ : le droit est vérifié ICI, côté serveur (SECURITE.md §2) ;
 * tout autre compte reçoit la même page introuvable. Lue à la demande seulement,
 * jamais au chargement de l'onglet Règles (docs/QUOTAS.md).
 */
export default async function ReglesNonJouablesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();
  if (!(await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }))) notFound();

  const regles = await listUnplayableRules(supabase, { worldId: world.id, locale: (await getLocale()) as Locale });
  return <ReglesNonJouables worldSlug={worldSlug} regles={regles ?? []} />;
}
