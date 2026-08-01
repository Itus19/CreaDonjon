/**
 * Signale les blocs requis absents d'une entree, sans jamais la rejeter
 * (specs/regles-blocs.md §5). Distinct du lisere `--gm` (secret MJ) et du
 * caviardage spoiler : ceci est un avertissement de completude, pas une
 * question de visibilite — un badge separe, teinte differemment.
 */
export default function MissingBlocksBanner({ missingBlocks }: { missingBlocks: string[] }) {
  if (missingBlocks.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-600/50 bg-amber-600/10 px-3 py-2 text-xs text-amber-500">
      Regle incomplete : bloc{missingBlocks.length > 1 ? "s" : ""} manquant
      {missingBlocks.length > 1 ? "s" : ""} — <span className="mech">{missingBlocks.join(", ")}</span>
    </div>
  );
}
