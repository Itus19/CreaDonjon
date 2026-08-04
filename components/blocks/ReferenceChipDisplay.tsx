import EntityChip from "@/components/entities/EntityChip";
import RuleChip from "@/components/rules/RuleChip";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { ResolvedChipView } from "./useReferenceChips";

/** Dispatche vers `RuleChip`/`EntityChip` selon la nature de la reference, ou un placeholder discret pendant la resolution / si la cible a disparu. */
export default function ReferenceChipDisplay({
  reference,
  chip,
}: {
  reference: BlockReference;
  chip: ResolvedChipView | undefined;
}) {
  if (!chip) {
    return <span className="text-xs italic text-ink-muted">{reference.kind === "rule" ? reference.key : "…"}</span>;
  }
  if (!chip.found) {
    return <span className="text-xs italic text-danger">{chip.name} (introuvable)</span>;
  }
  return chip.kind === "rule" ? (
    <RuleChip href={chip.href} label={chip.name} summary={chip.summary} />
  ) : (
    <EntityChip href={chip.href} label={chip.name} />
  );
}
