"use client";

import { useEditCommit } from "./EditCommitContext";

/**
 * Case a cocher aux jetons de la charte (retour utilisateur : la case
 * native du navigateur ne suit ni les couleurs ni les rayons du systeme
 * visuel) — meme convention que `EyeIcon.tsx` : un SVG inline, `currentColor`,
 * aucune dependance. `role="checkbox"` sur un `<span>` plutot qu'un
 * `<input type="checkbox">` cache : le `<input>` cache reste invisible aux
 * outils qui listent les controles de formulaire par role, alors que ce
 * pattern (deja utilise par `Dropdown.tsx` pour son bouton declencheur)
 * garde le clavier et le lecteur d'ecran fonctionnels sans ce compromis.
 *
 * Ce choix a un revers : n'etant pas un `<input>`, cette case n'emet aucun
 * evenement `change` natif qu'un conteneur pourrait ecouter pour savoir qu'une
 * valeur vient d'etre engagee. Elle le dit donc elle-meme, via
 * `useEditCommit()` (ADR 0023) — sans quoi une case cochee dans un bloc de
 * fiche se perdait en silence si la personne quittait la page sans que le
 * focus ait quitte le bloc. Le contexte vaut `null` partout ailleurs : ce
 * composant s'y comporte exactement comme avant.
 */
export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  /** Nom accessible quand la case n'a pas de `label` visible — sans lui, `role="checkbox"` reste anonyme pour un lecteur d'ecran. */
  "aria-label"?: string;
}) {
  const commit = useEditCommit();

  function toggle() {
    if (disabled) return;
    onChange();
    // Apres `onChange`, jamais avant : c'est lui qui pose la valeur neuve dans
    // le miroir synchrone du conteneur, que l'enregistrement va lire.
    commit?.();
  }

  return (
    <label
      className={`inline-flex select-none items-center gap-1.5 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className ?? ""}`}
    >
      <span
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
          }
        }}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
          checked ? "border-accent bg-accent text-accent-ink" : "border-edge bg-transparent text-transparent hover:border-edge-strong"
        }`}
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5" aria-hidden>
          <path d="M2 6.2 4.8 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </label>
  );
}
