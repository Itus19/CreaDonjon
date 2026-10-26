"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import { nextEntryRange } from "@/src/core/tables/roll";
import type { TableEntry } from "@/src/core/tables/types";
import { CURRENCY_ORDER, type CoinType } from "@/src/core/rules/currency";
import { CURRENCY_LABELS_FR, formatTableEntryPrice } from "@/src/i18n/fr";
import Checkbox from "@/components/shared/Checkbox";
import Dropdown from "@/components/shared/Dropdown";
import { CarreDe, useBruit } from "@/components/shared/DeAnime";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { REDUIT_QUERY, PAS_FIGE_MS, attenteMinimale, mouvementReduit } from "@/lib/ui/animationDe";
import {
  ajouterSortie,
  delaisFigeage,
  etatRevelation,
  etatsLignes,
  exclusPourTirage,
  facesDe,
  resteASortir,
  sequenceDes,
  type Tirage,
} from "@/lib/ui/tirageTable";
import { useMatchMedia } from "@/components/shell/useMatchMedia";

/**
 * Bloc `random_table` (V1-E1, specs/outils-mj.md §2, refait en V3.1-75 « A »).
 * La table se LIT comme sur le papier (plage, texte, prix et palier en
 * pastilles) ; « Tirer · d20 » au-dessus. Le tirage vient du SERVEUR (règle 8) :
 * pendant son attente, les dés défilent flous (l'animation de l'outil de dés,
 * `components/shared/DeAnime.tsx`), puis se figent UN PAR UN — le dé de la table,
 * puis celui de chaque sous-table (`{table:…}`) ; le texte reste pâle et la
 * ligne sortie ne s'allume qu'à la fin. Mouvement réduit : résultat immédiat.
 *
 * « Sans répétition » : le client garde la liste des lignes sorties (un état
 * d'affichage, jamais enregistré) et l'envoie dans `exclude` ; quand tout est
 * sorti, le serveur répond 409 et son message s'affiche, avec « Remettre à
 * zéro ». « Modifier les entrées » bascule vers l'édition des lignes.
 *
 * « Tirer » n'est jamais `disabled` pendant la requête : il a le focus, et le
 * désactiver provoquerait le blur de la carte, donc une sauvegarde en même temps.
 * Un second clic est simplement ignoré.
 */
