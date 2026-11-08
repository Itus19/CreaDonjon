"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Checkbox from "@/components/shared/Checkbox";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import type { RuleEntryDetail } from "@/src/server/services/rules";
import { RULE_RECHARGES } from "@/src/core/schemas/rule-blocks/playable";
import { ACTIVATION_COSTS, ACTIVATION_TARGET_KINDS } from "@/src/core/schemas/rule-blocks/playable";
import { ABILITY_LABELS } from "@/src/core/rules/abilities";
import type { Ability } from "@/src/core/rules/sheet";
import {
  apercuBouton,
  blocsVersBrouillon,
  brouillonVersBlocs,
  citationDepuisSelection,
  cleDepuisLibelle,
  corpsEnregistrement,
  decouperTexte,
  nouvelEffet,
  nouvelleOptionLancement,
  nouvelleActivation,
  nouvelleLacune,
  nouvelEchec,
  nouvelleRessource,
  nouvelleVariante,
  numeroterEffets,
  remplacerA,
  retirerA,
  surlignagesDuBrouillon,
  texteDeLaRegle,
  type Brouillon,
  type BrouillonActivation,
  type BrouillonCout,
  type FamilleSurlignage,
  type GenreCible,
  type RechargeRegle,
  type TypeAction,
} from "@/lib/ui/briquesRegle";
import { chargerRessourcesDeclarees, enregistrerBriques, type RessourceDeclaree } from "@/lib/ui/regleApi";
import ChampFormule from "@/components/rules/briques/ChampFormule";
import ReactionEditeur from "@/components/rules/briques/BriqueReaction";
import ChoixSort from "@/components/rules/ChoixSort";
import { ListeEffets } from "@/components/rules/briques/BriqueEffet";
import {
  BoutonPetit,
  CarteBrique,
  ChampListe,
  ChampTexte,
  Citation,
  FournisseurBriques,
  useContexteBriques,
  type ContexteBriquesValeur,
} from "@/components/rules/briques/ContexteBriques";

// Classes écrites en toutes lettres : Tailwind ne génère pas une classe composée à la volée.
const MARQUES: Record<FamilleSurlignage, string> = {
  cout: "bg-accent/20 border-b-2 border-accent",
  cibles: "bg-link-entity/20 border-b-2 border-link-entity",
  sauvegarde: "bg-link-rule/20 border-b-2 border-link-rule",
  etat: "bg-success/20 border-b-2 border-success",
  autre: "bg-panel-raised border-b-2 border-edge-strong",
  lacune: "border-b-2 border-dashed border-danger",
};

/**
 * V3.1-132 — l'éditeur de briques d'une règle (ADR 0060), ouvert EN PLACE
 * dans la fiche comme `HomebrewEditForm`. À gauche le texte de la règle, où
 * l'on sélectionne un passage à citer ; à droite les briques, saisies par
 * listes et champs de formule — jamais un champ JSON. Au téléphone, empilés.
 */
