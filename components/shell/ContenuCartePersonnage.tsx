"use client";

import { useTranslations } from "next-intl";
import type { CartePersonnage } from "@/src/server/services/choixPersonnage";

/**
 * L'intérieur d'une carte de personnage (V3.1-82) : portrait ou initiale,
 * nom, identité ou « Fiche de personnage à créer », phrase d'accroche.
 * Partagé entre le carrousel « Choisis ton personnage » et l'onglet
 * Personnage d'un PJ sans fiche (V3.1-154) : le cadre (position, bordure,
 * halo) reste à l'appelant. `carte: null` : la carte « Nouveau personnage ».
 */
export default function ContenuCartePersonnage({ carte }: { carte: CartePersonnage | null }) {
  const t = useTranslations("choixPersonnage");
  const nom = carte ? carte.entityName : t("nouveauNom");
  return (
    <>
      <div className="relative flex h-[250px] items-center justify-center overflow-hidden bg-panel-sunken md:h-[280px] lg:h-[330px]">
        {carte?.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- portrait servi par /api/entities/[id]/portrait
          <img src={carte.portraitUrl} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className={`font-display text-[96px] font-bold ${carte ? "text-ink-muted" : "text-accent"}`}>
            {carte ? (nom.trim()[0] ?? "").toUpperCase() : "+"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="block-title text-base">{nom}</span>
        {carte?.identite && (
          <span className="text-xs text-accent">
            {/* `classesLabel` porte déjà les niveaux (« Rôdeuse 3 », « Guerrier 2 / Magicien 1 »). */}
            {[carte.identite.speciesLabel, carte.identite.classesLabel].filter(Boolean).join(" · ")}
          </span>
        )}
        {carte && carte.identite === null && (
          <span className="self-start rounded-full border border-dashed border-accent/60 px-2.5 py-0.5 text-xs text-accent">{t("aCreer")}</span>
        )}
        {carte ? (
          carte.phrase && <span className="text-xs leading-relaxed text-ink-soft">{carte.phrase}</span>
        ) : (
          <span className="text-xs leading-relaxed text-ink-soft">{t("nouveauTexte")}</span>
        )}
      </div>
    </>
  );
}
