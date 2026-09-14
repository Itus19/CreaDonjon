"use client";

import { useId } from "react";
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
 *
 * Second revers du meme choix, corrige ici : un `<label>` ne nomme QUE les
 * controles natifs. Envelopper un `<span role="checkbox">` dans un `<label>`
 * n'a donc jamais donne de nom a la case — elle restait anonyme pour un
 * lecteur d'ecran, alors meme qu'un libelle s'affichait juste a cote. Le
 * libelle est desormais rendu dans un element porteur d'un identifiant, et la
 * case le reclame par `aria-labelledby`.
 *
 * Une case DOIT etre nommee : soit par un `label` visible, soit par un
 * `aria-label` quand il n'y a pas de place pour un libelle (une case dans une
 * ligne de tableau). Le type l'impose plutot que la convention — meme
 * discipline que la contrainte en base de V2.1-5 : une garantie mecanique
 * survit aux relectures, pas une regle qu'on se rappelle.
 */
type CheckboxProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
} & (
  | { label: React.ReactNode; "aria-label"?: string }
  | { label?: undefined; "aria-label": string }
);

export default function Checkbox(props: CheckboxProps) {
  const { checked, onChange, label, disabled, className, "aria-label": ariaLabel } = props;
  const commit = useEditCommit();
  const labelId = useId();

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
        // Jamais les deux a la fois : `aria-labelledby` l'emporterait sur
        // `aria-label`, et poser les deux ne ferait qu'ecrire un nom qu'on
        // sait ignore. Un `aria-label` explicite gagne donc, et le libelle
        // visible sert de nom le reste du temps.
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel === undefined && label !== undefined ? labelId : undefined}
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
      {/* L'identifiant est ce qui donne son nom a la case : un `<label>` ne
          nomme que les controles natifs, et celle-ci n'en est pas un. Le
          `<span>` n'apporte aucun style — il ne fait qu'etre adressable. */}
      {label !== undefined && <span id={labelId}>{label}</span>}
    </label>
  );
}
