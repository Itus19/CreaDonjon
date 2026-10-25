"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import FilsPerles from "@/components/entities/psyche/FilsPerles";
import PortraitRelation from "@/components/entities/psyche/PortraitRelation";
import SouvenirsPsyche, { type SouvenirsPsycheHandle } from "@/components/entities/psyche/SouvenirsPsyche";
import { useWorldCalendar } from "@/components/shared/useWorldCalendar";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { RelationshipAxisKey } from "@/src/core/psyche/keys";
import { RELATIONSHIP_AXES_FR } from "@/src/i18n/fr";
import {
  axesAffiches,
  dateEnJeuValide,
  deuxDerniersSouvenirs,
  ligneJournal,
  resumeEnDirect,
  type SouvenirDAxe,
  type SouvenirDePaire,
  prenom,
} from "@/lib/ui/relationFace";

/** Ce que la route `relationship-face` rend (`src/server/services/relationshipFace.ts`). */
export interface FaceRelation {
  source: { id: string; name: string; slug: string; entityKind: string; hasPortrait: boolean };
  target: { id: string; name: string; slug: string; entityKind: string; hasPortrait: boolean } | null;
  campaignId: string | null;
  axes: Partial<Record<RelationshipAxisKey, number>>;
  souvenirs: { count: number; last: { occurredAtIngame: unknown; createdAt: string } | null };
  block: { id: string; knownAs: string } | null;
  canEditSource: boolean;
}

/**
 * V3.1-71 — le face-à-face d'UNE relation (la fiche envers sa cible, ou
 * l'inverse) : deux portraits, au milieu « X envers Y », le résumé en grand
 * (il suit la perle en direct pendant le glissé) et le nombre de souvenirs
 * (compté par le serveur) ; dessous un fil par axe, puis les souvenirs
 * repliables. Aucun nombre n'est écrit ici : seul le MJ voit un écart brut au
 * survol d'une perle.
 */
export default function VueRelation({
  face,
  worldSlug,
  isGm,
  onEcrit,
}: {
  face: FaceRelation;
  worldSlug: string;
  isGm: boolean;
  /** Une écriture a réussi : le parent relit la face (les compteurs viennent du serveur). */
  onEcrit: () => void;
}) {
  const t = useTranslations("fiche.relation");
  const calendrier = useWorldCalendar(worldSlug);
  const [axes, setAxes] = useState(face.axes);
  const [live, setLive] = useState<Partial<Record<RelationshipAxisKey, number>>>({});
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [journal, setJournal] = useState<SouvenirDePaire[] | null>(null);
  const journalDemandeRef = useRef(false);
  const souvenirsRef = useRef<SouvenirsPsycheHandle>(null);

  const cible = face.target;
  if (!cible) return <p className="text-sm italic text-ink-muted">{t("cibleIntrouvable")}</p>;

  const lecture = !face.canEditSource;
  const affiches = axesAffiches(cible.entityKind);
  const valeurs = { ...axes, ...live };
  const resume = resumeEnDirect(axes, live, affiches);
  const ligne = ligneJournal(
    face.souvenirs,
    (date) => formatGameDate(date, calendrier),
    (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }),
  );

  const urlJournal = `/api/entities/${face.source.id}/attitudes/${cible.id}/events`;

  async function chargerJournal() {
    const res = await fetch(urlJournal);
    if (!res.ok) {
      setErreur(t("erreurJournal"));
      journalDemandeRef.current = false;
      return;
    }
    setJournal((await res.json()) as SouvenirDePaire[]);
  }
  /** Le « pourquoi » demande le journal au premier survol, pas au chargement du bloc. */
  function demanderJournal() {
    if (journalDemandeRef.current) return;
    journalDemandeRef.current = true;
    void chargerJournal();
  }
  function oublierJournal() {
    journalDemandeRef.current = false;
    setJournal(null);
  }

  async function commitAxe(axe: RelationshipAxisKey, delta: number) {
    setOccupe(true);
    setErreur(null);
    const summary = t("reglageManuel", { pole: delta > 0 ? RELATIONSHIP_AXES_FR[axe].positive : RELATIONSHIP_AXES_FR[axe].negative });
    const res = await fetch(`/api/entities/${face.source.id}/attitude-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetEntityId: cible!.id, summary, deltas: { [axe]: delta }, occurredAtIngame: null }),
    });
    setOccupe(false);
    if (!res.ok) {
      const corps = (await res.json().catch(() => null)) as { error?: string } | null;
      setErreur(corps?.error ?? t("erreurAxe"));
      return;
    }
    const corps = (await res.json()) as { axes: Partial<Record<RelationshipAxisKey, number>> };
    setAxes(corps.axes);
    oublierJournal();
    souvenirsRef.current?.recharger();
    onEcrit();
  }

  function pourquoi(axe: RelationshipAxisKey): SouvenirDAxe[] | null {
    return journal === null ? null : deuxDerniersSouvenirs(journal, axe);
  }
  function formaterDate(s: SouvenirDAxe): string {
    const enJeu = dateEnJeuValide(s.occurredAtIngame);
    return enJeu
      ? formatGameDate(enJeu, calendrier)
      : new Date(s.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-center gap-3 pb-3">
        <div className="flex flex-col items-center gap-1">
          <PortraitRelation side={face.source} />
          <span className="mt-2 text-xs text-ink-muted">{t("ressent")}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 self-center text-center">
          <span className="text-xs text-ink-muted" title={t("titreFace", { source: face.source.name, cible: cible.name })}>
            {t("titreFace", { source: prenom(face.source.name), cible: prenom(cible.name) })}
          </span>
          <p role="status" className="font-display text-lg font-bold text-ink @md/bloc:text-2xl">
            {resume}
          </p>
          <span className="text-xs text-ink-muted">
            {ligne.cle === "aucun" ? t("journal.aucun") : t("journal.dernier", { n: ligne.n, date: ligne.date })}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <PortraitRelation side={cible} />
          <span className="mt-2 text-xs text-ink-muted">{t("enversCourt")}</span>
        </div>
      </div>

      {face.campaignId === null ? (
        <p className="text-sm italic text-ink-muted">{t("aucuneCampagne")}</p>
      ) : (
        <>
          <FilsPerles
            axes={affiches}
            valeurs={valeurs}
            onCommit={commitAxe}
            onLiveChange={(axe, valeur) =>
              setLive((prev) => {
                if (valeur === null) {
                  if (!(axe in prev)) return prev;
                  const suite = { ...prev };
                  delete suite[axe];
                  return suite;
                }
                return { ...prev, [axe]: valeur };
              })
            }
            occupe={occupe}
            lecture={lecture}
            valeurExacte={isGm}
            pourquoi={pourquoi}
            onPourquoi={demanderJournal}
            formaterDate={formaterDate}
          />
          {erreur && <p className="text-xs text-danger">{erreur}</p>}
          <SouvenirsPsyche
            genre="relation"
            entityId={face.source.id}
            targetEntityId={cible.id}
            worldSlug={worldSlug}
            valeursActuelles={axes}
            cles={affiches}
            lecture={lecture}
            onAxesChanged={(suite) => {
              setAxes(suite as Partial<Record<RelationshipAxisKey, number>>);
              oublierJournal();
              onEcrit();
            }}
            ref={souvenirsRef}
          />
        </>
      )}
    </div>
  );
}
