"use client";

import { useState } from "react";

export interface InfoTagItem {
  key: string;
  label: string;
  /** Texte ENTIER de la regle, jamais un resume tronque. Les sauts de ligne entre paragraphes sont conserves a l'affichage (`whitespace-pre-line`). `null` = aucune fiche resolue : la pastille reste affichee, mais inerte — jamais un bouton qui n'ouvrirait rien. */
  description: string | null;
  /** `accent` : une botte d'arme, qui depend du personnage, pas de l'objet. Meme forme que les autres, seule la teinte differe. */
  tone?: "default" | "accent";
}

/**
 * Rangee de caracteristiques d'un objet (proprietes d'arme, botte d'arme) avec
 * leur explication a la demande (retour utilisateur : "au survol sur
 * ordinateur, au clic sur telephone").
 *
 * L'explication s'affiche SOUS la rangee, pas en bulle flottante ancree a la
 * pastille : sur une carte d'arme large de quelques centimetres, une bulle
 * posee sur la derniere pastille de la ligne deborderait de la carte, et la
 * recadrer demanderait de mesurer en JS a chaque rendu. Une seule explication
 * a la fois, sur toute la largeur disponible — lisible pareil sur les deux
 * ecrans, et rien a calculer.
 *
 * Les trois entrees possibles sont distinguees a la source :
 * - souris : `pointerType === "mouse"` ouvre au survol, ferme a la sortie ;
 * - tactile : le clic bascule (un second appui referme) ;
 * - clavier : seul un focus REELLEMENT clavier (`:focus-visible`) ouvre, sans
 *   quoi le focus donne par un clic rouvrirait ce que le clic vient de fermer.
 */
export default function InfoTags({ items }: { items: InfoTagItem[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (items.length === 0) return null;

  const open = items.find((i) => i.key === openKey && i.description);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {items.map((item) => {
          const tone = item.tone === "accent" ? "border-accent text-accent" : "border-edge text-ink-muted";
          if (!item.description) {
            return (
              <span key={item.key} className={`rounded-full border px-1.5 py-0 text-[10px] ${tone}`}>
                {item.label}
              </span>
            );
          }
          const isOpen = openKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-expanded={isOpen}
              onPointerEnter={(e) => e.pointerType === "mouse" && setOpenKey(item.key)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setOpenKey((k) => (k === item.key ? null : k))}
              onClick={() => setOpenKey((k) => (k === item.key ? null : item.key))}
              onFocus={(e) => e.currentTarget.matches(":focus-visible") && setOpenKey(item.key)}
              onBlur={() => setOpenKey((k) => (k === item.key ? null : k))}
              onKeyDown={(e) => e.key === "Escape" && setOpenKey(null)}
              className={`rounded-full border px-1.5 py-0 text-[10px] transition-colors ${tone} ${
                isOpen ? "bg-panel-sunken text-ink" : "hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {open && (
        <p className="whitespace-pre-line text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">{open.label}</span> — {open.description}
        </p>
      )}
    </div>
  );
}
