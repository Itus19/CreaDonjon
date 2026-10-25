"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import WorldviewRadar from "@/components/entities/psyche/WorldviewRadar";
import PoleBars from "@/components/entities/psyche/PoleBars";
import SouvenirsPsyche, { type SouvenirsPsycheHandle } from "@/components/entities/psyche/SouvenirsPsyche";
import { WORLDVIEW_POLE_KEYS, type WorldviewPoleKey } from "@/src/core/psyche/keys";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import { WORLDVIEW_POLE_DESCRIPTIONS_FR, WORLDVIEW_POLES_FR } from "@/src/i18n/fr";
import { poleVise, tensionAffichee } from "@/lib/ui/psycheBloc";

/** Une fiche à comparer, telle que la route `worldview-comparisons` la rend (déjà filtrée par la visibilité du lecteur). */
interface Comparaison {
  entityId: string;
  name: string;
  slug: string;
  poles: { key: WorldviewPoleKey; value: number }[];
}

/** Délai d'attente avant de lancer la recherche « Autre… » (une requête par pause de frappe, pas par lettre). */
const DELAI_RECHERCHE_MS = 300;

/**
 * Bloc `worldview` (V2-H1, refait en V3.1-70) : le même dessin que la
 * Personnalité — radar avec la bande nommée à chaque sommet, sept barres
 * bipolaires, souvenirs repliables — sans ★ ni aspirations. « Comparer avec »
 * pose une fiche (les factions liées, ou « Autre… » par recherche) en
 * pointillé bleu sur le radar et en trait bleu sur chaque barre ; à 3 crans
 * d'écart au moins, une phrase le dit en orange. Le choix est un état
 * d'affichage, jamais enregistré ; la liste n'est demandée qu'à l'ouverture
 * du sélecteur.
 */
