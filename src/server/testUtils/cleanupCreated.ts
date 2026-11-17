import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * V3.1-145 — le nettoyage d'un fichier d'intégration ne supprime QUE ce
 * qu'il a créé. Les comptes de test sont partagés (docs/TESTS.md : jamais de
 * compte neuf) : supprimer « tous les mondes du compte » emporterait ceux
 * d'une autre exécution en cours (une autre session, un test lancé seul
 * pendant la suite complète).
 *
 * - Les mondes, par identifiant ; leurs fiches, campagnes et blocs partent en
 *   cascade.
 * - Les rulesets, par lignée : une variante éditée se reforge en nouvelles
 *   versions qui gardent son `lineage_id` (règle 17) ; on les supprime toutes,
 *   en une instruction, après les mondes qui les désignent.
 * - Les journaux d'IA d'un compte, seulement depuis le début du fichier.
 */
export async function cleanupCreated(
  admin: SupabaseClient,
  created: { worldIds?: readonly (string | undefined)[]; rulesetIds?: readonly (string | undefined)[]; aiLogs?: { userId: string; since: string } },
): Promise<void> {
  const mondes = (created.worldIds ?? []).filter((x): x is string => Boolean(x));
  if (mondes.length > 0) {
    const { error } = await admin.from("worlds").delete().in("id", mondes);
    if (error) throw new Error(`nettoyage des mondes : ${error.message}`);
  }
  const rulesets = (created.rulesetIds ?? []).filter((x): x is string => Boolean(x));
  if (rulesets.length > 0) {
    const { data, error } = await admin.from("rulesets").select("lineage_id").in("id", rulesets).eq("is_official_base", false);
    if (error) throw new Error(`nettoyage des rulesets : ${error.message}`);
    const lignees = [...new Set((data ?? []).map((r: { lineage_id: string }) => r.lineage_id))];
    if (lignees.length > 0) {
      const { error: e2 } = await admin.from("rulesets").delete().in("lineage_id", lignees).eq("is_official_base", false);
      if (e2) throw new Error(`nettoyage des rulesets : ${e2.message}`);
    }
  }
  if (created.aiLogs) {
    const { error } = await admin.from("ai_usage_log").delete().eq("user_id", created.aiLogs.userId).gte("created_at", created.aiLogs.since);
    if (error) throw new Error(`nettoyage des journaux d'IA : ${error.message}`);
  }
}
