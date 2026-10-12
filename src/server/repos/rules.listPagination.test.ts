import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listRulesetEntries } from "./rules";

/**
 * V3-R6 (mesure du 12 octobre) : la liste complete d'un ruleset se lit page
 * par page, et s'arrete des qu'une page n'est pas pleine. Avant, 9 pages de
 * plus partaient d'office : pour le SRD 2024 (~1 900 entrees), 8 revenaient
 * vides, chacune parcourant pourtant la table avec la RLS (~460 ms de base).
 *
 * Faux client : il compte les pages demandees, sans toucher la base.
 */
function fauxClient(total: number) {
  const pages: Array<{ from: number; to: number; types: readonly string[] | null; select: string; filtres: Array<[string, string]> }> = [];
  const client = {
    from() {
      let types: readonly string[] | null = null;
      let colonnes = "";
      const filtres: Array<[string, string]> = [];
      const requete = {
        select: (c: string) => {
          colonnes = c;
          return requete;
        },
        eq: (colonne: string, valeur: string) => {
          filtres.push([colonne, valeur]);
          return requete;
        },
        in: (_colonne: string, valeurs: readonly string[]) => {
          types = valeurs;
          return requete;
        },
        order: () => requete,
        range: async (from: number, to: number) => {
          pages.push({ from, to, types, select: colonnes, filtres: [...filtres] });
          const avecTraduction = colonnes.includes("ruleset_entry_translations(name)");
          const n = Math.max(0, Math.min(to, total - 1) - from + 1);
          const data = Array.from({ length: n }, (_, i) => ({
            id: `e${from + i}`,
            entry_key: `cle-${from + i}`,
            entry_type: "spell",
            raw_name: `Regle ${from + i}`,
            raw_class_index: null,
            raw_species_index: null,
            raw_race_index: null,
            raw_xp: null,
            raw_challenge_rating: null,
            raw_type: null,
            raw_size: null,
            // Une entree sur deux a une traduction ; les autres, un tableau vide (jointure externe).
            ...(avecTraduction ? { ruleset_entry_translations: (from + i) % 2 === 0 ? [{ name: `Nom ${from + i}` }] : [] } : {}),
          }));
          return { data, error: null };
        },
      };
      return requete;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, pages };
}

describe("listRulesetEntries : pages lues jusqu'a la premiere incomplete", () => {
  it("un petit ruleset : une seule page", async () => {
    const { client, pages } = fauxClient(500);
    const entrees = await listRulesetEntries(client, "rs");
    expect(entrees).toHaveLength(500);
    expect(pages).toHaveLength(1);
  });

  it("le SRD 2024 (~1 900 entrees) : deux pages, plus aucune page vide", async () => {
    const { client, pages } = fauxClient(1907);
    const entrees = await listRulesetEntries(client, "rs");
    expect(entrees).toHaveLength(1907);
    expect(pages.map((p) => p.from)).toEqual([0, 1000]);
    expect(new Set(entrees.map((e) => e.id)).size).toBe(1907);
  });

  it("un total multiple de la taille de page : une page vide de plus, pas davantage", async () => {
    const { client, pages } = fauxClient(2000);
    expect(await listRulesetEntries(client, "rs")).toHaveLength(2000);
    expect(pages.map((p) => p.from)).toEqual([0, 1000, 2000]);
  });

  it("garde le plafond de dix pages", async () => {
    const { client, pages } = fauxClient(50_000);
    expect(await listRulesetEntries(client, "rs")).toHaveLength(10_000);
    expect(pages).toHaveLength(10);
  });

  it("transmet le filtre de types a chaque page", async () => {
    const { client, pages } = fauxClient(1500);
    await listRulesetEntries(client, "rs", { entryTypes: ["monster"] });
    expect(pages.every((p) => p.types?.[0] === "monster")).toBe(true);
  });

  it("V3-R8 : sans langue demandee, aucune jointure de traduction", async () => {
    const { client, pages } = fauxClient(10);
    const entrees = await listRulesetEntries(client, "rs");
    expect(pages[0].select).not.toContain("ruleset_entry_translations");
    expect(entrees[0].translated_name).toBeUndefined();
  });

  it("V3-R8 : la traduction vient dans la meme requete que la liste, filtree sur la langue", async () => {
    const { client, pages } = fauxClient(1907);
    const entrees = await listRulesetEntries(client, "rs", { locale: "fr" });
    expect(pages).toHaveLength(2); // aucune requete de plus
    for (const p of pages) {
      expect(p.select).toContain("ruleset_entry_translations(name)");
      expect(p.filtres).toContainEqual(["ruleset_entry_translations.locale", "fr"]);
    }
    expect(entrees[0].translated_name).toBe("Nom 0");
    expect(entrees[1].translated_name).toBeNull(); // pas de traduction : le nom anglais servira
    expect(entrees[1000].translated_name).toBe("Nom 1000");
  });
});

