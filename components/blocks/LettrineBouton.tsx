"use client";

import { useTranslations } from "next-intl";

/**
 * V3.1-65 — l'interrupteur de lettrine du bloc `text`. Il vit dans un
 * EN-TETE, pas dans le corps : la lettrine vaut pour le bloc entier (un
 * seul paragraphe concerne, toujours le premier), elle n'a donc rien a
 * faire dans la bulle de selection, qui ne porte que ce qui s'applique a
 * un passage.
 *
 * Deux en-tetes l'affichent — la carte de verre de l'ordinateur
 * (`BlockCard`) et l'editeur plein ecran du telephone
 * (`EditeurPleinEcran`) — d'ou ce composant plutot que deux copies du
 * meme bouton qui divergeraient au premier changement de libelle.
 */
export default function LettrineBouton({ active, onBasculer }: { active: boolean; onBasculer: () => void }) {
  const t = useTranslations("fiche");
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-pressed={active}
      title={t("lettrineTitre")}
      className={`shrink-0 rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-panel-raised ${
        active ? "border-accent text-accent" : "border-edge text-ink-muted"
      }`}
    >
      {t("lettrine")}
    </button>
  );
}
