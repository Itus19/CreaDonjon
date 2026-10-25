"use client";

import { useTranslations } from "next-intl";
import { useChangerVisibilite } from "@/components/shared/useChangerVisibilite";
import {
  VISIBILITY_PILL_FALLBACK,
  VISIBILITY_PILL_STYLES,
  isVisibilityLevelKey,
} from "@/components/shared/visibilityOptions";
import { niveauSuivant } from "@/lib/ui/visibilitePastille";

/**
 * V3.1-64 — la pastille de visibilité : vert Public, bleu Joueurs, orange MJ,
 * gris Privé. Un toucher passe au niveau suivant du cycle (Public → Joueurs →
 * MJ → Privé → Public ; campagne et utilisateur passent à Public) et
 * l'annonce discrète de la fiche le dit, avec « Annuler ». Une seule pastille
 * pour les blocs, les événements de la Chronologie, les aspirations et la Carte.
 *
 * `onChange` met l'écran à jour tout de suite, écrit, remet l'ancienne valeur
 * si le serveur refuse, et répond `true` si l'écriture a réussi. `objet` est
 * le libellé cité dans l'annonce.
 */
export default function VisibilityPill({
  niveau,
  onChange,
  objet,
  sansPrive = false,
}: {
  niveau: string;
  onChange: (niveau: string) => Promise<boolean>;
  objet: string;
  /** Le lecteur n'est pas l'auteur : « Privé » (son auteur seul) est sauté. */
  sansPrive?: boolean;
}) {
  const t = useTranslations("fiche");
  const changer = useChangerVisibilite({ niveau, onChange, objet });
  const style = VISIBILITY_PILL_STYLES[niveau] ?? VISIBILITY_PILL_FALLBACK;
  const libelle = (n: string) =>
    isVisibilityLevelKey(n) ? t(`niveaux.${n}`) : n;
  const suivant = niveauSuivant(niveau, sansPrive);

  return (
    <button
      type="button"
      onClick={() => void changer(suivant)}
      aria-label={t("pastille", {
        niveau: libelle(niveau),
        suivant: libelle(suivant),
      })}
      title={isVisibilityLevelKey(niveau) ? t(`qui.${niveau}`) : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-panel-raised ${style.pill}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {libelle(niveau)}
    </button>
  );
}
