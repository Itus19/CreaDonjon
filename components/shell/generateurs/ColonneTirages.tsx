"use client";

import { isProseSlot } from "@/src/core/generators/types";
import type { GeneratorToolWindowData } from "@/src/server/services/generators";
import { formatTableEntryPrice } from "@/src/i18n/fr";
import BoutonRelance from "./BoutonRelance";
import EditionTables from "./EditionTables";
import TableauItems from "./TableauItems";
import { sectionOccupee, ETAT_VIDE, type EtatSection, type SectionOutil } from "./useTirages";

/**
 * Les tirages (V3.1-45) : chaque section et ses emplacements — de, resultat,
 * ↻ par emplacement, ↻ par section. « Éditer les tables » prend la place des
 * tirages dans cette colonne (retour par ×). Les resultats viennent de l'etat
 * unique du panneau : l'apercu de la fiche montre les memes.
 *
 * Avant le premier tirage d'une section, seul son bouton « Tirer » existe :
 * relancer un emplacement n'a de sens qu'apres un tirage complet.
 */
export default function ColonneTirages({
  tool,
  etats,
  variante,
  onTirer,
  sectionEditee,
  onEditer,
  onFermerEdition,
}: {
  tool: GeneratorToolWindowData;
  etats: Record<string, EtatSection>;
  variante: Record<string, string>;
  onTirer: (section: SectionOutil, slotKey: string | null) => void;
  /** Bloc de la section dont les tables sont ouvertes. */
  sectionEditee?: string | null;
  /** Absent : pas de bouton d'edition (feuille du telephone). */
  onEditer?: (blockId: string) => void;
  onFermerEdition?: () => void;
}) {
  const editee = sectionEditee ? tool.sections.find((s) => s.blockId === sectionEditee) : undefined;
  if (editee && onFermerEdition) {
    return <EditionTables key={editee.blockId} blockId={editee.blockId} libelle={editee.label} variant={variante} onFermer={onFermerEdition} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold text-ink">Les tirages</span>
      {tool.sections.map((section) => {
        const etat = etats[section.blockId] ?? ETAT_VIDE;
        const occupee = sectionOccupee(etat);
        return (
          <div key={section.blockId} className="flex flex-col gap-1.5 rounded-md border border-edge/60 p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs font-semibold text-ink">{section.label}</span>
              {onEditer && (
                <button
                  type="button"
                  onClick={() => onEditer(section.blockId)}
                  title="Voir et modifier les tables tirées par cette section"
                  className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
                >
                  Éditer les tables
                </button>
              )}
              {etat.text === null ? (
                <button
                  type="button"
                  onClick={() => onTirer(section, null)}
                  disabled={occupee}
                  className="rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {etat.enCours ? "Tirage…" : "Tirer"}
                </button>
              ) : (
                <BoutonRelance onClick={() => onTirer(section, null)} desactive={occupee} enCours={etat.enCours} titre={`Relancer la section ${section.label}`} />
              )}
            </div>
            {etat.error && <p className="text-xs text-danger">{etat.error}</p>}
            {etat.text !== null &&
              section.data.slots.map((slot) => {
                const resultat = etat.slotResults[slot.key];
                const prix = formatTableEntryPrice(resultat?.price);
                return (
                  <div key={slot.key} className="flex items-start gap-2 border-t border-edge/30 pt-1.5 text-xs">
                    <span className="w-28 shrink-0 pt-0.5 text-ink-muted">{slot.key}</span>
                    {resultat?.die && resultat.rolled !== undefined && (
                      <span className="mech shrink-0 pt-0.5 text-ink-muted">
                        {resultat.die} → {resultat.rolled}
                      </span>
                    )}
                    {isProseSlot(slot) && <span className="shrink-0 rounded-full border border-edge px-1.5 pt-0.5 text-xs text-ink-muted">IA</span>}
                    {resultat?.items && resultat.items.length > 0 ? (
                      <div className="min-w-0 flex-1">
                        <TableauItems items={resultat.items} />
                      </div>
                    ) : (
                      <span className="min-w-0 flex-1 whitespace-pre-line pt-0.5 text-ink">
                        {resultat?.text || "—"}
                        {prix && <span className="ml-2 text-ink-muted">{prix}</span>}
                      </span>
                    )}
                    <BoutonRelance
                      onClick={() => onTirer(section, slot.key)}
                      desactive={occupee}
                      enCours={etat.relance === slot.key}
                      titre={`Relancer l'emplacement ${slot.key}`}
                    />
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
