import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { loadNotebookTree } from "@/src/server/services/notebook";
import { updateBlockContent } from "@/src/server/services/blocks";
import { zNoteTreeBlockData } from "@/src/core/schemas/blocks/noteTree";

type TypedClient = SupabaseClient<Database>;

export type PinRuleResult = { ok: true; alreadyPinned: boolean } | { ok: false; reason: "conflict" | "invalid" };

/**
 * V3.1-94 — « Épingler au Bloc-notes » depuis l'écran d'une règle : ajoute
 * une ligne `pinned_rule` à la fin du cahier PRIVÉ de l'appelant (créé au
 * besoin), côté serveur. Même écriture versionnée que le cahier
 * (`updateBlockContent`) : si le cahier a changé entre-temps (ouvert dans une
 * autre fenêtre), on relit et on réessaie une fois, jamais on n'écrase.
 * Une règle déjà épinglée ne l'est pas deux fois.
 */
export async function pinRuleToNotebook(supabase: TypedClient, params: { worldId: string; userId: string; ruleKey: string }): Promise<PinRuleResult> {
  for (let essai = 0; essai < 2; essai++) {
    const { block, items } = await loadNotebookTree(supabase, { worldId: params.worldId, userId: params.userId });
    if (items.some((i) => i.kind === "pinned_rule" && i.targetKey === params.ruleKey)) return { ok: true, alreadyPinned: true };
    const position = items.filter((i) => i.parentId === null).reduce((max, i) => Math.max(max, i.position), 0) + 1000;
    const parsed = zNoteTreeBlockData.safeParse({
      __v: 1,
      items: [...items, { id: crypto.randomUUID(), parentId: null, position, kind: "pinned_rule", targetKey: params.ruleKey }],
    });
    if (!parsed.success) return { ok: false, reason: "invalid" };
    const saved = await updateBlockContent(supabase, {
      id: block.id,
      expectedVersion: block.version,
      display: block.display,
      data: parsed.data as unknown as Json,
      visibilityLevel: block.visibility_level,
      visibilityScopeId: block.visibility_scope_id,
      changedBy: params.userId,
    });
    if (saved.ok) return { ok: true, alreadyPinned: false };
  }
  return { ok: false, reason: "conflict" };
}
