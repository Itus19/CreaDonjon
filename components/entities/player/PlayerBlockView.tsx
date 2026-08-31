import type { VisibleBlock } from "@/src/server/services/blocks";
import type { MusicBlockData } from "@/src/core/schemas/blocks/music";
import AutoPlayMusicBlock from "./AutoPlayMusicBlock";

/**
 * Rendu en lecture seule d'un bloc, pour la coquille joueur (V2-M7b) —
 * jamais `EntityBlocks.tsx` (editable, affiche ses boutons a quiconque
 * charge la page, l'ecriture serveur etant le seul vrai garde). Premiere
 * tranche : `text`/`infobox`/`image`, memes trois types que `PublicBlockView`
 * (partage anonyme) couvrait deja — les autres (`character`, `inventory`,
 * `statblock`...) affichent un repli explicite plutot qu'un rendu absent
 * silencieusement. Source des blocs : `listVisibleBlocks` (deja filtre par
 * la vraie visibilite du joueur, jamais celle, plus etroite, du partage
 * public).
 */
export default function PlayerBlockView({ block }: { block: VisibleBlock }) {
  const label = (block.display as { label?: string } | null)?.label;

  return (
    <div className="flex flex-col gap-1.5 border-b border-edge/40 pb-3 last:border-0">
      {label && <h3 className="text-sm font-semibold text-ink">{label}</h3>}
      {renderContent(block)}
    </div>
  );
}

function renderContent(block: VisibleBlock) {
  switch (block.blockType) {
    case "text": {
      const segments = (block.data as { segments?: { blockType: string; content?: { t: string; v?: string }[] }[] })?.segments ?? [];
      if (segments.length === 0) return <p className="text-sm text-ink-muted">Vide.</p>;
      return (
        <div className="flex flex-col gap-1.5">
          {segments.map((seg, i) => {
            const text = (seg.content ?? []).filter((n) => n.t === "text").map((n) => n.v ?? "").join("");
            const Tag = (["h1", "h2", "h3", "h4"] as string[]).includes(seg.blockType) ? "h4" : "p";
            return (
              <Tag key={i} className={Tag === "h4" ? "text-sm font-semibold text-ink" : "whitespace-pre-wrap text-sm text-ink-soft"}>
                {text}
              </Tag>
            );
          })}
        </div>
      );
    }
    case "infobox": {
      const entries = (block.data as { entries?: { label: string; value: string }[] })?.entries ?? [];
      return (
        <table className="w-full text-sm">
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="border-b border-edge/30 last:border-0">
                <td className="py-1 pr-3 text-ink-muted">{e.label}</td>
                <td className="py-1 text-ink-soft">{e.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "image": {
      const data = block.data as { url?: string; caption?: string };
      if (!data.url) return null;
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.url} alt={data.caption ?? ""} className="max-w-full rounded-md" />
          {data.caption && <figcaption className="mt-1 text-xs text-ink-muted">{data.caption}</figcaption>}
        </figure>
      );
    }
    case "music": {
      const track = (block.data as MusicBlockData).tracks[0];
      if (!track) return null;
      return (
        <>
          <p className="text-xs text-ink-muted">♪ {track.title ?? "Ambiance"}</p>
          <AutoPlayMusicBlock blockId={block.id} trackId={track.id} trackUrl={track.url} />
        </>
      );
    }
    default:
      return <p className="text-xs text-ink-muted">Ce type de bloc n&apos;a pas encore de vue simplifiée.</p>;
  }
}
