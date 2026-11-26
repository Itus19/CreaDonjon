"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Interrupteur from "@/components/rules/Interrupteur";
import { useChangerNiveauJoueurs } from "@/components/shared/NiveauJoueursProvider";
import { enregistrerReglagesTable } from "@/lib/ui/reglesActives";

/**
 * AG-10 — « Utiliser le niveau Joueurs », dans Gestion de campagne. Coupé,
 * les pastilles et menus de visibilité ne proposent plus « Joueurs » ; ce qui
 * est déjà « Joueurs » le reste (et reste filtré pareil côté serveur).
 */
export default function NiveauJoueursPanel({ campaignId, initial }: { campaignId: string; initial: boolean }) {
  const t = useTranslations("table");
  const changerContexte = useChangerNiveauJoueurs();
  const [actif, setActif] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);

  async function basculer() {
    const cible = !actif;
    setActif(cible);
    const echec = await enregistrerReglagesTable(campaignId, { players_level: cible }, t("niveauJoueursErreur"));
    if (echec) {
      setActif(!cible);
      setErreur(echec);
      return;
    }
    setErreur(null);
    changerContexte(cible);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-6">
      <Interrupteur actif={actif} onChange={() => void basculer()} titre={t("niveauJoueursTitre")} aide={t("niveauJoueursAide")} />
      {erreur && <p role="alert" className="text-xs text-danger">{erreur}</p>}
    </section>
  );
}
