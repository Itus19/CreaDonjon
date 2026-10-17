"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import RejoindreTable from "./RejoindreTable";

type Chemin = "choix" | "mener" | "solo" | "rejoindre";

/**
 * Bouton « Nouveau monde » et son petit panneau « Que veux-tu faire ? »
 * (V3.1-35) : trois chemins, chacun avec « ◁ Retour ». Les formulaires de
 * création arrivent tout faits de la page (ils ont besoin des rulesets,
 * lus côté serveur) ; « Jouer en solo » est `null` pour un compte qui ne peut
 * pas créer de solo, et le chemin n'est alors pas proposé.
 */
export default function NouveauMonde({
  menerPartie,
  jouerSolo,
  pleineLargeur = false,
}: {
  menerPartie: React.ReactNode;
  jouerSolo: React.ReactNode | null;
  pleineLargeur?: boolean;
}) {
  const t = useTranslations("accueil");
  const [ouvert, setOuvert] = useState(false);
  const [chemin, setChemin] = useState<Chemin>("choix");

  function basculer() {
    setOuvert((o) => !o);
    setChemin("choix");
  }

  const retour = (
    <button
      type="button"
      onClick={() => setChemin("choix")}
      className="mb-2 self-start text-xs text-ink-muted transition-colors hover:text-ink"
    >
      {t("retour")}
    </button>
  );
  const classeChoix =
    "rounded-lg border border-edge bg-panel-raised px-4 py-2.5 text-left text-sm text-ink transition-colors hover:border-accent";

  return (
    <div className={`flex flex-col gap-2 ${pleineLargeur ? "w-full" : "items-start"}`}>
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        className={`rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-ink transition-colors hover:bg-accent-hover ${
          pleineLargeur ? "w-full" : ""
        }`}
      >
        {t("nouveauMonde")}
      </button>

      {ouvert && (
        <div className="flex w-full max-w-xl flex-col rounded-lg border border-edge bg-panel p-3">
          {chemin === "choix" && (
            <>
              <p className="mb-2 text-sm font-medium text-ink">{t("queFaire")}</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setChemin("mener")} className={classeChoix}>
                  {t("menerPartie")}
                </button>
                {jouerSolo !== null && (
                  <button type="button" onClick={() => setChemin("solo")} className={classeChoix}>
                    {t("jouerSolo")}
                  </button>
                )}
                <button type="button" onClick={() => setChemin("rejoindre")} className={classeChoix}>
                  {t("rejoindreTable")}
                </button>
              </div>
            </>
          )}
          {chemin === "mener" && (
            <>
              {retour}
              <div className="flex flex-wrap items-center gap-2">{menerPartie}</div>
            </>
          )}
          {chemin === "solo" && jouerSolo !== null && (
            <>
              {retour}
              <div className="flex flex-wrap items-center gap-2">{jouerSolo}</div>
            </>
          )}
          {chemin === "rejoindre" && (
            <>
              {retour}
              <RejoindreTable />
            </>
          )}
        </div>
      )}
    </div>
  );
}
