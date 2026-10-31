"use client";

import { useTranslations } from "next-intl";
import { libelleSuiteDegats } from "@/lib/ui/outilDes";
import type { TextesJetCible } from "@/lib/ui/jetCibleOutil";
import type { WoundState } from "@/src/core/rules/combatPlayerView";

const CLES_BLESSURE = { unhurt: "blessureIndemne", hurt: "blessureBlesse", bloodied: "blessureEnSang", down: "blessureHorsDeCombat" } as const satisfies Record<WoundState, string>;

/** Les textes d'un jet ciblé (espace `initiative`), partagés par l'outil Initiative et la fiche du MJ. */
export function useTextesJetCible(): TextesJetCible {
  const t = useTranslations("initiative");
  const tJoueur = useTranslations("combatJoueur");
  return {
    libelle: (cle, nom) =>
      cle === "touche"
        ? t("jetTouche", { cible: nom })
        : cle === "rate"
          ? t("jetRate", { cible: nom })
          : cle === "attaque"
            ? t("jetAttaque", { cible: nom })
            : cle === "degats"
              ? t("jetDegats", { cible: nom })
              : cle === "sauvegarde"
                ? t("jetSauvegarde", { cible: nom })
                : t("jetSoin", { cible: nom }),
    erreurJet: t("erreurJet"),
    allie: t("allie"),
    adversaire: t("adversaire"),
    lancerDegats: (formule) => libelleSuiteDegats(t("lancerDegats"), formule),
    validerDegats: t("validerDegats"),
    faireEchouer: t("faireEchouer"),
    refusMj: t("refusMj"),
    blessure: (etat) => tJoueur(CLES_BLESSURE[etat]),
  };
}
