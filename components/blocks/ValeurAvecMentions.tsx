"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { InfoboxValue } from "@/src/core/schemas/blocks/infobox";
import type { SegmentContentNode } from "@/src/core/schemas/entities/segments";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { insererMention, mentionEnCours, noeudsEditables, normaliserValeur, retirerMention, suggererFiches } from "@/lib/ui/mentionValeur";

/**
 * V3.1-66 — la valeur d'une ligne d'Encadré, où « @ » cite une fiche : un
 * champ de texte entre chaque mention, la mention en pastille (× pour la
 * retirer), et la liste des fiches sous le champ pendant la frappe (flèches,
 * Entrée pour choisir, Échap pour fermer). La logique est dans
 * `lib/ui/mentionValeur.ts` ; ici, on ne fait que brancher.
 */
export default function ValeurAvecMentions({
  value,
  onChange,
  fiches,
  placeholder,
  ariaLabel,
}: {
  value: InfoboxValue;
  onChange: (value: InfoboxValue) => void;
  fiches: readonly OtherEntityOption[];
  placeholder: string;
  ariaLabel: string;
}) {
  const t = useTranslations("fiche.encadre.mention");
  const idListe = useId();
  const noeuds = noeudsEditables(value);
  const champs = useRef<Record<number, HTMLInputElement | null>>({});
  // La mention en cours : dans quel champ, où commence le « @ », ce qui est tapé, l'option en surbrillance.
  const [enCours, setEnCours] = useState<{ index: number; debut: number; fin: number; requete: string; actif: number } | null>(null);
  const proposees = enCours ? suggererFiches(fiches, enCours.requete) : [];

  function ecrire(suivants: SegmentContentNode[]) {
    onChange(normaliserValeur(suivants));
  }

  function surSaisie(index: number, texte: string, curseur: number) {
    ecrire(noeuds.map((n, i) => (i === index ? { t: "text", v: texte } : n)));
    const trouvee = mentionEnCours(texte, curseur);
    setEnCours(trouvee ? { index, debut: trouvee.debut, fin: curseur, requete: trouvee.requete, actif: 0 } : null);
  }

  function choisir(fiche: OtherEntityOption) {
    if (!enCours) return;
    const mention: SegmentContentNode = { t: "ref", kind: "entity", id: fiche.id, label: fiche.name };
    const suivants = insererMention(noeuds, enCours.index, { debut: enCours.debut, fin: enCours.fin }, mention);
    setEnCours(null);
    ecrire(suivants);
    // Le champ qui suit la mention reçoit le curseur, après l'espace.
    const cible = enCours.index + 2;
    requestAnimationFrame(() => {
      const champ = champs.current[cible];
      champ?.focus();
      champ?.setSelectionRange(1, 1);
    });
  }

  function surTouche(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!enCours || proposees.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const pas = e.key === "ArrowDown" ? 1 : -1;
      setEnCours({ ...enCours, actif: (enCours.actif + pas + proposees.length) % proposees.length });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const fiche = proposees[enCours.actif];
      if (fiche) choisir(fiche);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEnCours(null);
    }
  }

  const dernier = noeuds.length - 1;
  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-1 border-b border-transparent text-sm text-ink transition-colors focus-within:border-accent hover:border-edge">
        {noeuds.map((noeud, index) =>
          noeud.t === "text" ? (
            <input
              key={index}
              ref={(el) => {
                champs.current[index] = el;
              }}
              value={noeud.v}
              onChange={(e) => surSaisie(index, e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onKeyDown={surTouche}
              onBlur={() => setEnCours((actuel) => (actuel?.index === index ? null : actuel))}
              placeholder={index === 0 && dernier === 0 ? placeholder : undefined}
              aria-label={ariaLabel}
              role="combobox"
              aria-expanded={enCours?.index === index && proposees.length > 0}
              aria-controls={idListe}
              aria-autocomplete="list"
              size={Math.max(1, noeud.v.length)}
              className={`bg-transparent px-0.5 py-0.5 outline-none ${index === dernier ? "min-w-[4rem] flex-1" : ""}`}
            />
          ) : (
            <span key={index} className="inline-flex items-center gap-0.5 rounded-full border border-link-entity/50 px-1.5 text-link-entity" title={t("citee", { nom: noeud.label })}>
              @{noeud.label}
              <button
                type="button"
                onClick={() => ecrire(retirerMention(noeuds, index))}
                aria-label={t("retirer", { nom: noeud.label })}
                className="px-0.5 text-xs text-ink-muted transition-colors hover:text-danger"
              >
                ×
              </button>
            </span>
          )
        )}
      </div>
      {enCours && (
        <ul
          id={idListe}
          role="listbox"
          aria-label={t("titre")}
          className="absolute left-0 top-full z-20 mt-1 flex w-64 max-w-full flex-col rounded-lg border border-edge bg-panel-raised p-1 shadow-2xl"
        >
          {proposees.length === 0 ? (
            <li className="px-2 py-1 text-xs text-ink-muted">{t("aucune")}</li>
          ) : (
            proposees.map((fiche, i) => (
              <li key={fiche.id} role="option" aria-selected={i === enCours.actif}>
                <button
                  type="button"
                  // Avant le `blur` du champ : sinon la liste se ferme avant le clic.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choisir(fiche);
                  }}
                  className={`w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-panel ${i === enCours.actif ? "bg-panel text-accent" : "text-ink"}`}
                >
                  {fiche.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
