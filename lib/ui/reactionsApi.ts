import { z } from "zod";
import type { RollWindowAction } from "@/lib/rollWindows/schemas";

/**
 * V3.1-161 (ADR 0075) — répondre à une fenêtre de réaction, « Continuer » (le
 * MJ) ou la reprendre (l'auteur du jet) : `POST …/roll-windows/[id]`. Le seul
 * appel des écrans de réaction ; la liste arrive avec la page, puis par le
 * temps réel (`SauvegardesProvider`). Un échec est rendu, jamais avalé.
 */

/**
 * Ce que la reprise a appliqué, tel que l'auteur le lit (le serveur a tranché,
 * règle 8) : des phrases (jet ciblé : `facts` et `changes` ; sauvegarde :
 * `changes` et `hints`), et pour un test de la fiche son total et son verdict.
 */
export interface IssueReprise {
  phrases: string[];
  test: { what: string; total: number; verdict: "success" | "fail" | null } | null;
}

export interface ReponseFenetre {
  closed: boolean;
  /** `null` : rien à reprendre ici (la fenêtre reste ouverte, ou une autre personne la reprend). */
  reprise: IssueReprise | null;
}

export type ResultatFenetre = { ok: true; reponse: ReponseFenetre } | { ok: false; erreur: string };

/** `ResumedRoll` (serveur) : l'origine dit quel service a rejoué le jet. Un résultat refusé (`ok: false`) ne se lit pas ici. */
const zReprise = z.discriminatedUnion("origin", [
  z.object({ origin: z.literal("targeted"), result: z.object({ ok: z.literal(true), facts: z.array(z.string()), changes: z.array(z.string()) }) }),
  z.object({ origin: z.literal("save_request"), result: z.object({ ok: z.literal(true), changes: z.array(z.string()), hints: z.array(z.string()) }) }),
  z.object({
    origin: z.literal("sheet_check"),
    result: z.object({ ok: z.literal(true), roll: z.object({ what: z.string(), total: z.number(), verdict: z.enum(["success", "fail"]).nullable() }) }),
  }),
]);

const zReponse = z.object({
  closed: z.boolean().optional(),
  resumed: z.unknown().optional(),
});

function issueDe(resumed: unknown): IssueReprise | null | "illisible" {
  if (resumed === null || resumed === undefined) return null;
  const lue = zReprise.safeParse(resumed);
  if (!lue.success) return "illisible";
  const r = lue.data;
  if (r.origin === "targeted") return { phrases: [...r.result.facts, ...r.result.changes], test: null };
  if (r.origin === "save_request") return { phrases: [...r.result.changes, ...r.result.hints], test: null };
  return { phrases: [], test: r.result.roll };
}

export async function agirSurFenetre(campaignId: string, windowId: string, action: RollWindowAction, erreurReseau: string): Promise<ResultatFenetre> {
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/roll-windows/${windowId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    const corps: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const erreur = corps && typeof corps === "object" && "error" in corps && typeof corps.error === "string" ? corps.error : erreurReseau;
      return { ok: false, erreur };
    }
    const lue = zReponse.safeParse(corps);
    if (!lue.success) return { ok: false, erreur: erreurReseau };
    const reprise = issueDe(lue.data.resumed);
    if (reprise === "illisible") return { ok: false, erreur: erreurReseau };
    return { ok: true, reponse: { closed: lue.data.closed === true, reprise } };
  } catch (erreur: unknown) {
    console.error("Réponse à la fenêtre de réaction non envoyée", erreur);
    return { ok: false, erreur: erreurReseau };
  }
}
