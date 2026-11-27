"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BoutonPetit, ChampListe } from "@/components/rules/briques/ContexteBriques";
import { REVEAL_RADII_KM } from "@/lib/worldgen/schemas";
import { revealPlacesAction } from "@/app/m/[worldSlug]/(monde)/revelerActions";

/**
 * G-7b — sur la fiche d'une ville d'un monde créé depuis une carte : fait
 * naître les pages des villes voisines, par la route, en attendant que le
 * tour solo le fasse seul (G-4). Le serveur réserve le geste au MJ.
 */
export default function RevelerLieuxAlentour({ worldSlug, entityId }: { worldSlug: string; entityId: string }) {
  const t = useTranslations("fiche.ville");
  const [rayon, setRayon] = useState<(typeof REVEAL_RADII_KM)[number]>(50);
  const [enCours, demarrer] = useTransition();
  const [resultat, setResultat] = useState<{ slug: string; name: string }[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function reveler() {
    setErreur(null);
    setResultat(null);
    demarrer(async () => {
      const r = await revealPlacesAction({ worldSlug, entityId, radiusKm: rayon });
      if (r.ok) setResultat(r.created);
      else setErreur(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-edge pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <ChampListe
            libelle={t("rayon")}
            valeur={String(rayon)}
            options={REVEAL_RADII_KM.map((km) => ({ value: String(km), label: t("rayonKm", { km }) }))}
            onChange={(v) => setRayon(REVEAL_RADII_KM.find((km) => String(km) === v) ?? rayon)}
          />
        </div>
        <BoutonPetit onClick={reveler} disabled={enCours}>
          {enCours ? t("revelerEnCours") : t("reveler")}
        </BoutonPetit>
      </div>
      {resultat !== null && resultat.length === 0 && <p className="text-xs text-ink-soft">{t("revelerAucun")}</p>}
      {resultat !== null && resultat.length > 0 && (
        <p className="text-xs text-ink-soft">
          {t("revelerCrees")}
          {resultat.map((r, i) => (
            <span key={r.slug}>
              {i > 0 && ", "}
              <Link href={`/m/${worldSlug}/f/${r.slug}`} className="text-accent hover:underline">
                {r.name}
              </Link>
            </span>
          ))}
        </p>
      )}
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </div>
  );
}
