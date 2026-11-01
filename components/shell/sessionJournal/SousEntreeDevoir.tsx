import Link from "next/link";
import type { MentionDevoir } from "@/src/core/sessionJournal/devoir";

/** Ce que le rail reçoit du layout joueur (`getMyOpenDevoir`). */
export interface DevoirRail {
  mention: MentionDevoir;
  slug: string;
  dateEnJeu: string;
}

/**
 * Le devoir de journal sous « Édition » dans le rail joueur (V3.1-150,
 * piste A de l'esquisse). Deux états : « À rendre » (point doré) puis
 * « Rendu · à valider par le MJ » (coche verte). Une fois le devoir validé,
 * le layout ne le transmet plus : la sous-entrée disparaît.
 */
export default function SousEntreeDevoir({ devoir, href, actif }: { devoir: DevoirRail; href: string; actif: boolean }) {
  const aRendre = devoir.mention === "a_rendre";
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`ml-[22px] flex flex-col gap-0.5 rounded-r-xl border-l-2 py-1.5 pl-2.5 pr-2 transition-colors hover:bg-panel-raised ${
        aRendre ? "border-accent" : "border-success"
      } ${actif ? "bg-panel-raised" : ""}`}
    >
      <span className={`flex items-center gap-2 text-[12.5px] font-semibold ${aRendre ? "text-accent" : "text-ink"}`}>
        {aRendre ? (
          <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-accent" aria-hidden="true" />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="shrink-0 text-success" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
        Devoir de journal
      </span>
      <span className="truncate text-xs text-ink-muted">{aRendre ? `À rendre · ${devoir.dateEnJeu}` : "Rendu · à valider par le MJ"}</span>
    </Link>
  );
}
