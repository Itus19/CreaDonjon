"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Tabs from "@/components/shared/Tabs";
import { adresseVue, vueDepuisAdresse, type VueSolo } from "@/lib/ui/solo";
import { useTableADistanceContexte } from "./TableADistanceContexte";

/**
 * Le jeu à distance, MJ au téléphone (sous 768 px) : la coquille du solo
 * n'affiche qu'une vue, choisie par `?vue=`. Côté joueur, la barre flottante
 * de `PlayerShell` l'écrit ; côté MJ, ces trois onglets en tête d'écran.
 * Même mécanique : `history.replaceState`, aucun aller-retour serveur.
 */
export default function BarreVuesMj() {
  const t = useTranslations("distance");
  const pathname = usePathname();
  const vue = vueDepuisAdresse(useSearchParams().get("vue"));
  const { view } = useTableADistanceContexte();
  const attente = view.waiting.filter((w) => w.reason === "waits_for_gm").length;

  function aller(suivante: VueSolo) {
    window.history.replaceState(null, "", adresseVue(pathname, window.location.search, suivante));
  }

  return (
    <div className="mb-2 md:hidden">
      <Tabs
        aria-label={t("vuesMj")}
        value={vue === "monde" || vue === "fiche" ? vue : "jeu"}
        onChange={aller}
        items={[
          { value: "jeu", label: t("vueJeu") },
          { value: "monde", label: t("vueScene") },
          { value: "fiche", label: attente > 0 ? t("vueTableAttente", { n: attente }) : t("vueTable") },
        ]}
      />
    </div>
  );
}
