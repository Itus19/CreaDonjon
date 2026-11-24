import type { EquippableBlockData } from "@/src/core/schemas/blocks/equippable";
import { formatFormulaNode } from "@/src/core/formula";
import { MODIFIER_OP_LABELS_FR, modifierTargetLabel } from "@/src/i18n/fr";

const RECHARGES: Record<EquippableBlockData["actions"][number]["recharge"], string> = {
  short_rest: "au repos court",
  short_rest_one: "une au repos court",
  long_rest: "au repos long",
  dawn: "à l'aube",
  never: "jamais",
};

/**
 * AG-19 (ADR 0107) — le bloc « Objet équipable » en lecture : ce que l'objet
 * fait à qui le porte, en phrases courtes. Les chiffres sur la fiche du
 * porteur viennent du moteur ; ici, on ne fait que dire ce qui est déclaré.
 */
export default function PublicEquippableBlock({ data }: { data: EquippableBlockData }) {
  const conditions = [data.only_equipped ? "Équipé" : "Porté sur soi", ...(data.requires_attunement ? ["harmonisation requise"] : [])].join(", ");
  return (
    <div className="flex flex-col gap-2 text-sm text-ink">
      <p className="text-xs text-ink-muted">{conditions}</p>
      {data.modifiers.length > 0 && (
        <ul className="list-disc pl-5">
          {data.modifiers.map((m, i) => (
            <li key={i}>
              {modifierTargetLabel(m.target)} : {MODIFIER_OP_LABELS_FR[m.op]}
              {m.value !== undefined && <span className="font-mech"> {typeof m.value === "number" ? m.value : formatFormulaNode(m.value)}</span>}
            </li>
          ))}
        </ul>
      )}
      {data.spells.length > 0 && <p>Sorts accordés : {data.spells.map((s) => s.key).join(", ")}</p>}
      {data.actions.map((a) => (
        <div key={a.id}>
          <p className="font-semibold">
            {a.name} <span className="font-mech text-xs text-ink-muted">({a.charges} charges, recharge {RECHARGES[a.recharge]})</span>
          </p>
          {a.description && <p className="text-ink-soft">{a.description}</p>}
        </div>
      ))}
    </div>
  );
}
