import { useTranslations } from "next-intl";

/**
 * Signale les blocs requis absents d'une entree, sans jamais la rejeter
 * (specs/regles-blocs.md §5). Distinct du lisere `--gm` (secret MJ) et du
 * caviardage spoiler : ceci est un avertissement de completude, pas une
 * question de visibilite — un badge separe, teinte differemment.
 */
export default function MissingBlocksBanner({ missingBlocks }: { missingBlocks: string[] }) {
  const t = useTranslations("regles");
  if (missingBlocks.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-600/50 bg-amber-600/10 px-3 py-2 text-xs text-amber-500">
      {t.rich("missingBlocks", {
        count: missingBlocks.length,
        list: missingBlocks.join(", "),
        mech: (chunks) => <span className="mech">{chunks}</span>,
      })}
    </div>
  );
}
