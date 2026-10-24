"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { naturelDepuisSaisie, saisieValide } from "@/lib/ui/combatJoueur";

function Interrupteur({ actif, onChange, libelle }: { actif: boolean; onChange: (valeur: boolean) => void; libelle: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={() => onChange(!actif)} className="flex shrink-0 items-center gap-1.5">
      <span className={`relative h-4 w-7 rounded-full border transition-colors ${actif ? "border-accent bg-accent" : "border-edge-strong bg-edge"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-panel transition-all motion-reduce:transition-none ${actif ? "left-[13px]" : "left-0.5"}`} />
      </span>
      <span className={`text-xs ${actif ? "font-semibold text-accent" : "text-ink-muted"}`}>{libelle}</span>
    </button>
  );
}

/**
 * V3.1-112 — « J'ai un vrai dé » : la valeur lue sur le dé de la table, avec
 * l'interrupteur « modificateur inclus » (même recette que l'invitation
 * d'initiative). La valeur part telle quelle au serveur, qui reste l'arbitre.
 */
export default function SaisieVraiDe({
  desactive,
  aide = true,
  onValider,
}: {
  desactive: boolean;
  aide?: boolean;
  onValider: (natural: number, modificateurInclus: boolean) => void;
}) {
  const t = useTranslations("sauvegardes");
  const [saisie, setSaisie] = useState("");
  const [inclus, setInclus] = useState(false);
  const natural = naturelDepuisSaisie(saisie);
  const ok = saisieValide(natural, inclus);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (natural !== null && ok && !desactive) onValider(natural, inclus);
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={inclus ? "—" : "1–20"}
          aria-label={t("valeurDe")}
          className="h-9 w-20 rounded-full border border-edge bg-panel-sunken px-2 text-center font-mech text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent"
        />
        <Interrupteur actif={inclus} onChange={setInclus} libelle={t("modificateurInclus")} />
        <button
          type="submit"
          disabled={!ok || desactive}
          className="ml-auto rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent"
        >
          {t("valider")}
        </button>
      </div>
      {aide && <p className="text-xs text-ink-muted">{inclus ? t("saisieAideTotal") : t("saisieAideNu")}</p>}
    </form>
  );
}
