"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useModalKeyboard } from "@/components/shared/useModalKeyboard";
import { derniereSeanceJouee, prochaineSeance, registre, type DevoirLivre, type LigneRegistre, type SeanceReelle } from "@/lib/ui/livreDeSessions";
import { nextWriter } from "@/src/core/sessionJournal/nextWriter";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import FeuilleAssigner, { type Redactrice } from "./FeuilleAssigner";
import LectureDevoir, { PastilleEtat, type DonneesLecture } from "./LectureDevoir";

interface Assignment {
  id: string;
  ingame_date: GameDate;
  assigned_to: string;
  status: string;
  entity_id: string | null;
  entity_name: string | null;
  entity_slug: string | null;
  created_at: string;
  written_at: string | null;
}

/** Un devoir dont l'état est rétréci : tout ce qui n'est pas « rédigé » est en attente. */
type Devoir = DevoirLivre & { ingame_date: GameDate };

/** Largeur du panneau (px) sous laquelle la lecture passe en panneau par-dessus (tablette, téléphone). */
const LARGEUR_COLONNE_PX = 896;

const VERRE = "rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)]";

function blankDate(calendar: CalendarConfigInput): GameDate {
  return calendar.currentDate ?? { year: 0, month: 1, day: 1, precision: "day", end: null, label: null };
}