export default function WorldviewBlockEditor({
  blockId,
  version,
  entityId,
  worldSlug,
  data,
  onBlockRefreshed,
  isGm = false,
}: {
  blockId: string;
  version: number;
  entityId: string;
  worldSlug: string;
  data: WorldviewBlockData;
  onChange: (data: WorldviewBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** Le MJ voit la valeur exacte d'un pôle au survol ; un joueur n'en voit jamais. */
  isGm?: boolean;
}) {
  const t = useTranslations("fiche.psyche");
  const [sliderPending, setSliderPending] = useState(false);
  const [sliderError, setSliderError] = useState<string | null>(null);
  const souvenirsRef = useRef<SouvenirsPsycheHandle>(null);
  const [liveOverride, setLiveOverride] = useState<Partial<Record<WorldviewPoleKey, number>>>({});

  const [selecteurOuvert, setSelecteurOuvert] = useState(false);
  const [factions, setFactions] = useState<Comparaison[] | null>(null);
  const [choisie, setChoisie] = useState<Comparaison | null>(null);
  const [autre, setAutre] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Comparaison[] | null>(null);
  const [erreurComparer, setErreurComparer] = useState<string | null>(null);
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requeteRef = useRef(0);

  function handleLiveChange(key: WorldviewPoleKey, value: number | null) {
    setLiveOverride((prev) => {
      if (value === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }

  const radarPoles = data.poles.map((p) => ({ ...p, value: liveOverride[p.key] ?? p.value }));

  async function commitSlider(key: WorldviewPoleKey, delta: number) {
    setSliderPending(true);
    setSliderError(null);
    const summary = t("reglageManuel", { pole: poleVise(WORLDVIEW_POLES_FR[key], delta) });
    const res = await fetch(`/api/blocks/${blockId}/worldview-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, summary, deltas: { [key]: delta }, occurredAtIngame: null }),
    });
    setSliderPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSliderError(body?.error ?? t("erreurPole"));
      return;
    }
    const body = (await res.json()) as { block: { id: string; data: unknown; version: number } };
    onBlockRefreshed(body.block);
    souvenirsRef.current?.recharger();
  }

  async function lireComparaisons(q?: string): Promise<Comparaison[] | null> {
    try {
      const url = `/api/entities/${entityId}/worldview-comparisons${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        setErreurComparer(t("comparer.erreur"));
        return null;
      }
      setErreurComparer(null);
      return ((await res.json()) as { comparisons: Comparaison[] }).comparisons;
    } catch (erreur) {
      console.error("Chargement des fiches à comparer impossible", erreur);
      setErreurComparer(t("comparer.erreur"));
      return null;
    }
  }

  // Les factions ne sont demandées qu'à la première ouverture du sélecteur.
  async function basculerSelecteur() {
    const suivant = !selecteurOuvert;
    setSelecteurOuvert(suivant);
    if (suivant && factions === null) setFactions(await lireComparaisons());
  }

  function chercher(texte: string) {
    setRecherche(texte);
    if (minuteurRef.current) clearTimeout(minuteurRef.current);
    if (texte.trim().length < 2) {
      requeteRef.current += 1;
      setResultats(null);
      return;
    }
    minuteurRef.current = setTimeout(async () => {
      const numero = ++requeteRef.current;
      const trouves = await lireComparaisons(texte.trim());
      // Une réponse plus ancienne que la dernière frappe est ignorée.
      if (numero === requeteRef.current) setResultats(trouves);
    }, DELAI_RECHERCHE_MS);
  }

  function choisir(comparaison: Comparaison | null) {
    setChoisie(comparaison);
    setAutre(false);
  }

  const superposition = choisie ? Object.fromEntries(choisie.poles.map((p) => [p.key, p.value])) : null;
  const tension = choisie ? tensionAffichee(radarPoles, choisie.poles) : null;

  const pastille = (actif: boolean) =>
    `rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
      actif ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("comparer.titre")}</span>
          <button
            type="button"
            aria-expanded={selecteurOuvert}
            onClick={() => void basculerSelecteur()}
            className={pastille(choisie !== null)}
          >
            {choisie ? choisie.name : t("comparer.personne")} <span aria-hidden>{selecteurOuvert ? "▴" : "▾"}</span>
          </button>
        </div>
        {selecteurOuvert && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" aria-pressed={choisie === null} onClick={() => choisir(null)} className={pastille(choisie === null)}>
                {t("comparer.personne")}
              </button>
              {(factions ?? []).map((f) => (
                <button
                  key={f.entityId}
                  type="button"
                  aria-pressed={choisie?.entityId === f.entityId}
                  onClick={() => choisir(f)}
                  className={pastille(choisie?.entityId === f.entityId)}
                >
                  {f.name}
                </button>
              ))}
              <button type="button" aria-pressed={autre} onClick={() => setAutre(!autre)} className={pastille(autre)}>
                {t("comparer.autre")}
              </button>
            </div>
            {autre && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-edge bg-panel-sunken p-2.5">
                <input
                  value={recherche}
                  onChange={(e) => chercher(e.target.value)}
                  placeholder={t("comparer.recherchePlaceholder")}
                  aria-label={t("comparer.rechercheLabel")}
                  className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
                />
                {resultats !== null && resultats.length === 0 && (
                  <p className="text-xs italic text-ink-muted">{t("comparer.aucunResultat")}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(resultats ?? []).map((r) => (
                    <button key={r.entityId} type="button" onClick={() => choisir(r)} className={pastille(false)}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {erreurComparer && <p className="text-xs text-danger">{erreurComparer}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-center gap-4 @2xl/bloc:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="flex justify-center">
          <WorldviewRadar poles={radarPoles} overlay={superposition} label={t("radarLabelConvictions")} />
        </div>
        <div className="flex flex-col gap-2">
          <PoleBars
            keys={WORLDVIEW_POLE_KEYS}
            table={WORLDVIEW_POLES_FR}
            descriptions={WORLDVIEW_POLE_DESCRIPTIONS_FR}
            poles={data.poles}
            onCommit={commitSlider}
            onLiveChange={handleLiveChange}
            occupe={sliderPending}
            valeurExacte={isGm}
            comparaison={superposition}
            tensionSur={tension?.key ?? null}
          />
          {sliderError && <p className="text-xs text-danger">{sliderError}</p>}
        </div>
      </div>

      {choisie && tension && (
        <p role="status" className="rounded-lg border border-gm/50 bg-gm/10 px-2.5 py-1.5 text-xs text-gm">
          {t("comparer.tension", {
            faction: choisie.name,
            gap: tension.gap,
            pole: WORLDVIEW_POLES_FR[tension.key].label.toLowerCase(),
          })}
        </p>
      )}

      <SouvenirsPsyche
        key={`souvenirs-${blockId}`}
        genre="worldview"
        entityId={entityId}
        blockId={blockId}
        version={version}
        worldSlug={worldSlug}
        valeursActuelles={Object.fromEntries(data.poles.map((p) => [p.key, p.value]))}
        onBlockRefreshed={onBlockRefreshed}
        ref={souvenirsRef}
      />
    </div>
  );
}
