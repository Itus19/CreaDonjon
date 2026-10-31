"use client";

import { useTranslations } from "next-intl";
import type { SousEtape } from "@/lib/ui/cheminCreation";
import { toggleChoice } from "@/components/blocks/characterChoiceUtils";

/**
 * V3.1-49 — Le sélecteur d'une sous-étape, le même pour tous les genres de
 * choix : des cartes, un compteur « n / n », et ce qui est déjà acquis
 * ailleurs grisé. V3.1-118 le remplacera, genre par genre, par des
 * sélecteurs plus fins (dons filtrés, sorts unifiés de V3.1-50, effets des
 * options) ; d'ici là, il suffit à faire naître toute la cascade.
 */
export default function ChoixGenerique({
  sous,
  libelleOption,
  dejaAcquis,
  onChoisir,
}: {
  sous: SousEtape;
  /** Le libellé d'une option sans libellé dans la donnée (compétence, langue, caractéristique, arme). */
  libelleOption: (cle: string) => string;
  /** Les options déjà acquises par une autre source : visibles, grisées, non choisissables. */
  dejaAcquis: ReadonlySet<string>;
  onChoisir: (valeurs: string[]) => void;
}) {
  const t = useTranslations("creation");

  if (sous.impose) {
    return (
      <p className="text-sm text-ink-soft">
        {t("impose", { valeurs: sous.choisis.map((c) => sous.options.find((o) => o.cle === c)?.libelle ?? libelleOption(c)).join(", ") })}
      </p>
    );
  }

  if (sous.options.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-edge px-3 py-2 text-sm text-ink-muted">
        {sous.attend ? t("attendCompetences") : t("aucuneOption")}
      </p>
    );
  }

  const complet = sous.choisis.length >= sous.nombre;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        {sous.nombre > 1 ? t("choisirN", { n: sous.nombre }) : t("choisirUn")}{" "}
        <span className="font-semibold text-accent">{t("compte", { fait: sous.choisis.length, total: sous.nombre })}</span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
        {sous.options.map((o) => {
          const choisi = sous.choisis.includes(o.cle);
          const acquis = !choisi && dejaAcquis.has(o.cle);
          // Un choix à une seule valeur se remplace d'un clic ; à plusieurs, il se remplit jusqu'au compte.
          const bloque = acquis || (!choisi && complet && sous.nombre > 1);
          return (
            <button
              key={o.cle}
              type="button"
              aria-pressed={choisi}
              disabled={bloque}
              onClick={() => onChoisir(sous.nombre === 1 ? (choisi ? [] : [o.cle]) : toggleChoice(sous.choisis, o.cle, sous.nombre))}
              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                choisi ? "border-accent bg-accent/10 font-semibold text-accent" : "border-edge bg-panel-sunken text-ink hover:bg-panel-raised"
              }`}
            >
              {o.libelle ?? libelleOption(o.cle)}
              {o.description && <span className="text-xs font-normal text-ink-soft">{o.description}</span>}
              {acquis && <span className="text-xs font-normal text-ink-muted">{t("dejaAcquis")}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
