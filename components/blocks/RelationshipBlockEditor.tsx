"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import VueRelation, { type FaceRelation } from "@/components/entities/psyche/VueRelation";
import type { RelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";

/** Combien de fiches la liste de choix de la cible montre d'un coup (le filtre fait le reste). */
const MAX_PROPOSEES = 8;

/**
 * Choix de la cible : « Envers [cible ▾] ». Une liste avec filtre parmi les
 * fiches visibles du lecteur (`otherEntities`, déjà filtrées côté serveur),
 * quel que soit leur genre (personnage, faction, créature, lieu…).
 */
function ChoixCible({
  cibleId,
  autres,
  onChoisir,
}: {
  cibleId: string | null;
  autres: OtherEntityOption[];
  onChoisir: (id: string | null) => void;
}) {
  const t = useTranslations("fiche.relation");
  const [ouvert, setOuvert] = useState(false);
  const [filtre, setFiltre] = useState("");
  const courante = autres.find((e) => e.id === cibleId);
  const f = filtre.trim().toLowerCase();
  const trouvees = autres.filter((e) => f === "" || e.name.toLowerCase().includes(f)).slice(0, MAX_PROPOSEES);
  const genres = ENTITY_KIND_LABELS as Record<string, string>;

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-label={t("cibleLabel")}
        title={courante?.name}
        onClick={() => setOuvert(!ouvert)}
        className="flex max-w-[min(16rem,100%)] items-center gap-1 rounded-full border border-edge px-3 py-1 text-sm text-ink transition-colors hover:bg-panel-raised"
      >
        <span className="min-w-0 truncate">{courante ? courante.name : t("choisirCible")}</span> <span aria-hidden>▾</span>
      </button>
      {ouvert && (
        <div className="absolute left-0 top-full z-20 mt-1 flex w-72 max-w-[80vw] flex-col gap-1 rounded-xl border border-edge-strong bg-panel-raised p-2 shadow-2xl">
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder={t("recherche")}
            aria-label={t("rechercheLabel")}
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
          />
          {trouvees.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                onChoisir(e.id);
                setOuvert(false);
                setFiltre("");
              }}
              className="flex items-baseline gap-2 rounded-md px-2 py-1 text-left text-sm text-ink transition-colors hover:bg-panel"
            >
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              <small className="text-xs text-ink-muted">{genres[e.entity_kind] ?? e.entity_kind}</small>
            </button>
          ))}
          {trouvees.length === 0 && <p className="px-2 py-1 text-xs italic text-ink-muted">{t("aucuneFiche")}</p>}
          {cibleId && (
            <button
              type="button"
              onClick={() => {
                onChoisir(null);
                setOuvert(false);
              }}
              className="rounded-md px-2 py-1 text-left text-xs text-ink-muted transition-colors hover:bg-panel hover:text-ink"
            >
              {t("aucuneCible")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Sens = "direct" | "inverse";

/**
 * Bloc `relationship` (V2-H1, refait en V3.1-71 « A ») : la ligne du haut
 * (« Envers [cible ▾] », « Le connaît comme »), le face-à-face (deux
 * portraits, au milieu le résumé qui suit la perle), un fil à perle par axe,
 * les souvenirs repliables. « ⇄ Voir l'autre sens » montre le bloc de la cible
 * envers la fiche, s'il existe et si le lecteur le voit ; sinon une case
 * pointillée, et « Créer ce bloc » seulement si le lecteur peut écrire sur la
 * cible. Les valeurs ne vivent PAS dans le bloc (`entity_attitudes`, portée
 * campagne, ADR 0013) : le bloc ne porte que la cible et `knownAs`.
 *
 * Une seule lecture au chargement (`relationship-face`, C1) ; le sens inverse
 * appelle la MÊME route, sens échangé, au premier clic seulement.
 */
export default function RelationshipBlockEditor({
  entityId,
  worldSlug,
  data,
  otherEntities,
  onChange,
  isGm = false,
}: {
  entityId: string;
  worldSlug: string;
  data: RelationshipBlockData;
  otherEntities: OtherEntityOption[];
  onChange: (data: RelationshipBlockData) => void;
  /** Le MJ voit un écart brut au survol d'une perle ; un joueur n'en voit jamais. */
  isGm?: boolean;
}) {
  const t = useTranslations("fiche.relation");
  const targetId = data.target?.kind === "entity" ? data.target.id : null;
  const [faceDirecte, setFaceDirecte] = useState<{ pour: string; face: FaceRelation | null } | null>(null);
  const [faceInverse, setFaceInverse] = useState<{ pour: string; face: FaceRelation | null } | null>(null);
  const [sens, setSens] = useState<Sens>("direct");
  const [erreur, setErreur] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  /** Lit la face ; ne touche à aucun état (elle sert aussi dans un effet) : l'appelant range le résultat. */
  async function lireFace(sourceId: string, cibleId: string): Promise<{ face: FaceRelation | null; erreur: string | null }> {
    try {
      const res = await fetch(`/api/entities/${sourceId}/relationship-face?targetId=${cibleId}`);
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        return { face: null, erreur: corps?.error ?? t("erreurChargement") };
      }
      return { face: ((await res.json()) as { face: FaceRelation }).face, erreur: null };
    } catch (e) {
      console.error("Lecture du face-à-face impossible", e);
      return { face: null, erreur: t("erreurChargement") };
    }
  }

  // Une seule lecture au chargement (et au changement de cible) : le sens direct.
  useEffect(() => {
    if (!targetId) return;
    let annule = false;
    void lireFace(entityId, targetId).then(({ face, erreur: e }) => {
      if (annule) return;
      setFaceDirecte({ pour: targetId, face });
      setErreur(e);
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, targetId]);

  function choisirCible(id: string | null) {
    setSens("direct");
    setFaceInverse(null);
    onChange({ ...data, target: id === null ? null : { kind: "entity", id } });
  }

  async function rafraichir(quel: Sens) {
    if (!targetId) return;
    const lu = quel === "direct" ? await lireFace(entityId, targetId) : await lireFace(targetId, entityId);
    (quel === "direct" ? setFaceDirecte : setFaceInverse)({ pour: targetId, face: lu.face });
    setErreur(lu.erreur);
  }

  async function basculerSens() {
    if (!targetId) return;
    const suivant: Sens = sens === "direct" ? "inverse" : "direct";
    setSens(suivant);
    if (suivant === "inverse" && faceInverse?.pour !== targetId) await rafraichir("inverse");
  }

  async function creerBlocInverse() {
    if (!targetId || creation) return;
    setCreation(true);
    setErreur(null);
    try {
      const creer = await fetch(`/api/entities/${targetId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: targetId,
          blockType: "relationship",
          label: t("titreBloc"),
          visibility: { level: "public", scopeId: null },
        }),
      });
      if (!creer.ok) {
        const corps = (await creer.json().catch(() => null)) as { error?: string } | null;
        setErreur(corps?.error ?? t("erreurCreation"));
        return;
      }
      const bloc = (await creer.json()) as { id: string; version: number; display: unknown };
      const remplir = await fetch(`/api/blocks/${bloc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: bloc.version,
          display: bloc.display,
          data: { __v: 1, target: { kind: "entity", id: entityId }, knownAs: "", historyVisible: 20 },
          visibility: { level: "public", scopeId: null },
        }),
      });
      if (!remplir.ok) {
        const corps = (await remplir.json().catch(() => null)) as { error?: string } | null;
        setErreur(corps?.error ?? t("erreurCreation"));
        return;
      }
      await rafraichir("inverse");
    } finally {
      setCreation(false);
    }
  }

  const direct = faceDirecte && faceDirecte.pour === targetId ? faceDirecte.face : null;
  const inverse = faceInverse && faceInverse.pour === targetId ? faceInverse.face : null;
  const chargeDirect = faceDirecte !== null && faceDirecte.pour === targetId;
  const chargeInverse = faceInverse !== null && faceInverse.pour === targetId;
  const autres = otherEntities.filter((e) => e.id !== entityId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 max-w-full items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("envers")}</span>
          <ChoixCible cibleId={targetId} autres={autres} onChoisir={choisirCible} />
        </div>
        <label className="flex min-w-48 flex-1 items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("connuComme")}</span>
          <input
            value={data.knownAs}
            onChange={(e) => onChange({ ...data, knownAs: e.target.value })}
            placeholder={t("connuCommePlaceholder")}
            className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
      </div>

      {!targetId && <p className="text-sm italic text-ink-muted">{t("choisirPourRegler")}</p>}
      {targetId && sens === "direct" && !chargeDirect && !erreur && <p className="text-sm text-ink-muted">{t("chargement")}</p>}
      {erreur && <p className="text-xs text-danger">{erreur}</p>}

      {targetId && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void basculerSens()}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
          >
            {sens === "direct" ? t("voirAutreSens") : t("revenirSensDirect")}
          </button>
        </div>
      )}

      {targetId && sens === "direct" && direct && (
        <VueRelation
          key={`${direct.source.id}>${direct.target?.id ?? ""}`}
          face={direct}
          worldSlug={worldSlug}
          isGm={isGm}
          onEcrit={() => void rafraichir("direct")}
        />
      )}

      {targetId && sens === "inverse" && !chargeInverse && !erreur && <p className="text-sm text-ink-muted">{t("chargement")}</p>}
      {targetId && sens === "inverse" && inverse && inverse.block && (
        <VueRelation
          key={`${inverse.source.id}>${inverse.target?.id ?? ""}`}
          face={inverse}
          worldSlug={worldSlug}
          isGm={isGm}
          onEcrit={() => void rafraichir("inverse")}
        />
      )}
      {targetId && sens === "inverse" && inverse && !inverse.block && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-edge-strong p-4 text-center">
          <p className="text-sm text-ink-soft">
            {t("inverseAbsent", { cible: inverse.source.name, fiche: inverse.target?.name ?? "" })}
          </p>
          {inverse.canEditSource && (
            <button
              type="button"
              aria-busy={creation}
              onClick={() => void creerBlocInverse()}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              {t("creerBloc")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
