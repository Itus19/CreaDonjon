import MeteoScene from "@/components/solo/MeteoScene";
import type { QuestColumnEntry, SceneView } from "@/lib/solo/types";

/**
 * Le jeu à distance, côté MJ : la colonne gauche (option A), la scène telle
 * que le moteur la porte — lieu, météo, présents — et les quêtes actives.
 * Lecture seule : la scène se règle dans ses outils habituels.
 */
export default function ColonneSceneMj({ scene, quests }: { scene: SceneView | null; quests: QuestColumnEntry[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-edge bg-panel p-3">
      <section className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Scène</h3>
        {scene ? (
          <>
            <p className="font-semibold text-ink">{scene.locationName}</p>
            {scene.weather && <MeteoScene weather={scene.weather} className="text-sm text-ink-soft" />}
          </>
        ) : (
          <p className="text-sm text-ink-muted">Aucune scène posée.</p>
        )}
      </section>
      {scene && scene.present.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Présents</h3>
          {scene.present.map((p) => (
            <p key={p.entityId} className="rounded-md bg-panel-sunken px-2 py-1.5 text-sm text-ink">
              {p.name}
            </p>
          ))}
        </section>
      )}
      <section className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Quêtes actives</h3>
        {quests.length === 0 && <p className="text-sm text-ink-muted">Aucune quête active.</p>}
        {quests.map((q) => (
          <div key={q.id} className="rounded-md bg-panel-sunken px-2 py-1.5 text-sm">
            <p className="text-ink">{q.title}</p>
            {q.giverName && <p className="text-xs text-ink-muted">{q.giverName}</p>}
          </div>
        ))}
      </section>
    </div>
  );
}
