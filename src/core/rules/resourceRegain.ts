import type { SheetResource } from "./sheet";

/**
 * ADR 0076 (V3.1-183) — Regagner une utilisation d'une ressource en dépensant
 * autre chose : une autre ressource (« vous pouvez récupérer cette
 * utilisation en dépensant l'une de vos Inspirations bardiques »), ou un
 * emplacement de sort d'un niveau minimal (« en dépensant un emplacement du
 * 3e niveau ou supérieur »). Pur : rend le nouvel état des compteurs, que le
 * serveur écrit ; le client n'envoie qu'une intention (règle 8 : rien de
 * tiré ici, rien à tirer).
 */

export interface PlanRegainInput {
  resourceKey: string;
  /** Les ressources calculées par la fiche (maximum, regain). */
  resources: readonly SheetResource[];
  /** Les utilisations dépensées, par clé (`runtime_state.resources`). */
  used: Readonly<Record<string, number>>;
  /** Les emplacements : totaux par niveau (fiche calculée), dépensés par niveau (`runtime_state.spell_slots_used`). */
  slots: { totals: Readonly<Record<number, number>>; used: Readonly<Record<string, number>> };
  /** Le niveau d'emplacement choisi ; absent : le plus petit qui convient. */
  slotLevel?: number;
}

export type PlanRegainResult =
  | {
      ok: true;
      /** Les compteurs de ressources à écrire (la ressource regagnée, et celle dépensée s'il y en a une). */
      resources: Record<string, number>;
      /** Les emplacements dépensés à écrire, quand le coût est un emplacement. */
      spellSlotsUsed?: Record<string, number>;
      spent: { kind: "resource"; key: string; amount: number } | { kind: "slot"; level: number };
    }
  | { ok: false; reason: "no_regain" | "full" | "cannot_pay" };

export function planResourceRegain(input: PlanRegainInput): PlanRegainResult {
  const ressource = input.resources.find((r) => r.key === input.resourceKey);
  if (!ressource?.regain) return { ok: false, reason: "no_regain" };
  const utilisees = input.used[ressource.key] ?? 0;
  if (utilisees <= 0) return { ok: false, reason: "full" };
  const regagnee = { [ressource.key]: utilisees - 1 };
  const regain = ressource.regain;

  if (regain.kind === "resource") {
    const cout = input.resources.find((r) => r.key === regain.key);
    const depensees = input.used[regain.key] ?? 0;
    if (!cout || cout.max - depensees < regain.amount) return { ok: false, reason: "cannot_pay" };
    return {
      ok: true,
      resources: { ...regagnee, [regain.key]: depensees + regain.amount },
      spent: { kind: "resource", key: regain.key, amount: regain.amount },
    };
  }

  const libre = (niveau: number) => (input.slots.totals[niveau] ?? 0) - (input.slots.used[String(niveau)] ?? 0) > 0;
  let niveau: number | undefined;
  if (input.slotLevel !== undefined) {
    niveau = input.slotLevel >= regain.min_level && libre(input.slotLevel) ? input.slotLevel : undefined;
  } else {
    for (let n = regain.min_level; n <= 9 && niveau === undefined; n++) if (libre(n)) niveau = n;
  }
  if (niveau === undefined) return { ok: false, reason: "cannot_pay" };
  return {
    ok: true,
    resources: regagnee,
    spellSlotsUsed: { ...input.slots.used, [String(niveau)]: (input.slots.used[String(niveau)] ?? 0) + 1 },
    spent: { kind: "slot", level: niveau },
  };
}