export default function RandomTableBlockEditor({
  data,
  onChange,
  blockId,
  worldSlug,
  otherEntities,
}: {
  data: RandomTableBlockData;
  onChange: (data: RandomTableBlockData) => void;
  blockId: string;
  /** Pour les liens vers les fiches du résultat (`refs`) ; sans eux, les liens ne se posent pas. */
  worldSlug?: string;
  otherEntities?: OtherEntityOption[];
}) {
  const t = useTranslations("fiche.table");
  const reduit = useMatchMedia(REDUIT_QUERY);
  const [edition, setEdition] = useState(false);
  const [tirage, setTirage] = useState<Tirage | null>(null);
  const [figes, setFiges] = useState(0);
  const [sorties, setSorties] = useState<number[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [epuisee, setEpuisee] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const enCoursRef = useRef(false);
  // Les minuteurs de figeage (au plus quelques-uns, de 110 ms) : un nouveau tirage ou « Remettre à zéro » les efface ; démonté, un reste inoffensif (React ignore un état posé sur un composant démonté).
  const minuteursRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function viderMinuteurs() {
    minuteursRef.current.forEach(clearTimeout);
    minuteursRef.current = [];
  }

  function updateEntry(index: number, patch: Partial<TableEntry>) {
    onChange({ ...data, entries: data.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
  }
  /** Montant vide -> pas de prix du tout (`price` retire), plutot qu'un prix a 0 pc par defaut. */
  function updateEntryAmount(index: number, entry: TableEntry, raw: string) {
    if (raw.trim() === "") {
      updateEntry(index, { price: undefined });
      return;
    }
    const amount = Number(raw);
    if (Number.isNaN(amount)) return;
    updateEntry(index, { price: { amount, coin: entry.price?.coin ?? "cp" } });
  }
  function updateEntryCoin(index: number, entry: TableEntry, coin: CoinType) {
    updateEntry(index, { price: { amount: entry.price?.amount ?? 0, coin } });
  }
  /** Cle libre (V2-J9quater) : vide -> `tier` retire, l'entree redevient eligible a tout palier. */
  function updateEntryTier(index: number, raw: string) {
    updateEntry(index, { tier: raw.trim() === "" ? undefined : raw.trim() });
  }
  function removeEntry(index: number) {
    onChange({ ...data, entries: data.entries.filter((_, i) => i !== index) });
  }
  function addEntry() {
    onChange({ ...data, entries: [...data.entries, { range: nextEntryRange(data.entries, data.die), weight: 1, text: "" }] });
  }

  async function tirer() {
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    setEnCours(true);
    setErreur(null);
    setEpuisee(false);
    viderMinuteurs();
    setTirage(null);
    setFiges(0);
    try {
      // L'attente minimale fait voir le scintillement même si le serveur répond vite.
      const attente = new Promise<void>((resolve) => setTimeout(resolve, attenteMinimale(mouvementReduit(window.matchMedia.bind(window)))));
      const [res] = await Promise.all([
        fetch(`/api/blocks/${blockId}/draw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 1, exclude: exclusPourTirage(sorties, data.unique_draws) }),
        }),
        attente,
      ]);
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        setErreur(corps?.error ?? t("erreurTirage"));
        setEpuisee(res.status === 409);
        return;
      }
      const { draws } = (await res.json()) as { draws: Tirage[] };
      const sortie = draws[0];
      if (!sortie) {
        setErreur(t("erreurTirage"));
        return;
      }
      setTirage(sortie);
      if (data.unique_draws) setSorties((courantes) => ajouterSortie(courantes, sortie.index));
      const nombre = sequenceDes(sortie).length;
      if (mouvementReduit(window.matchMedia.bind(window))) {
        setFiges(nombre);
      } else {
        delaisFigeage(nombre, PAS_FIGE_MS).forEach((delai, i) => {
          minuteursRef.current.push(setTimeout(() => setFiges(i + 1), delai));
        });
      }
    } catch (e) {
      console.error("Tirage sur la table impossible", e);
      setErreur(t("erreurTirage"));
    } finally {
      enCoursRef.current = false;
      setEnCours(false);
    }
  }

  function remettreAZero() {
    viderMinuteurs();
    setSorties([]);
    setTirage(null);
    setFiges(0);
    setErreur(null);
    setEpuisee(false);
  }

  const des = tirage ? sequenceDes(tirage) : [];
  const revelation = etatRevelation(des.length, figes);
  const bruitActif = !reduit && (enCours || (tirage !== null && !revelation.termine));
  const facesAffichees = tirage ? des.map((d) => d.faces) : [facesDe(data.die)];
  const bruit = useBruit(facesAffichees, bruitActif);
  const etats = etatsLignes(data.entries.length, sorties, data.unique_draws, tirage ? tirage.index : null, revelation.termine);
  const resultatVisible = enCours || tirage !== null;

  function lienFiche(ref: Tirage["refs"][number], i: number) {
    if (ref.kind === "rule") return <span key={i} className="text-ink-soft">{ref.key}</span>;
    const fiche = otherEntities?.find((e) => e.id === ref.id);
    if (!fiche || !worldSlug) return <span key={i} className="text-ink-soft">{t("fiche")}</span>;
    return (
      <Link key={i} href={`/m/${worldSlug}/f/${fiche.slug}`} prefetch={false} className="rich-ref-mention" onClick={(e) => e.stopPropagation()}>
        {fiche.name}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void tirer()}
          aria-busy={enCours}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <span aria-hidden>⬡</span>
          {enCours ? t("tirageEnCours") : t("tirer", { de: data.die })}
        </button>
        <Checkbox
          checked={data.unique_draws}
          onChange={() => onChange({ ...data, unique_draws: !data.unique_draws })}
          label={t("sansRepetition")}
          className="text-xs text-ink-muted"
        />
        {data.unique_draws && (
          <span className="text-xs text-ink-muted">{t("restent", { n: resteASortir(data.entries.length, sorties), total: data.entries.length })}</span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={remettreAZero}
          className={`rounded-full border px-3 py-1 text-xs transition-colors hover:bg-panel-raised ${epuisee ? "border-accent text-accent" : "border-edge text-ink"}`}
        >
          {t("remettreAZero")}
        </button>
      </div>
      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

      {resultatVisible && (
        <div className="flex gap-3 rounded-xl border border-edge bg-panel-sunken p-3" aria-label={t("resultat")}>
          <div className="flex shrink-0 flex-wrap content-start gap-2">
            {(tirage ? des : [{ cle: null, faces: facesDe(data.die), valeur: 0, etiquette: data.die }]).map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <CarreDe faces={d.faces} valeur={tirage && i < figes ? d.valeur : undefined} bruit={bruitActif ? bruit[i] : undefined} petit={false} />
                <small className="text-xs text-ink-muted">{d.etiquette}</small>
              </div>
            ))}
          </div>
          {tirage && (
            <div className={`flex min-w-0 flex-1 flex-col gap-1 text-sm transition-opacity ${revelation.texteEstompe ? "opacity-40" : "text-ink"}`}>
              <p>{tirage.text}</p>
              {tirage.refs.length > 0 && <p className="flex flex-wrap gap-x-2 text-xs">{tirage.refs.map(lienFiche)}</p>}
              {tirage.subDraws.map((s) => (
                <p key={s.key} className="text-xs text-ink-soft">
                  {t("sousTirage", { table: s.key, texte: s.text })}
                </p>
              ))}
              <span className="sr-only" role="status">
                {revelation.termine ? tirage.text : ""}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col text-sm">
        {data.entries.map((entry, index) => {
          const etat = etats[index];
          const prix = formatTableEntryPrice(entry.price);
          return (
            <div
              key={index}
              className={`grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-2.5 rounded-lg border-t border-edge px-2 py-1.5 first:border-t-0 @md/bloc:grid-cols-[3.5rem_1fr_auto] ${
                etat === "allumee"
                  ? "bg-accent/10 text-ink shadow-[inset_3px_0_0_var(--accent)]"
                  : etat === "barree"
                    ? "text-ink-soft line-through opacity-40"
                    : "text-ink-soft"
              }`}
            >
              <span className="text-xs tabular-nums text-ink-muted">
                {entry.range.min === entry.range.max ? entry.range.min : `${entry.range.min}–${entry.range.max}`}
              </span>
              <span>
                {/* `{table:clé}` se lit comme un renvoi, pas comme du balisage. */}
                {entry.text.split(/(\{table:[a-zA-Z0-9_-]+\})/).map((morceau, i) => {
                  const renvoi = /^\{table:([a-zA-Z0-9_-]+)\}$/.exec(morceau);
                  return renvoi ? (
                    <span key={i} className="mx-0.5 rounded-full border border-edge px-1.5 py-px text-xs text-ink-muted">
                      ↳ {renvoi[1]}
                    </span>
                  ) : (
                    morceau
                  );
                })}
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                {prix && <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">{prix}</span>}
                {entry.tier && <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">{entry.tier}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {data.attribution && <span className="text-xs italic text-ink-muted">{data.attribution}</span>}
        <span className="flex-1" />
        <button
          type="button"
          aria-expanded={edition}
          onClick={() => setEdition(!edition)}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          {edition ? t("terminerEdition") : t("modifier")}
        </button>
      </div>

      {edition && (
        <div className="flex flex-col gap-3 rounded-xl border border-edge p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("modifierTitre")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              {t("cle")}
              <input
                value={data.key}
                onChange={(e) => onChange({ ...data, key: e.target.value })}
                placeholder="rumeurs"
                className="w-28 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              {t("de")}
              <input
                value={data.die}
                onChange={(e) => onChange({ ...data, die: e.target.value })}
                placeholder="d20"
                className="w-16 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
              />
            </label>
            <input
              value={data.attribution ?? ""}
              onChange={(e) => onChange({ ...data, attribution: e.target.value || undefined })}
              placeholder={t("attributionPlaceholder")}
              aria-label={t("attributionLabel")}
              className="min-w-40 flex-1 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            {data.entries.map((entry, index) => (
              <div key={index} className="flex flex-wrap items-start gap-2 border-b border-edge/40 py-1.5 last:border-b-0">
                <div className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                  <input
                    type="number"
                    value={entry.range.min}
                    aria-label={t("plageMin", { n: index + 1 })}
                    onChange={(e) => updateEntry(index, { range: { ...entry.range, min: Number(e.target.value) } })}
                    className="w-10 bg-transparent text-center outline-none"
                  />
                  –
                  <input
                    type="number"
                    value={entry.range.max}
                    aria-label={t("plageMax", { n: index + 1 })}
                    onChange={(e) => updateEntry(index, { range: { ...entry.range, max: Number(e.target.value) } })}
                    className="w-10 bg-transparent text-center outline-none"
                  />
                </div>
                <input
                  value={entry.text}
                  onChange={(e) => updateEntry(index, { text: e.target.value })}
                  placeholder={t("resultatPlaceholder")}
                  aria-label={t("resultatLigne", { n: index + 1 })}
                  className="min-w-40 flex-1 bg-transparent text-sm text-ink outline-none"
                />
                <div className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                  <input
                    type="number"
                    min={0}
                    value={entry.price?.amount ?? ""}
                    onChange={(e) => updateEntryAmount(index, entry, e.target.value)}
                    placeholder={t("prix")}
                    title={t("prixTitre")}
                    className="w-14 rounded-md border border-edge bg-transparent px-1 py-0.5 text-center outline-none"
                  />
                  <Dropdown
                    value={entry.price?.coin ?? "cp"}
                    onChange={(v) => updateEntryCoin(index, entry, v as CoinType)}
                    disabled={entry.price === undefined}
                    aria-label={t("monnaie", { n: index + 1 })}
                    options={CURRENCY_ORDER.map((coin) => ({ value: coin, label: CURRENCY_LABELS_FR[coin] }))}
                  />
                </div>
                <input
                  value={entry.tier ?? ""}
                  onChange={(e) => updateEntryTier(index, e.target.value)}
                  placeholder={t("palier")}
                  title={t("palierTitre")}
                  className="w-20 shrink-0 rounded-md border border-edge bg-transparent px-1.5 py-0.5 text-xs text-ink outline-none"
                />
                <button type="button" onClick={() => removeEntry(index)} aria-label={t("retirer", { n: index + 1 })} className="text-xs text-danger hover:underline">
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addEntry}
              className="mt-2 self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              {t("ajouter")}
            </button>
          </div>
          <span className="text-xs text-ink-muted">{t("aide")}</span>
        </div>
      )}
    </div>
  );
}
