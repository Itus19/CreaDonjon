import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import { flouApercuPx, sommaireApercu, titreApercu } from "@/lib/ui/publication";

type CustomProperties = CSSProperties & Record<`--${string}`, string | number>;

/**
 * V3.1-60 — « Ce que voit un visiteur » : une maquette de la page d'accueil
 * publique, peinte avec ce que le MJ est en train de régler. Aucun appel
 * réseau : tout vient des props, l'aperçu suit chaque frappe et chaque clic.
 * Les jetons suivent le mode par `wiki-bg-scope` + `data-mode`, comme le fait
 * `BookSkin` pour la vraie page.
 */
export default function ApercuVisiteur({
  message,
  campaignName,
  publicTree,
  fond,
  mode,
  blur,
}: {
  message: string;
  campaignName: string;
  publicTree: EntityTreeGroup[];
  fond: { imageUrl: string; hue: number; chroma: number } | null;
  mode: string;
  blur: number;
}) {
  const t = useTranslations("publication.apercu");
  const titre = titreApercu(message, campaignName);
  const sommaire = sommaireApercu(publicTree);

  const pageStyle: CustomProperties | undefined = fond ? { "--h": fond.hue, "--c": fond.chroma } : undefined;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-[18px] border border-edge bg-panel-sunken">
        {fond && (
          <div
            aria-hidden="true"
            className="absolute -inset-4 bg-cover bg-center"
            style={{ backgroundImage: `url("${fond.imageUrl}")`, filter: `blur(${flouApercuPx(blur)}px)` }}
          />
        )}
        <div
          className={`relative flex min-h-64 flex-col gap-3 p-3 text-ink ${fond ? "wiki-bg-scope" : ""}`}
          data-mode={fond ? mode : undefined}
          style={pageStyle}
        >
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-chrome text-sm font-semibold">{campaignName}</span>
            <span aria-hidden="true" className="w-1/3 rounded-md border border-edge px-2 py-1 text-xs text-ink-muted">
              {t("rechercher")}
            </span>
          </div>
          <div className="flex flex-1 gap-3">
            <ul aria-hidden="true" className="m-0 flex w-1/4 min-w-0 list-none flex-col gap-2 p-0 text-xs text-ink-muted">
              {sommaire.map((noms, i) => (
                <li key={i}>
                  <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                    {noms.map((nom, j) => (
                      <li key={j} className="truncate">
                        {nom}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <p className="m-0 break-words text-center font-chrome text-xl font-semibold leading-tight">{titre}</p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="text-xs text-ink-muted">{t("legende")}</figcaption>
    </figure>
  );
}