export default function PlayableBricksEditor({
  worldSlug,
  entry,
  onDone,
  onCancel,
}: {
  worldSlug: string;
  entry: RuleEntryDetail;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("regles.briques");
  const [brouillon, setBrouillon] = useState<Brouillon>(() => blocsVersBrouillon(entry.blocks));
  const [selection, setSelection] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [declarees, setDeclarees] = useState<RessourceDeclaree[]>([]);
  const [ressourcesIndisponibles, setRessourcesIndisponibles] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [messageServeur, setMessageServeur] = useState<string | null>(null);
  const texteRef = useRef<HTMLDivElement>(null);
  const regles = useWorldRuleEntries(worldSlug);

  const officielle = entry.isOfficialBase;
  const texte = useMemo(() => texteDeLaRegle(entry.blocks), [entry.blocks]);

  // Les ressources des AUTRES règles, lues une seule fois à l'ouverture (docs/QUOTAS.md).
  useEffect(() => {
    if (officielle) return;
    let annule = false;
    chargerRessourcesDeclarees(worldSlug)
      .then((r) => {
        if (annule) return;
        if (r) setDeclarees(r);
        else setRessourcesIndisponibles(true);
      })
      .catch((erreur: unknown) => {
        console.error("Ressources déclarées non chargées", erreur);
        if (!annule) setRessourcesIndisponibles(true);
      });
    return () => {
      annule = true;
    };
  }, [worldSlug, officielle]);

  const etats = useMemo(() => regles.filter((r) => r.entryType === "condition").map((r) => ({ value: r.key, label: r.name })), [regles]);
  const nomsEtats = useMemo(() => Object.fromEntries(etats.map((e) => [e.value, e.label])), [etats]);

  // Les ressources dépensables : celles du ruleset, plus celles que cette fiche déclare (pas encore enregistrées).
  const ressources = useMemo(() => {
    const parCle = new Map(declarees.map((r) => [r.key, r.label]));
    for (const r of brouillon.ressources) {
      const cle = r.key.trim() || cleDepuisLibelle(r.label);
      if (cle !== "") parCle.set(cle, r.label.trim() || cle);
    }
    return [...parCle].map(([value, label]) => ({ value, label }));
  }, [declarees, brouillon.ressources]);

  const numeros = useMemo(() => {
    const tous = new Map<string, number>();
    for (const a of brouillon.activations) {
      for (const [k, v] of numeroterEffets([a.effets, ...a.variantes.map((x) => x.effets)])) tous.set(k, v);
    }
    return tous;
  }, [brouillon.activations]);

  const surlignages = useMemo(() => surlignagesDuBrouillon(brouillon), [brouillon]);
  const fragments = useMemo(() => decouperTexte(texte, surlignages), [texte, surlignages]);

  const contexte: ContexteBriquesValeur = {
    selection,
    survol,
    setSurvol,
    etats,
    ressources,
    numeros,
    creerEffet: (entree) => nouvelEffet(entree, brouillon),
  };

  function capturerSelection() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !texteRef.current || !s.anchorNode || !texteRef.current.contains(s.anchorNode)) return;
    const citation = citationDepuisSelection(s.toString());
    if (citation) setSelection(citation);
  }

  // Au téléphone, une sélection au doigt ne déclenche ni `mouseup` ni `keyup` : on suit aussi la sélection du document.
  useEffect(() => {
    document.addEventListener("selectionchange", capturerSelection);
    return () => document.removeEventListener("selectionchange", capturerSelection);
  });

  async function enregistrer() {
    setMessageServeur(null);
    const r = brouillonVersBlocs(brouillon, nomsEtats);
    if (!r.ok) {
      setErreurs(r.erreurs);
      return;
    }
    setErreurs([]);
    const corps = corpsEnregistrement(brouillon, r);
    if (Object.keys(corps).length === 0) {
      onDone();
      return;
    }
    setEnCours(true);
    const res = await enregistrerBriques(worldSlug, { entryKey: entry.entryKey, ...corps });
    setEnCours(false);
    if (!res.ok) {
      setMessageServeur(res.sansVariante ? t("sansVariante") : res.message);
      return;
    }
    onDone();
  }

  const majActivation = (i: number, a: BrouillonActivation) => setBrouillon({ ...brouillon, activations: remplacerA(brouillon.activations, i, a) });

  return (
    <FournisseurBriques value={contexte}>
      <section className="flex flex-col gap-4 rounded-2xl border border-accent/40 bg-panel-sunken p-4" aria-label={t("titreEditeur", { nom: entry.name })}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-ink">{t("titreEditeur", { nom: entry.name })}</h2>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            {t("annuler")}
          </button>
          <button
            type="button"
            onClick={() => void enregistrer()}
            disabled={enCours || officielle}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {enCours ? t("enregistrement") : t("enregistrer")}
          </button>
        </div>

        {officielle && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {t("sansVariante")}
          </p>
        )}
        {messageServeur && (
          <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {messageServeur}
          </p>
        )}
        {erreurs.length > 0 && (
          <div role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
            <p className="font-medium">{t("corrigeAvant")}</p>
            <ul className="list-disc pl-5">
              {erreurs.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {ressourcesIndisponibles && <p className="text-xs text-ink-muted">{t("ressourcesIndisponibles")}</p>}

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-col gap-3 lg:w-2/5 lg:self-start lg:sticky lg:top-2">
            <h3 className="block-title">{t("texteDeLaRegle")}</h3>
            {texte === "" ? (
              <p className="text-sm text-ink-muted">{t("pasDeTexte")}</p>
            ) : (
              <div
                ref={texteRef}
                onMouseUp={capturerSelection}
                onKeyUp={capturerSelection}
                className="max-h-[70vh] overflow-auto whitespace-pre-wrap text-sm leading-7 text-ink-soft"
              >
                {fragments.map((f, i) =>
                  f.surlignage ? (
                    <mark
                      key={i}
                      onMouseEnter={() => setSurvol(f.surlignage?.uid ?? null)}
                      onMouseLeave={() => setSurvol(null)}
                      className={`rounded-sm text-ink ${MARQUES[f.surlignage.famille]} ${survol === f.surlignage.uid ? "ring-2 ring-accent" : ""}`}
                    >
                      {f.texte}
                    </mark>
                  ) : (
                    <span key={i}>{f.texte}</span>
                  )
                )}
              </div>
            )}
            <div className="rounded-lg border border-edge p-3 text-xs text-ink-muted">
              {selection ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 italic">
                    {t("passageSelectionne")} « {selection} »
                  </span>
                  <BoutonPetit onClick={() => setSelection(null)}>{t("oublierSelection")}</BoutonPetit>
                </div>
              ) : (
                <span>{t("aideSelection")}</span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <SectionRessources brouillon={brouillon} onChange={setBrouillon} ressources={ressources} />
            <section className="flex flex-col gap-3">
              <h3 className="block-title">{t("utilisations")}</h3>
              {brouillon.activations.map((a, i) => (
                <CarteActivation
                  key={a.uid}
                  activation={a}
                  onChange={(n) => majActivation(i, n)}
                  onRemove={() => setBrouillon({ ...brouillon, activations: retirerA(brouillon.activations, i) })}
                />
              ))}
              <div className="w-fit">
                <BoutonPetit onClick={() => setBrouillon({ ...brouillon, activations: [...brouillon.activations, nouvelleActivation(brouillon)] })}>
                  {t("ajouterUtilisation")}
                </BoutonPetit>
              </div>
            </section>
            <SectionEchecs
              brouillon={brouillon}
              onChange={setBrouillon}
              etats={etats}
              sorts={regles.filter((r) => r.entryType === "spell").map((r) => ({ key: r.key, name: r.name }))}
            />
            <SectionLacunes brouillon={brouillon} onChange={setBrouillon} />
          </div>
        </div>
      </section>
    </FournisseurBriques>
  );
}

function SectionRessources({
  brouillon,
  onChange,
  ressources,
}: {
  brouillon: Brouillon;
  onChange: (b: Brouillon) => void;
  /** Les ressources dépensables (ruleset et cette fiche), pour le regain (ADR 0078). */
  ressources: readonly { value: string; label: string }[];
}) {
  const t = useTranslations("regles.briques");
  return (
    <section className="flex flex-col gap-3">
      <h3 className="block-title">{t("ressourcesDeclarees")}</h3>
      {brouillon.ressources.length === 0 && <p className="text-xs text-ink-muted">{t("aucuneRessource")}</p>}
      {brouillon.ressources.map((r, i) => {
        const maj = (n: typeof r) => onChange({ ...brouillon, ressources: remplacerA(brouillon.ressources, i, n) });
        return (
          <CarteBrique
            key={r.uid}
            uid={r.uid}
            titre={r.label.trim() || t("nouvelleRessource")}
            actions={
              <BoutonPetit onClick={() => onChange({ ...brouillon, ressources: retirerA(brouillon.ressources, i) })} danger>
                {t("retirer")}
              </BoutonPetit>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampTexte libelle={t("libelle")} valeur={r.label} onChange={(label) => maj({ ...r, label })} />
              <ChampTexte libelle={t("cleRessource")} valeur={r.key} onChange={(key) => maj({ ...r, key })} mecanique />
              <ChampFormule libelle={t("maximum")} valeur={r.max} onChange={(max) => maj({ ...r, max })} />
              <ChampListe
                libelle={t("recharge")}
                valeur={r.recharge}
                options={RULE_RECHARGES.map((x) => ({ value: x, label: t(`recharges.${x}`) }))}
                onChange={(v) => maj({ ...r, recharge: (RULE_RECHARGES.find((x) => x === v) ?? r.recharge) as RechargeRegle })}
              />
            </div>
            {/* ADR 0078 (V3.1-183) : regagner une utilisation en dépensant autre chose. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampListe
                libelle={t("regain")}
                valeur={r.regain.genre}
                options={[
                  { value: "aucun", label: t("regainAucun") },
                  { value: "resource", label: t("regainRessource") },
                  { value: "slot", label: t("regainEmplacement") },
                ]}
                onChange={(v) => maj({ ...r, regain: { ...r.regain, genre: v === "resource" || v === "slot" ? v : "aucun" } })}
              />
              {r.regain.genre === "resource" && (
                <>
                  <ChampListe
                    libelle={t("regainQuelleRessource")}
                    valeur={r.regain.cle}
                    options={[{ value: "", label: t("choisirRessource") }, ...ressources.filter((x) => x.value !== (r.key.trim() || cleDepuisLibelle(r.label)))]}
                    onChange={(cle) => maj({ ...r, regain: { ...r.regain, cle } })}
                  />
                  <ChampTexte libelle={t("regainQuantite")} valeur={r.regain.quantite} onChange={(quantite) => maj({ ...r, regain: { ...r.regain, quantite } })} mecanique />
                </>
              )}
              {r.regain.genre === "slot" && (
                <ChampTexte libelle={t("regainNiveauMin")} valeur={r.regain.niveauMin} onChange={(niveauMin) => maj({ ...r, regain: { ...r.regain, niveauMin } })} mecanique />
              )}
            </div>
            <Citation passage={r.passage} onChange={(passage) => maj({ ...r, passage })} />
          </CarteBrique>
        );
      })}
      <div className="w-fit">
        <BoutonPetit onClick={() => onChange({ ...brouillon, ressources: [...brouillon.ressources, nouvelleRessource()] })}>{t("ajouterRessource")}</BoutonPetit>
      </div>
    </section>
  );
}

/**
 * V3.1-186 — « Échec automatique d'une sauvegarde » (Mante de majesté) : contre
 * ces sorts, une cible qui porte cet état — posé par vous, si coché — rate sa
 * sauvegarde d'office. Le moteur l'applique quand le MJ cible avec le sort.
 */
function SectionEchecs({
  brouillon,
  onChange,
  etats,
  sorts,
}: {
  brouillon: Brouillon;
  onChange: (b: Brouillon) => void;
  etats: readonly { value: string; label: string }[];
  sorts: readonly { key: string; name: string }[];
}) {
  const t = useTranslations("regles.briques.echecs");
  if (brouillon.echecs.length === 0) {
    return (
      <div className="w-fit">
        <BoutonPetit onClick={() => onChange({ ...brouillon, echecs: [nouvelEchec()] })}>{t("ajouter")}</BoutonPetit>
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h3 className="block-title">{t("titre")}</h3>
      <p className="text-xs text-ink-muted">{t("aide")}</p>
      {brouillon.echecs.map((e, i) => {
        const maj = (n: typeof e) => onChange({ ...brouillon, echecs: remplacerA(brouillon.echecs, i, n) });
        return (
          <CarteBrique
            key={e.uid}
            uid={e.uid}
            titre={t("brique")}
            actions={
              <BoutonPetit onClick={() => onChange({ ...brouillon, echecs: retirerA(brouillon.echecs, i) })} danger>
                {t("retirer")}
              </BoutonPetit>
            }
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <span>{t("contre")}</span>
              {e.sorts.map((cle) => (
                <span key={cle} className="flex items-center gap-1 rounded-full border border-edge px-2 py-0.5 text-xs text-ink">
                  {sorts.find((s) => s.key === cle)?.name ?? cle}
                  <button type="button" aria-label={t("retirerSort")} onClick={() => maj({ ...e, sorts: e.sorts.filter((k) => k !== cle) })} className="text-ink-muted hover:text-danger">
                    ×
                  </button>
                </span>
              ))}
              {/* Une clé par nombre de sorts : le champ de recherche se vide après chaque choix. */}
              <ChoixSort key={e.sorts.length} sorts={sorts.filter((s) => !e.sorts.includes(s.key))} value="" onChange={(cle) => cle && maj({ ...e, sorts: [...e.sorts, cle] })} />
            </div>
            <ChampListe libelle={t("siLaCibleEst")} valeur={e.etat} options={etats.map((x) => ({ value: x.value, label: x.label }))} onChange={(etat) => maj({ ...e, etat })} />
            <Checkbox checked={e.parMoi} onChange={() => maj({ ...e, parMoi: !e.parMoi })} label={t("parVous")} />
          </CarteBrique>
        );
      })}
      <div className="w-fit">
        <BoutonPetit onClick={() => onChange({ ...brouillon, echecs: [...brouillon.echecs, nouvelEchec()] })}>{t("ajouterAutre")}</BoutonPetit>
      </div>
    </section>
  );
}

function SectionLacunes({ brouillon, onChange }: { brouillon: Brouillon; onChange: (b: Brouillon) => void }) {
  const t = useTranslations("regles.briques");
  const { selection } = useContexteBriques();
  return (
    <section className="flex flex-col gap-3">
      <h3 className="block-title">{t("passagesNonExprimables")}</h3>
      <p className="text-xs text-ink-muted">{t("passagesAide")}</p>
      {brouillon.lacunes.map((g, i) => {
        const maj = (n: typeof g) => onChange({ ...brouillon, lacunes: remplacerA(brouillon.lacunes, i, n) });
        return (
          <CarteBrique
            key={g.uid}
            uid={g.uid}
            titre={t("passageNonExprimable")}
            pointille
            actions={
              <BoutonPetit onClick={() => onChange({ ...brouillon, lacunes: retirerA(brouillon.lacunes, i) })} danger>
                {t("retirer")}
              </BoutonPetit>
            }
          >
            <ChampTexte libelle={t("texteDuPassage")} valeur={g.texte} onChange={(texte) => maj({ ...g, texte })} />
            <ChampTexte libelle={t("ceQuiManque")} valeur={g.manque} onChange={(manque) => maj({ ...g, manque })} />
          </CarteBrique>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <BoutonPetit onClick={() => onChange({ ...brouillon, lacunes: [...brouillon.lacunes, nouvelleLacune(selection ?? "")] })}>
          {selection ? t("ajouterPassageSelection") : t("ajouterPassage")}
        </BoutonPetit>
      </div>
    </section>
  );
}

function CoutEditeur({ cout, onChange, uid, avecCitation }: { cout: BrouillonCout; onChange: (c: BrouillonCout) => void; uid: string; avecCitation: boolean }) {
  const t = useTranslations("regles.briques");
  const { ressources } = useContexteBriques();
  return (
    <CarteBrique uid={uid} titre={t("cout")}>
      <ChampListe
        libelle={t("typeAction")}
        valeur={cout.action}
        options={ACTIVATION_COSTS.map((a) => ({ value: a, label: t(`actions.${a}`) }))}
        onChange={(v) => onChange({ ...cout, action: (ACTIVATION_COSTS.find((a) => a === v) ?? cout.action) as TypeAction })}
      />
      <ChampListe
        libelle={t("emplacementDeSort")}
        valeur={cout.emplacement === null ? "" : String(cout.emplacement)}
        options={[
          { value: "", label: t("sansEmplacement") },
          { value: "0", label: t("sortMineur") },
          ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: t("niveauDeSort", { niveau: n }) })),
        ]}
        onChange={(v) => onChange({ ...cout, emplacement: v === "" ? null : Number(v) })}
      />
      {cout.depenses.map((d, i) => {
        const options = [{ value: "", label: t("choisirRessource") }, ...ressources];
        if (d.cle !== "" && !ressources.some((r) => r.value === d.cle)) options.push({ value: d.cle, label: d.cle });
        return (
          <div key={i} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <ChampListe libelle={t("ressourceDepensee")} valeur={d.cle} options={options} onChange={(cle) => onChange({ ...cout, depenses: remplacerA(cout.depenses, i, { ...d, cle }) })} />
            <ChampFormule libelle={t("quantite")} valeur={d.quantite} onChange={(quantite) => onChange({ ...cout, depenses: remplacerA(cout.depenses, i, { ...d, quantite }) })} />
            <div className="sm:pt-5">
              <BoutonPetit onClick={() => onChange({ ...cout, depenses: retirerA(cout.depenses, i) })} danger>
                {t("retirer")}
              </BoutonPetit>
            </div>
          </div>
        );
      })}
      <div className="w-fit">
        <BoutonPetit onClick={() => onChange({ ...cout, depenses: [...cout.depenses, { cle: "", quantite: "1" }] })}>{t("ajouterDepense")}</BoutonPetit>
      </div>
      {avecCitation && <Citation passage={cout.passage} onChange={(passage) => onChange({ ...cout, passage })} />}
    </CarteBrique>
  );
}

function CarteActivation({ activation: a, onChange, onRemove }: { activation: BrouillonActivation; onChange: (a: BrouillonActivation) => void; onRemove: () => void }) {
  const t = useTranslations("regles.briques");
  const cibles = a.cibles;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <ChampTexte libelle={t("libelleUtilisation")} valeur={a.label} onChange={(label) => onChange({ ...a, label })} />
        </div>
        <BoutonPetit onClick={onRemove} danger>
          {t("retirerUtilisation")}
        </BoutonPetit>
      </div>

      <ReactionEditeur activation={a} onChange={onChange} />

      <CoutEditeur cout={a.cout} onChange={(cout) => onChange({ ...a, cout })} uid={`${a.uid}:cout`} avecCitation />

      <CarteBrique uid={`${a.uid}:cibles`} titre={t("cibles")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ChampListe
            libelle={t("qui")}
            valeur={cibles.kind}
            options={ACTIVATION_TARGET_KINDS.map((k) => ({ value: k, label: t(`genresCible.${k}`) }))}
            onChange={(v) => onChange({ ...a, cibles: { ...cibles, kind: (ACTIVATION_TARGET_KINDS.find((k) => k === v) ?? cibles.kind) as GenreCible } })}
          />
          <ChampFormule facultatif libelle={t("nombreCibles")} valeur={cibles.nombre} onChange={(nombre) => onChange({ ...a, cibles: { ...cibles, nombre } })} />
          <ChampTexte libelle={t("portee")} valeur={cibles.portee} onChange={(portee) => onChange({ ...a, cibles: { ...cibles, portee } })} mecanique />
        </div>
        <Checkbox checked={cibles.doitVoir} onChange={() => onChange({ ...a, cibles: { ...cibles, doitVoir: !cibles.doitVoir } })} label={t("doitVoir")} />
        <Citation passage={cibles.passage} onChange={(passage) => onChange({ ...a, cibles: { ...cibles, passage } })} />
      </CarteBrique>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("effets")}</span>
        <ListeEffets effets={a.effets} onChange={(effets) => onChange({ ...a, effets })} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("variantes")}</span>
        {a.variantes.map((v, k) => {
          const maj = (n: typeof v) => onChange({ ...a, variantes: remplacerA(a.variantes, k, n) });
          return (
            <CarteBrique
              key={v.uid}
              uid={v.uid}
              titre={v.label.trim() || t("nouvelleVariante")}
              actions={
                <BoutonPetit onClick={() => onChange({ ...a, variantes: retirerA(a.variantes, k) })} danger>
                  {t("retirer")}
                </BoutonPetit>
              }
            >
              <ChampTexte libelle={t("libelleVariante")} valeur={v.label} onChange={(label) => maj({ ...v, label })} />
              <Checkbox checked={v.cout !== null} onChange={() => maj({ ...v, cout: v.cout ? null : { ...a.cout, passage: null, depenses: a.cout.depenses.map((d) => ({ ...d })) } })} label={t("coutPropre")} />
              {v.cout && <CoutEditeur cout={v.cout} onChange={(cout) => maj({ ...v, cout })} uid={`${v.uid}:cout`} avecCitation={false} />}
              <ListeEffets effets={v.effets} onChange={(effets) => maj({ ...v, effets })} />
            </CarteBrique>
          );
        })}
        <div className="w-fit">
          <BoutonPetit onClick={() => onChange({ ...a, variantes: [...a.variantes, nouvelleVariante(a)] })}>{t("ajouterVariante")}</BoutonPetit>
        </div>
      </div>

      <OptionsLancement activation={a} onChange={onChange} />

      <Apercu activation={a} />
    </div>
  );
}

/** V3.1-166 : les options de lancement qu'une aptitude offre quand on lance un sort (Sort accéléré) : id, libellé, coût, temps d'incantation. */
function OptionsLancement({ activation: a, onChange }: { activation: BrouillonActivation; onChange: (a: BrouillonActivation) => void }) {
  const t = useTranslations("regles.briques");
  const { ressources } = useContexteBriques();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("optionsLancement")}</span>
      {a.optionsLancement.length === 0 && <p className="text-xs text-ink-muted">{t("optionsLancementAide")}</p>}
      {a.optionsLancement.map((o, k) => {
        const maj = (n: typeof o) => onChange({ ...a, optionsLancement: remplacerA(a.optionsLancement, k, n) });
        return (
          <CarteBrique
            key={o.uid}
            uid={o.uid}
            titre={o.label.trim() || t("nouvelleOptionLancement")}
            actions={
              <BoutonPetit onClick={() => onChange({ ...a, optionsLancement: retirerA(a.optionsLancement, k) })} danger>
                {t("retirer")}
              </BoutonPetit>
            }
          >
            <ChampTexte libelle={t("libelleOption")} valeur={o.label} onChange={(label) => maj({ ...o, label })} />
            <ChampListe
              libelle={t("tempsIncantation")}
              valeur={o.action}
              options={[{ value: "", label: t("tempsInchange") }, ...OPTIONS_TEMPS.map((x) => ({ value: x, label: t(`actions.${x}`) }))]}
              onChange={(v) => maj({ ...o, action: OPTIONS_TEMPS.find((x) => x === v) ?? "" })}
            />
            {o.depenses.map((d, i) => {
              const options = [{ value: "", label: t("choisirRessource") }, ...ressources];
              if (d.cle !== "" && !ressources.some((r) => r.value === d.cle)) options.push({ value: d.cle, label: d.cle });
              return (
                <div key={i} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <ChampListe libelle={t("ressourceDepensee")} valeur={d.cle} options={options} onChange={(cle) => maj({ ...o, depenses: remplacerA(o.depenses, i, { ...d, cle }) })} />
                  <ChampFormule libelle={t("quantite")} valeur={d.quantite} onChange={(quantite) => maj({ ...o, depenses: remplacerA(o.depenses, i, { ...d, quantite }) })} />
                  <div className="sm:pt-5">
                    <BoutonPetit onClick={() => maj({ ...o, depenses: retirerA(o.depenses, i) })} danger>
                      {t("retirer")}
                    </BoutonPetit>
                  </div>
                </div>
              );
            })}
            <div className="w-fit">
              <BoutonPetit onClick={() => maj({ ...o, depenses: [...o.depenses, { cle: "", quantite: "1" }] })}>{t("ajouterDepense")}</BoutonPetit>
            </div>
          </CarteBrique>
        );
      })}
      <div className="w-fit">
        <BoutonPetit onClick={() => onChange({ ...a, optionsLancement: [...a.optionsLancement, nouvelleOptionLancement(a)] })}>{t("ajouterOptionLancement")}</BoutonPetit>
      </div>
    </div>
  );
}

const OPTIONS_TEMPS = ["action", "bonus", "reaction", "magic"] as const;

/** L'aperçu du bouton, tel qu'il apparaîtra sur la fiche (planche « Éditeur »). */
function Apercu({ activation }: { activation: BrouillonActivation }) {
  const t = useTranslations("regles.briques");
  const { ressources } = useContexteBriques();
  const p = apercuBouton(activation);
  const emplacement = activation.cout.emplacement;
  const morceaux = [
    t(`actions.${p.action}`),
    ...(emplacement === null ? [] : [emplacement === 0 ? t("sortMineur") : t("niveauDeSort", { niveau: emplacement })]),
    ...p.depenses.filter((d) => d.cle !== "").map((d) => `${d.quantite} ${ressources.find((r) => r.value === d.cle)?.label ?? d.cle}`),
    p.nombre !== "" ? t("apercuCibles", { nombre: p.nombre }) : t(`genresCible.${p.genre}`),
    ...(p.portee !== "" ? [`${p.portee} m`] : []),
    ...p.sauvegardes.map((s) => t("apercuSauvegarde", { carac: (ABILITY_LABELS[s.ability as Ability] ?? s.ability).slice(0, 3).toUpperCase(), dd: s.dc })),
  ];
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-edge p-3">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("apercuBouton")}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-ink">{p.libelle || t("nouvelleUtilisation")}</span>
          <span className="text-xs text-ink-soft">{morceaux.join(" · ")}</span>
        </div>
        <span className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink opacity-70" aria-hidden="true">
          {t("utiliser")}
        </span>
      </div>
    </div>
  );
}
