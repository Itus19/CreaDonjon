"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Ce que le badge affiche, lu par le layout joueur (V3.1-62, C1). */
export interface ProchaineSession {
  /** Date de la prochaine seance (`YYYY-MM-DD`), `null` si aucune n'est fixee. */
  date: string | null;
  /** Une ronde de demande de disponibilites est ouverte et la joueuse n'y a pas repondu. */
  demandeEnAttente: boolean;
}

function formatSessionDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** « dim. 8 nov. » : la date qui tient debout dans le rail replié (V3.1-153). */
function formatSessionDateCourte(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function CalendarIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4" />
    </svg>
  );
}

/**
 * Lien "Prochaine session" (V2.1-4, recalibré V3.1-9, mène à une page depuis
 * V3.1-8 — jamais une fenêtre pop-up, retour utilisateur : "à l'image de ce
 * que le joueur peut voir pour les autres onglets"). Deux présentations du
 * même lien, pas deux composants : au téléphone, une icône + libellé court
 * comme les autres destinations de la barre du bas ; dans le rail, une ligne.
 *
 * V3.1-153 (esquisse du 2 novembre, proposition B + animation X) : rail
 * déplié, une ligne comme les autres (icône dorée, « Prochaine session »,
 * date en doré) ; rail replié, la même ligne se dresse — icône et date
 * courte à la verticale — au lieu de disparaître. Les deux présentations
 * sont posées l'une sur l'autre et se croisent en fondu pendant que le
 * rail change de largeur : le texte ne pivote jamais, il reste lisible.
 *
 * Pastille (V3.1-8) : dès qu'une ronde de demande est ouverte pour la
 * campagne et que la joueuse n'y a pas encore répondu.
 */
export default function NextSessionBadge({
  worldSlug,
  prochaineSession,
  replie = false,
}: {
  worldSlug: string;
  prochaineSession: ProchaineSession | null;
  /** Rail replié (V3.1-153) : la ligne se dresse. Sans effet au téléphone. */
  replie?: boolean;
}) {
  const pathname = usePathname();
  const href = `/m/${worldSlug}/joueur/prochaine-session`;
  const active = pathname === href;

  if (!prochaineSession) return null;

  const showBadge = prochaineSession.demandeEnAttente;
  const dateLongue = prochaineSession.date ? formatSessionDate(prochaineSession.date) : "à définir";
  const dateMoyenne = prochaineSession.date ? formatSessionDate(prochaineSession.date).replace(/^(\p{L}{3})\p{L}*/u, "$1.") : "à définir";
  const dateCourte = prochaineSession.date ? formatSessionDateCourte(prochaineSession.date) : "à définir";

  return (
    <>
      <Link
        href={href}
        className={`relative flex flex-col items-center gap-[clamp(0px,0.5vh,4px)] rounded-md px-2 py-2 text-[11px] transition-colors md:hidden ${
          active ? "text-accent" : "text-ink-muted hover:text-ink"
        }`}
      >
        <span className="relative block h-5 w-5 shrink-0">
          <CalendarIcon />
          {showBadge && <span aria-label="Une demande de disponibilités attend une réponse" className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-danger" />}
        </span>
        Session
      </Link>

      <Link
        href={href}
        aria-label={`Prochaine session : ${dateLongue}${showBadge ? " — une demande de disponibilités attend ta réponse" : ""}`}
        title={replie ? `Prochaine session : ${dateLongue}` : undefined}
        aria-current={active ? "page" : undefined}
        className={`relative hidden w-full rounded-xl text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink md:block ${active ? "bg-panel-raised" : ""}`}
      >
        {/* Déplié : une ligne du rail. Replié : effacée, hors du flux. */}
        <span
          aria-hidden="true"
          className={`flex items-center gap-[13px] px-2.5 py-[9px] transition-opacity motion-reduce:transition-none ${
            replie ? "pointer-events-none absolute inset-x-0 top-0 opacity-0 duration-150" : "opacity-100 delay-150 duration-200"
          }`}
        >
          <span className="relative block h-[18px] w-[18px] shrink-0 text-accent">
            <CalendarIcon />
            {showBadge && <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-danger" />}
          </span>
          <span className="flex min-w-0 flex-col whitespace-nowrap">
            <span className="text-[12.5px]">Prochaine session</span>
            <span className="truncate text-xs font-semibold text-accent">{dateMoyenne}</span>
          </span>
        </span>
        {/* Replié : l'icône et la date debout. Déplié : effacée, hors du flux. */}
        <span
          aria-hidden="true"
          className={`flex flex-col items-center gap-2 py-2.5 transition-opacity motion-reduce:transition-none ${
            replie ? "opacity-100 delay-150 duration-200" : "pointer-events-none absolute inset-x-0 top-0 opacity-0 duration-150"
          }`}
        >
          <span className="relative block h-[18px] w-[18px] shrink-0 text-accent">
            <CalendarIcon />
            {showBadge && <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-danger" />}
          </span>
          <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="whitespace-nowrap text-xs font-semibold text-accent">
            {dateCourte}
          </span>
        </span>
      </Link>
    </>
  );
}