function jourCourt(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function libelleSeance(s: SeanceReelle | null): string {
  return s ? `séance du ${jourCourt(s.scheduled_date)}` : "—";
}

function libelleProchaine(s: SeanceReelle): string {
  return new Date(`${s.scheduled_date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Panneau MJ "Livre de sessions" (V3.1-43) : le registre des devoirs, une
 * ligne par devoir et une par séance réelle passée sans devoir. En tête, la
 * prochaine séance et « Assigner le devoir ». Une ligne s'ouvre en lecture
 * (colonne de droite, ou panneau par-dessus quand le conteneur est étroit).
 * La fiche elle-même n'est normalement écrite que par l'autrice assignée,
 * SAUF quand le MJ se l'attribue (il rédige alors le titre ici, puis rejoint
 * l'édition normale de la fiche créée).
 */
export default function SessionJournalMjPanel({
  campaignId,
  worldSlug,
  currentUserId,
  initialCalendar,
}: {
  campaignId: string;
  worldSlug: string;
  currentUserId: string;
  initialCalendar: CalendarConfigInput;
}) {
  const router = useRouter();
  const [roster, setRoster] = useState<Redactrice[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [seances, setSeances] = useState<SeanceReelle[]>([]);
  const [maintenant] = useState(() => Date.now());
  const [etroit, setEtroit] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [feuille, setFeuille] = useState(false);
  const [ingameDate, setIngameDate] = useState<GameDate>(() => blankDate(initialCalendar));
  const [choix, setChoix] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurFeuille, setErreurFeuille] = useState<string | null>(null);
  const [aAnnuler, setAAnnuler] = useState<string | null>(null);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const [writing, setWriting] = useState<Assignment | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const racineRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalKeyboard({ open: writing !== null, onClose: () => setWriting(null), panelRef });

  // Largeur du conteneur (pas de la fenêtre) : la fenêtre MJ peut être étroite sur un grand écran.
  useEffect(() => {
    const racine = racineRef.current;
    if (!racine) return;
    const observateur = new ResizeObserver(([e]) => setEtroit(e.contentRect.width < LARGEUR_COLONNE_PX));
    observateur.observe(racine);
    return () => observateur.disconnect();
  }, []);

  function loadRoster() {
    fetch(`/api/campaigns/${campaignId}/session-journal/roster`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { roster: Redactrice[] }) => setRoster(body.roster))
      .catch((erreur) => console.error("Chargement du roster du journal impossible", erreur));
  }

  function loadAssignments() {
    fetch(`/api/campaigns/${campaignId}/session-journal/assignments`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { assignments: Assignment[]; realSessions: SeanceReelle[] }) => {
        setAssignments(body.assignments);
        setSeances(body.realSessions);
      })
      .catch((erreur) => console.error("Chargement des attributions du journal impossible", erreur));
  }

  useEffect(loadRoster, [campaignId]);
  useEffect(loadAssignments, [campaignId]);

  const devoirs: Devoir[] = assignments.map((a) => ({ ...a, status: a.status === "written" ? "written" : "pending" }));
  const lignes: LigneRegistre<Devoir>[] = registre(devoirs, seances, maintenant);
  const nomDe = new Map(roster.map((r) => [r.userId, r.name]));
  // « À qui le tour » ne propose d'office qu'une joueuse ; le MJ seulement s'il n'y en a aucune (il reste choisissable).
  const joueuses = roster.filter((r) => r.role === "player");
  const suggeree = nextWriter(
    (joueuses.length > 0 ? joueuses : roster).map((r) => ({ userId: r.userId, name: r.name ?? "" })),
    devoirs.map((d) => ({ assignedTo: d.assigned_to, status: d.status, writtenAt: d.written_at }))
  );
  const choisie = choix ?? suggeree ?? roster[0]?.userId ?? "";
  const prochaine = prochaineSeance(seances, maintenant);
  const derniere = derniereSeanceJouee(seances, maintenant);
  const ligneOuverte = lignes.find((l) => l.cle === ouverte && l.devoir) ?? null;

  function ouvrirFeuille() {
    setIngameDate(blankDate(initialCalendar));
    setChoix(null);
    setErreurFeuille(null);
    setFeuille(true);
  }

  function assign() {
    if (!choisie) return;
    setEnvoi(true);
    setErreurFeuille(null);
    fetch(`/api/campaigns/${campaignId}/session-journal/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingameDate, assignedTo: choisie }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Impossible d'assigner le devoir.");
        setFeuille(false);
        loadAssignments();
      })
      .catch((err: Error) => setErreurFeuille(err.message))
      .finally(() => setEnvoi(false));
  }

  function cancel(id: string) {
    setAAnnuler(null);
    fetch(`/api/campaigns/${campaignId}/session-journal/assignments/${id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error("Impossible d'annuler le devoir.");
        setOuverte(null);
        setErreurListe(null);
        loadAssignments();
      })
      .catch((err: Error) => setErreurListe(err.message));
  }

  function clic(ligne: LigneRegistre<Devoir>) {
    if (ligne.devoir) setOuverte(ligne.cle);
    else ouvrirFeuille();
  }

  function openWriting(a: Assignment) {
    setWriting(a);
    setTitle("");
    setError(null);
  }

  function submitWriting() {
    if (!writing) return;
    if (title.trim() === "") {
      setError("Un titre est requis.");
      return;
    }
    setSubmitting(true);
    fetch(`/api/worlds/${worldSlug}/session-journal/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: writing.id, title }),
    })
      .then((res) => (res.ok ? res.json() : res.json().then((b) => Promise.reject(new Error(b.error)))))
      .then((body: { slug: string }) => {
        setWriting(null);
        router.push(`/m/${worldSlug}/f/${body.slug}`);
      })
      .catch((err: Error) => {
        setError(err.message || "Impossible de créer l'entrée.");
        setSubmitting(false);
      });
  }

  function donneesLecture(l: LigneRegistre<Devoir>): DonneesLecture {
    const d = l.devoir as Devoir;
    return {
      titre: d.entity_name ?? formatGameDate(d.ingame_date, initialCalendar),
      dateEnJeu: formatGameDate(d.ingame_date, initialCalendar),
      autrice: nomDe.get(d.assigned_to) ?? "?",
      seance: libelleSeance(l.seance),
      etat: l.etat,
      lien: d.entity_slug ? `/m/${worldSlug}/f/${d.entity_slug}` : null,
      peutEcrire: d.assigned_to === currentUserId,
    };
  }

  function lecture(l: LigneRegistre<Devoir>, surFeuille: boolean) {
    const d = l.devoir as Devoir;
    return (
      <LectureDevoir
        donnees={donneesLecture(l)}
        onFermer={surFeuille ? undefined : () => setOuverte(null)}
        onEcrire={() => openWriting(assignments.find((a) => a.id === d.id) as Assignment)}
        onAnnuler={() => setAAnnuler(d.id)}
      />
    );
  }

  return (
    <div ref={racineRef} className="@container flex flex-col gap-4">
      <div className={`${VERRE} flex flex-wrap items-center gap-3 px-4 py-3`}>
        <span className="text-sm text-ink">
          Prochaine séance : <span className="font-semibold">{prochaine ? libelleProchaine(prochaine) : "à définir"}</span>
        </span>
        <button type="button" onClick={ouvrirFeuille} className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover">
          Assigner le devoir
        </button>
      </div>
      {erreurListe && <p className="text-xs text-danger">{erreurListe}</p>}

      <div className={ligneOuverte && !etroit ? "grid grid-cols-[minmax(0,1fr)_22rem] gap-4" : "grid grid-cols-1 gap-4"}>
        <div className={`${VERRE} @container flex min-w-0 flex-col p-2`}>
          <div className="hidden grid-cols-[7rem_minmax(0,1fr)_auto] gap-3 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted @xl:grid @2xl:grid-cols-[9rem_minmax(0,1fr)_10rem_8rem_7rem]">
            <span>Date en jeu</span>
            <span>Titre</span>
            <span className="hidden @2xl:block">Rédigé par</span>
            <span className="hidden @2xl:block">Séance</span>
            <span>État</span>
          </div>
          {lignes.length === 0 && <p className="px-3 py-2 text-xs italic text-ink-muted">Aucun devoir pour l&apos;instant.</p>}
          {lignes.map((l) => {
            const d = l.devoir;
            const date = d ? formatGameDate(d.ingame_date, initialCalendar) : "—";
            const titre = d?.entity_name ?? "—";
            const actif = ouverte === l.cle;
            return (
              <button
                key={l.cle}
                type="button"
                onClick={() => clic(l)}
                aria-current={actif ? "true" : undefined}
                className={`grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-panel-raised @xl:grid-cols-[7rem_minmax(0,1fr)_auto] @2xl:grid-cols-[9rem_minmax(0,1fr)_10rem_8rem_7rem] ${actif ? "bg-panel-raised" : ""}`}
              >
                <span className="truncate text-ink">{date}</span>
                <span className="truncate text-ink">{titre}</span>
                <span className="hidden truncate text-ink-soft @2xl:block">{d ? (nomDe.get(d.assigned_to) ?? "?") : "—"}</span>
                <span className="hidden truncate text-ink-muted @2xl:block">{libelleSeance(l.seance)}</span>
                <span>
                  <PastilleEtat etat={l.etat} />
                </span>
              </button>
            );
          })}
        </div>

        {ligneOuverte && !etroit && <aside className={`${VERRE} p-4`}>{lecture(ligneOuverte, false)}</aside>}
      </div>

      {ligneOuverte && etroit && (
        <FeuilleDuBas titre="Livre de sessions" onFermer={() => setOuverte(null)}>
          <div className="p-4">{lecture(ligneOuverte, true)}</div>
        </FeuilleDuBas>
      )}

      {feuille && (
        <FeuilleAssigner
          etroit={etroit}
          calendrier={initialCalendar}
          libelleSeance={derniere ? libelleSeance(derniere) : null}
          dateEnJeu={ingameDate}
          onDateEnJeu={setIngameDate}
          roster={roster}
          choisie={choisie}
          suggeree={suggeree}
          onChoisir={setChoix}
          envoi={envoi}
          erreur={erreurFeuille}
          onEnvoyer={assign}
          onFermer={() => setFeuille(false)}
        />
      )}

      <ConfirmDialog
        open={aAnnuler !== null}
        title="Annuler le devoir"
        message="Le devoir en attente sera retiré. Cette action ne peut pas être défaite."
        confirmLabel="Annuler le devoir"
        cancelLabel="Garder"
        danger
        onConfirm={() => aAnnuler && cancel(aAnnuler)}
        onCancel={() => setAAnnuler(null)}
      />

      {writing &&
        createPortal(
          <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-scrim" onClick={() => setWriting(null)} role="dialog" aria-modal="true" aria-label="Rédiger l'entrée">
            <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border border-edge-strong bg-panel-raised p-4 shadow-2xl outline-none">
              <h2 className="mb-2 text-sm font-semibold text-ink">Titre de l&apos;entrée</h2>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                placeholder="Ce que le Grelot Fêlé a vu passer"
                className="w-full rounded border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                autoFocus
              />
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setWriting(null)} className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted hover:bg-panel">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitWriting}
                  disabled={submitting}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                >
                  Créer et rédiger
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
