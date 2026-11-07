"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import { REFERENCES_FORMULE, erreurFormule } from "@/lib/ui/briquesRegle";

/**
 * V3.1-132 — un champ de FORMULE : du texte que `parseFormula` comprend
 * (`max(1, {ability.cha})`), jamais du JSON. L'erreur s'affiche sous le champ
 * dès que le texte n'est pas une formule ; une liste insère une référence
 * (`{spell_save_dc}`…) à l'endroit du curseur.
 */
export default function ChampFormule({
  libelle,
  valeur,
  onChange,
  facultatif,
  sansDes,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  /** Un champ vide est alors permis (nombre de cibles : une seule par défaut). */
  facultatif?: boolean;
  /** Un dé y est refusé (valeur d'un modificateur sur une cible fixe : CA, vitesse, PV, sens) ; l'erreur s'affiche sous le champ. */
  sansDes?: boolean;
}) {
  const t = useTranslations("regles.briques");
  const champ = useRef<HTMLInputElement>(null);
  const erreur = facultatif && valeur.trim() === "" ? null : erreurFormule(valeur, { sansDes });

  function inserer(texte: string) {
    const el = champ.current;
    const debut = el?.selectionStart ?? valeur.length;
    const fin = el?.selectionEnd ?? valeur.length;
    onChange(valeur.slice(0, debut) + texte + valeur.slice(fin));
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        {libelle}
        <input
          ref={champ}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-invalid={erreur !== null}
          className="w-full rounded-md border border-edge bg-transparent px-2 py-1.5 font-mech text-sm text-ink outline-none"
        />
      </label>
      {erreur && <span className="text-xs text-danger">{erreur}</span>}
      <Dropdown
        value=""
        options={[{ value: "", label: t("insererReference") }, ...REFERENCES_FORMULE.map((r) => ({ value: r.texte, label: `${t(`reference.${r.cle}`)}  ${r.texte}` }))]}
        onChange={(v) => v !== "" && inserer(v)}
        aria-label={t("insererReferenceAria", { champ: libelle })}
      />
    </div>
  );
}
