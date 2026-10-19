import GmJournalPanel from "@/components/shell/GmJournalPanel";
import DeletedEntitiesPanel from "@/components/shell/DeletedEntitiesPanel";

/**
 * Le journal d'historique et les fiches supprimées, côte à côte — même
 * disposition dans la page et dans la fenêtre d'outil (V3.1-143). La bascule
 * suit la largeur du CONTENEUR (requête de conteneur, 64rem), pas celle de
 * l'écran : un volet partagé prend la disposition étroite. Étroit : une
 * colonne, les fiches supprimées en bas, le journal garde une hauteur propre
 * et défile en dedans. Large : le journal à gauche, la corbeille à droite.
 */
export default function JournalEtCorbeille({ worldSlug }: { worldSlug: string }) {
  return (
    <div className="@container flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto @5xl:flex-row @5xl:overflow-visible">
        <div className="h-[75dvh] shrink-0 @5xl:h-auto @5xl:min-h-0 @5xl:flex-[2] @5xl:shrink">
          <GmJournalPanel worldSlug={worldSlug} />
        </div>
        <div className="shrink-0 @5xl:min-h-0 @5xl:flex-1 @5xl:shrink">
          <DeletedEntitiesPanel worldSlug={worldSlug} />
        </div>
      </div>
    </div>
  );
}
