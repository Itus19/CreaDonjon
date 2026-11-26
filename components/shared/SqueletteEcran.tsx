import { useTranslations } from "next-intl";

/**
 * AG-23 — squelette d'un écran d'outil ou de règle, pendant que la page charge
 * (règle C6 de docs/CABLAGE.md). Même principe que `WikiFicheSkeleton` : la
 * coquille et la barre latérale restent montées par le layout, seul le
 * contenu est esquissé. On n'esquisse que ce que tout écran possède : un
 * titre, une ligne d'aide, puis quelques rangées. Aucune valeur provisoire.
 * `animate-pulse` suit déjà `prefers-reduced-motion` (tokens.css).
 */
const RANGEES = ["100%", "92%", "96%", "78%"];

export default function SqueletteEcran() {
  const t = useTranslations("squelette");
  return (
    <div role="status" aria-label={t("ecran")} className="flex animate-pulse flex-col gap-4 p-1">
      <div className="h-7 w-1/3 rounded-md bg-panel-raised" aria-hidden="true" />
      <div className="h-3.5 w-1/2 rounded-md bg-panel" aria-hidden="true" />
      <div className="mt-2 flex flex-col gap-3">
        {RANGEES.map((largeur, i) => (
          <div key={i} className="h-10 rounded-md bg-panel" style={{ width: largeur }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
