"use client";

import { useEffect, type RefObject } from "react";

/**
 * Les trois comportements clavier qu'une boite de dialogue doit avoir, et
 * qui manquaient a `ConfirmDialog` et `GeneratorToolPanel` (audit F-09) :
 * fermer par Echap, entrer dedans a l'ouverture, et n'en sortir qu'en la
 * fermant.
 *
 * Pourquoi un hook plutot que l'element `<dialog>` natif, qui offre les
 * trois gratuitement : `<dialog open>` change le positionnement et remplace
 * le voile par `::backdrop`. C'est donc un changement d'APPARENCE, et
 * l'apparence de ces panneaux ne peut pas etre relue en ce moment. Ce hook
 * ne touche qu'au comportement — a l'ecran, rien ne bouge. Migrer vers
 * `<dialog>` reste la bonne cible le jour ou quelqu'un peut regarder.
 *
 * `CommandPalette` porte deja sa propre version de tout ceci et n'a pas ete
 * touchee : elle fonctionne, et la reecrire sans pouvoir la regarder serait
 * prendre un risque pour rien.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalKeyboard({
  open,
  onClose,
  panelRef,
}: {
  open: boolean;
  onClose: () => void;
  /** Le PANNEAU, jamais le voile : c'est lui qui borne le parcours du focus. */
  panelRef: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!open) return;

    // Memorise d'ou l'on vient pour y revenir a la fermeture. Sans ca, le
    // focus retombe au debut du document et il faut retabuler depuis le
    // haut de la page pour reprendre ou l'on en etait.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Entrer dans la boite : le premier element utile, sinon le panneau
    // lui-meme (rendu focusable par `tabIndex={-1}` cote appelant).
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panelRef.current)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Piege de focus : sans lui, Tab sort de la boite et parcourt la page
      // derriere, qui reste atteignable au clavier alors qu'elle est
      // visuellement inaccessible.
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === firstItem || active === panel)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // `isConnected` : l'element d'ou l'on venait peut avoir disparu du
      // DOM entre-temps (une ligne supprimee, justement, par la boite qu'on
      // vient de confirmer). Lui rendre le focus jetterait une erreur.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, onClose, panelRef]);
}
