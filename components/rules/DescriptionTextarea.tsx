"use client";

import { useRef } from "react";

/**
 * Champ de description partage par les formulaires "regle maison"
 * (`CreateHomebrewFeatureForm.tsx`, `CreateHomebrewBackgroundForm.tsx`) —
 * retour utilisateur : "un champ de texte avec outil de mise en forme".
 *
 * Un seul bouton (gras), jamais un editeur riche complet type Tiptap : le
 * bloc `description` (`zDescriptionBlockData`, rule-blocks/blocks.ts) reste
 * une liste de chaines brutes, pas le modele `SegmentContentNode`/`marks`
 * des blocs d'entite. Sa mise en forme suit deja une convention fermee et
 * volontairement minimale (`Prose.tsx`, `renderMarkdownBoldText`) : un
 * paragraphe qui COMMENCE par `**Titre.**` devient un sous-titre en gras
 * sur sa propre ligne, `\n` separe deux paragraphes — exactement le motif
 * que le SRD utilise pour un don ("Deux sorts mineurs.", "Sort du 1er
 * niveau."...). Ce bouton ne fait qu'ecrire ce meme motif a la place de
 * l'utilisateur plutot que de lui faire memoriser la syntaxe — jamais un
 * second moteur de rendu a maintenir en parallele.
 */
export default function DescriptionTextarea({
  value,
  onChange,
  rows = 4,
  required,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  required?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrapSelectionBold() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd) || "Titre";
    const next = `${value.slice(0, selectionStart)}**${selected}**${value.slice(selectionEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + 2, selectionStart + 2 + selected.length);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={wrapSelectionBold}
          title="Mettre en gras (sous-titre de paragraphe, ex. « Formation aux instruments. »)"
          className="rounded border border-edge px-2 py-0.5 text-xs font-bold text-ink transition-colors hover:bg-panel-raised"
        >
          G
        </button>
        <span className="text-[10px] text-ink-muted">Sélectionnez un début de phrase puis « G » pour un sous-titre. Une ligne vide sépare deux paragraphes.</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={rows}
        className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
      />
    </div>
  );
}
