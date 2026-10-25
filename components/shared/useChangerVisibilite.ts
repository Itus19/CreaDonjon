"use client";

import { useTranslations } from "next-intl";
import { useAnnoncer } from "@/components/shared/AnnonceVisibilite";
import { isVisibilityLevelKey } from "@/components/shared/visibilityOptions";
import { annonceVisibilite } from "@/lib/ui/visibilitePastille";

/**
 * V3.1-64 — « changer la visibilité de CET objet et le dire » : écrit par
 * `onChange` (qui met à jour l'écran aussitôt et le remet en place si le
 * serveur refuse, puis répond `true`/`false`), puis annonce le résultat avec
 * « Annuler » (qui rappelle `onChange` avec la valeur d'avant). Commun à la
 * pastille et au choix direct du menu ⋮.
 */
export function useChangerVisibilite({
  niveau,
  onChange,
  objet,
}: {
  niveau: string;
  onChange: (niveau: string) => Promise<boolean>;
  objet: string;
}): (suivant: string) => Promise<void> {
  const t = useTranslations("fiche.annonce");
  const annoncer = useAnnoncer();
  const qui = (n: string) => (isVisibilityLevelKey(n) ? t(`quiCourt.${n}`) : n);

  return async function changer(suivant: string) {
    const avant = niveau;
    const ok = await onChange(suivant);
    if (!annoncer) return;
    if (!ok) {
      annoncer({ texte: t("echec", { objet }) });
      return;
    }
    const a = annonceVisibilite(objet, avant, suivant);
    annoncer({
      texte: `${t("change", { objet: a.objet, qui: qui(a.niveau) })}${a.attention ? ` ${t("attention")}` : ""}`,
      annuler: async () => {
        const retablie_ok = await onChange(avant);
        annoncer(
          retablie_ok
            ? { texte: t("retablie", { objet, qui: qui(avant) }) }
            : { texte: t("echec", { objet }) },
        );
      },
    });
  };
}
