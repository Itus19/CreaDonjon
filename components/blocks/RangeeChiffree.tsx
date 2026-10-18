"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ftToM } from "@/src/core/rules/encumbrance";
import { squaresFromMeters } from "@/src/core/rules/gridSquares";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { DeathSaves } from "@/src/core/rules/deathSaves";
import type { Concentration } from "@/src/core/schemas/runtimeState";
import type { EtatMourant } from "@/lib/ui/etatMourant";
import type { DeDeVie } from "@/lib/ui/outilTable";
import ActionsMenu from "@/components/shared/ActionsMenu";
import CommandeE, { CommandeESquelette } from "@/components/shared/CommandeE";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "@/components/shell/useMatchMedia";
import BlocMourant from "./BlocMourant";
import NomDeRegle from "./NomDeRegle";
import { useWorldRuleEntries } from "./useWorldRuleEntries";

/**
 * Badge de statistique (V1-C4 suite) : la charte interdit les couleurs
 * codées en dur (specs/coquille-et-design.md §2), donc CA/Initiative/
 * Vitesse/etc. se distinguent par forme et libellé plutôt que par une
 * couleur inventée par stat. Libellé au-dessus d'un encadré de hauteur fixe
 * (meme structure que le bouclier de CA, meme hauteur `h-14`) — sur retour
 * utilisateur, l'ancien libellé-dans-l'encadré donnait des hauteurs
 * variables selon que le libellé tenait sur une ou deux lignes.
 */
/** `onClick` (V2-M11) : seule l'Initiative s'en sert aujourd'hui — un jet declenche depuis le volet de lancer de des, jamais un second calcul ici. */
export function StatBadge({
  label,
  value,
  sub,
  danger,
  chargement,
  onClick,
}: {
  label: string;
  value: string;
  /** Seconde ligne, plus discrete, sous la valeur : une meme mesure dans une autre unite (la vitesse en cases de plateau), jamais une donnee sans rapport. */
  sub?: string;
  danger?: boolean;
  /** V3.1-26 : la fiche calculee n'est pas prete — case creuse, SANS chiffre (jamais la valeur provisoire). */
  chargement?: boolean;
  onClick?: () => void;
}) {
  if (chargement) {
    return (
      <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1" aria-hidden="true">
        <span className="flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide text-ink-muted">{label}</span>
        <div className="h-14 w-full animate-pulse rounded-md border border-edge bg-panel-sunken" />
      </div>
    );
  }
  const box = (
    <div
      className={`flex h-14 w-full flex-col items-center justify-center rounded-md border ${
        danger ? "border-danger/60 bg-danger/10" : "border-edge bg-panel-raised"
      } ${onClick ? "cursor-pointer hover:border-accent" : ""}`}
    >
      <span className={`text-base font-semibold leading-tight ${danger ? "text-danger" : "text-ink"}`}>{value}</span>
      {sub && <span className="text-xs leading-tight text-ink-muted">{sub}</span>}
    </div>
  );
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span
        className={`flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide ${
          danger ? "text-danger" : "text-ink-muted"
        }`}
      >
        {label}
      </span>
      {onClick ? (
        <button type="button" onClick={onClick} title={`Lancer ${label}`} className="w-full">
          {box}
        </button>
      ) : (
        box
      )}
    </div>
  );
}

/**
 * Badge à ▲ et ▼ INTEGRES (V3.1-26, Inspiration ; V3.1-34, Dés de vie) :
 * exactement le gabarit d'un `StatBadge` (72 x 56 px, meme chiffre `text-base`).
 * Accentué quand `actif`. Ne transmet qu'un ecart.
 * Les fleches font 16 px de haut ; leur zone de clic descend a 24 px vers le
 * centre (le badge est `overflow-hidden`, une extension vers l'exterieur serait rognee).
 */
function BadgeAFleches({
  libelle,
  texte,
  actif,
  chargement,
  ajouterDesactive,
  retirerDesactive,
  titreAjouter,
  titreRetirer,
  onChange,
}: {
  libelle: string;
  texte: string;
  actif: boolean;
  chargement: boolean;
  ajouterDesactive: boolean;
  retirerDesactive: boolean;
  titreAjouter: string;
  titreRetirer: string;
  onChange: (delta: number) => void;
}) {
  if (chargement) return <StatBadge label={libelle} value="" chargement />;
  const fleche =
    "relative flex h-4 w-full shrink-0 items-center justify-center text-xs leading-none text-ink-muted transition-colors after:absolute after:inset-x-0 after:h-6 after:content-[''] hover:text-accent disabled:opacity-30 disabled:hover:text-ink-muted";
  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1">
      <span className={`flex h-8 items-end justify-center text-center text-xs font-bold uppercase leading-tight tracking-wide ${actif ? "text-accent" : "text-ink-muted"}`}>
        {libelle}
      </span>
      <div className={`flex h-14 w-full flex-col overflow-hidden rounded-md border ${actif ? "border-accent/60 bg-accent/10" : "border-edge bg-panel-raised"}`}>
        <button
          type="button"
          disabled={ajouterDesactive}
          onClick={() => onChange(1)}
          title={titreAjouter}
          aria-label={titreAjouter}
          className={`${fleche} after:top-0`}
        >
          ▲
        </button>
        <span className={`flex flex-1 items-center justify-center text-base font-semibold leading-none ${actif ? "text-accent" : "text-ink"}`}>{texte}</span>
        <button
          type="button"
          disabled={retirerDesactive}
          onClick={() => onChange(-1)}
          title={titreRetirer}
          aria-label={titreRetirer}
          className={`${fleche} after:bottom-0`}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

/** Inspiration (V3.1-26) : accentuee quand on en a (un bien, la ou l'epuisement passe en `danger`). */
function InspirationBadge({
  valeur,
  chargement,
  desactive,
  onChange,
}: {
  valeur: number;
  chargement: boolean;
  desactive: boolean;
  onChange: (delta: number) => void;
}) {
  return (
    <BadgeAFleches
      libelle="Inspiration"
      texte={String(valeur)}
      actif={valeur > 0}
      chargement={chargement}
      ajouterDesactive={desactive}
      retirerDesactive={desactive || valeur <= 0}
      titreAjouter="Ajouter une inspiration"
      titreRetirer="Retirer une inspiration"
      onChange={onChange}
    />
  );
}

/** Un type de dé de vie (V3.1-34, mode MJ) : « restants/total », ▲ en rend un, ▼ en dépense un. */
function DesDeVieBadge({
  de,
  desactive,
  onChange,
}: {
  de: DeDeVie;
  desactive: boolean;
  onChange: (delta: number) => void;
}) {
  const t = useTranslations("table");
  return (
    <BadgeAFleches
      libelle={t("desDeVie", { die: de.die })}
      texte={`${de.restants}/${de.total}`}
      actif={false}
      chargement={false}
      ajouterDesactive={desactive || de.restants >= de.total}
      retirerDesactive={desactive || de.restants <= 0}
      titreAjouter={t("rendreDe", { die: de.die })}
      titreRetirer={t("depenserDe", { die: de.die })}
      onChange={onChange}
    />
  );
}

const PASTILLE_ETAT = "rounded-full border border-danger text-xs text-danger";
const CROIX =
  "relative flex h-4 w-4 items-center justify-center rounded-full text-xs leading-none text-ink-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:text-danger disabled:opacity-40";

export interface RangeeChiffreeProps {
  worldSlug: string;
  sheet: DerivedSheet;
  /** V3.1-26 : la fiche calculée est prête (règles résolues + état de jeu). Faux : squelette, aucun chiffre. */
  pret: boolean;
  busy: boolean;
  exhaustion: number;
  onChangeExhaustion: (delta: number) => void;
  inspiration: number;
  onChangeInspiration: (delta: number) => void;
  /** Les états en cours : des noms LISIBLES, pas des clés (voir `CharacterSheetHeader`). */
  conditions: string[];
  hpCurrent: number;
  hpTemp: number;
  hpMax: number;
  hpLow: boolean;
  onChangeHp: (delta: number) => void;
  xpCurrent: number;
  xpCeiling: number;
  xpPct: number;
  totalLevel: number;
  xpLevelThresholdsLength: number;
  onChangeXp: (delta: number) => void;
  /** Initiative cliquable seulement si fourni : le MJ de l'outil Table n'a aucune commande sur les valeurs dérivées. */
  onRollInitiative?: () => void;
  etatMourant?: EtatMourant;
  deathSaves?: DeathSaves;
  dernierD20?: number | null;
  onJetDeMort?: () => void;
  concentration?: Concentration | null;

  // ---- V3.1-34, mode MJ : absentes côté fiche, qui ne change donc pas ----
  /** Dés de vie restants/total par type ; avec `onChangeHitDice`, ▲▼ intégrés au badge (un badge par dé). */
  desDeVie?: DeDeVie[];
  onChangeHitDice?: (die: DeDeVie["die"], delta: number) => void;
  /** × sur chaque pastille d'état. */
  onRetirerEtat?: (nom: string) => void;
  /** « + » ouvre `etatsDisponibles` (les états du ruleset) : feuille du bas sur téléphone, menu au-delà. */
  onAjouterEtat?: (nom: string) => void;
  etatsDisponibles?: string[];
  /** × sur la concentration. */
  onRompreConcentration?: () => void;
}

/**
 * La « rangée chiffrée » de la fiche (V3.1-26), extraite de
 * `CharacterSheetHeader` par V3.1-34 pour que l'outil Table du MJ montre
 * EXACTEMENT le même haut de fiche : bouclier de CA, trois jauges à commande E
 * (PV, niveau/XP, épuisement), un filet, les constantes en badges, puis la
 * concentration et les états. À poser dans un `@container` (le filet n'apparaît
 * qu'à partir de 40rem de conteneur).
 *
 * Tant que `pret` est faux (règles résolues ou état de jeu pas encore
 * arrivés), AUCUN chiffre : un squelette de même encombrement. Les valeurs
 * de départ d'avant (CA 11, PV 0/0) étaient fausses, et la CA provisoire
 * différait entre le rendu serveur et le navigateur (erreur d'hydratation).
 */
export default function RangeeChiffree({
  worldSlug,
  sheet,
  pret,
  busy,
  exhaustion,
  onChangeExhaustion,
  inspiration,
  onChangeInspiration,
  conditions,
  hpCurrent,
  hpTemp,
  hpMax,
  hpLow,
  onChangeHp,
  xpCurrent,
  xpCeiling,
  xpPct,
  totalLevel,
  xpLevelThresholdsLength,
  onChangeXp,
  onRollInitiative,
  etatMourant = "vivant",
  deathSaves = { success: 0, fail: 0 },
  dernierD20 = null,
  onJetDeMort = () => {},
  concentration = null,
  desDeVie,
  onChangeHitDice,
  onRetirerEtat,
  onAjouterEtat,
  etatsDisponibles = [],
  onRompreConcentration,
}: RangeeChiffreeProps) {
  const t = useTranslations("table");
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);
  const [feuilleEtats, setFeuilleEtats] = useState(false);

  // V3.1-32 : un état ou l'épuisement n'ouvre une règle que si la fiche existe dans le
  // ruleset du monde (jamais une clé devinée). Les états sont stockés par NOM traduit.
  const regles = useWorldRuleEntries(worldSlug);
  const reglesEtats = regles.filter((e) => e.entryType === "condition");
  const cleEtat = (nom: string) => reglesEtats.find((e) => e.name.toLowerCase() === nom.toLowerCase())?.key;
  const cleEpuisement = reglesEtats.find((e) => e.key === "exhaustion")?.key;

  // Cases comptées depuis les METRES affichés, pas depuis les pieds d'origine :
  // les deux lignes de la case Vitesse doivent pouvoir se vérifier l'une par
  // l'autre. Mètres arrondis AU METRE (30 pieds -> 9 m, V3.1-26) ; le compte
  // en cases reste celui du SRD pour toute vitesse par pas de 5 pieds de 5 à 100
  // (vérifié à la main, voir `gridSquares.test.ts` pour les vitesses standard).
  const speedMeters = Math.round(ftToM(sheet.speed.value));
  const speedSquares = squaresFromMeters(speedMeters);

  const dejaPoses = new Set(conditions.map((c) => c.toLowerCase()));
  const aPoser = etatsDisponibles.filter((nom) => !dejaPoses.has(nom.toLowerCase()));

  return (
    <>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-8 items-end justify-center text-xs font-bold uppercase tracking-wide text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
            title="Classe d'armure — calculée automatiquement (10 + Dex + équipement)"
          >
            {pret && <span className="text-xl font-bold text-ink">{sheet.ac.value}</span>}
          </div>
        </div>

        {pret ? (
          <>
            {etatMourant === "vivant" ? (
              <CommandeE
                libelle="Points de vie"
                valeur={hpCurrent}
                maximum={hpMax}
                danger={hpLow}
                complement={hpTemp > 0 ? `+${hpTemp} temp.` : undefined}
                desactive={busy}
                onDelta={onChangeHp}
              />
            ) : (
              <BlocMourant etat={etatMourant} deathSaves={deathSaves} desactive={busy} dernierD20={dernierD20} onJetDeMort={onJetDeMort} onSoigner={onChangeHp} />
            )}
            <CommandeE
              libelle={`Niveau ${totalLevel}`}
              valeur={xpCurrent}
              progression={xpPct}
              complement={totalLevel < xpLevelThresholdsLength ? `niveau ${totalLevel + 1} à ${xpCeiling}` : undefined}
              desactive={busy}
              onDelta={onChangeXp}
            />
            <CommandeE
              libelle="Épuisement"
              nomVisible={
                cleEpuisement ? (
                  // Le reset de Tailwind remet `text-transform: none` sur un bouton :
                  // sans ceci, « Épuisement » sortait en casse mixte au milieu des
                  // libelles en capitales des autres jauges.
                  <span className="[&_button]:uppercase">
                    <NomDeRegle worldSlug={worldSlug} ruleKey={cleEpuisement}>Épuisement</NomDeRegle>
                  </span>
                ) : undefined
              }
              valeur={exhaustion} maximum={6} danger={exhaustion > 0} desactive={busy} onDelta={onChangeExhaustion} />
          </>
        ) : (
          <>
            <CommandeESquelette libelle="Points de vie" />
            <CommandeESquelette libelle="Niveau" />
            <CommandeESquelette libelle="Épuisement" />
          </>
        )}

        <div className="hidden h-14 w-px self-end bg-edge/60 @min-[40rem]:block" aria-hidden="true" />

        <div className="flex flex-wrap items-start gap-2">
          <StatBadge
            label="Initiative"
            value={`${sheet.abilities.dex.mod >= 0 ? "+" : ""}${sheet.abilities.dex.mod}`}
            chargement={!pret}
            onClick={onRollInitiative}
          />
          {/* Vitesse en cases du plateau sous les mètres (retour utilisateur) :
              la même mesure dans l'unité réellement utilisée à la table. Mètres
              arrondis au mètre (« 9 m », pas « 9.1 m »), cases comptées depuis ces
              mètres : à la case inférieure, on ne franchit pas une case à moitié. */}
          <StatBadge
            label="Vitesse"
            value={`${speedMeters} m`}
            sub={`${speedSquares} case${speedSquares > 1 ? "s" : ""}`}
            chargement={!pret}
          />
          <StatBadge label="Perception passive" value={String(10 + sheet.skills.perception.mod)} chargement={!pret} />
          <StatBadge label="Maîtrise" value={`+${sheet.proficiencyBonus}`} chargement={!pret} />
          {pret && onChangeHitDice && desDeVie && desDeVie.length > 0 ? (
            desDeVie.map((de) => (
              <DesDeVieBadge key={de.die} de={de} desactive={busy} onChange={(delta) => onChangeHitDice(de.die, delta)} />
            ))
          ) : (
            <StatBadge label="Dés de vie" value={sheet.hitPoints.hitDice} chargement={!pret} />
          )}
          <InspirationBadge
            valeur={inspiration}
            chargement={!pret}
            desactive={busy}
            onChange={onChangeInspiration}
          />
        </div>
      </div>

      {/* V3.1-32 — la concentration en cours, juste avant les états. Sur la fiche :
          affichage seul. Sur la Table (V3.1-34), le × la rompt. Le sort ouvre sa règle
          (sa clé vient de l'état de jeu) ; sans clé, le libellé reste du texte. */}
      {concentration && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Concentration</span>
          {concentration.spell_key ? (
            <NomDeRegle worldSlug={worldSlug} ruleKey={concentration.spell_key}>
              {concentration.label}
            </NomDeRegle>
          ) : (
            <span className="text-ink">{concentration.label}</span>
          )}
          {onRompreConcentration && (
            <button type="button" disabled={busy} onClick={onRompreConcentration} title={t("rompreConcentration")} aria-label={t("rompreConcentration")} className={CROIX}>
              ×
            </button>
          )}
        </div>
      )}

      {/* V2.1-26 — les états en cours. Ils étaient déjà en base, écrits par
          l'écran Initiative, et la fiche ne les montrait nulle part : le MJ
          posait un état, le joueur ne le voyait pas. */}
      {(conditions.length > 0 || onAjouterEtat) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">États</span>
          {conditions.map((condition) => {
            const cle = cleEtat(condition);
            const nom = cle ? <NomDeRegle worldSlug={worldSlug} ruleKey={cle}>{condition}</NomDeRegle> : condition;
            if (!onRetirerEtat) {
              return (
                <span key={condition} className={`${PASTILLE_ETAT} px-3 py-1`}>
                  {nom}
                </span>
              );
            }
            return (
              <span key={condition} className={`${PASTILLE_ETAT} inline-flex items-center gap-1.5 py-1 pl-3 pr-2`}>
                {nom}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRetirerEtat(condition)}
                  title={t("retirerEtat", { nom: condition })}
                  aria-label={t("retirerEtat", { nom: condition })}
                  className={CROIX}
                >
                  ×
                </button>
              </span>
            );
          })}
          {onAjouterEtat &&
            (estTelephone ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setFeuilleEtats(true)}
                aria-haspopup="dialog"
                title={t("ajouterEtat")}
                aria-label={t("ajouterEtat")}
                className="min-h-8 min-w-8 rounded-full border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                +
              </button>
            ) : (
              <ActionsMenu
                label="+"
                aria-label={t("ajouterEtat")}
                triggerClassName="rounded-full border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
                items={aPoser.map((nom) => ({ label: nom, onSelect: () => onAjouterEtat(nom) }))}
              />
            ))}
        </div>
      )}

      {feuilleEtats && onAjouterEtat && (
        <FeuilleDuBas titre={t("ajouterEtat")} titreVisible onFermer={() => setFeuilleEtats(false)}>
          {aPoser.length === 0 ? (
            <p className="px-1 pb-2 text-sm text-ink-muted">{t("aucunEtatAPoser")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 pb-1">
              {aPoser.map((nom) => (
                <li key={nom}>
                  <button
                    type="button"
                    onClick={() => {
                      onAjouterEtat(nom);
                      setFeuilleEtats(false);
                    }}
                    className="flex min-h-11 w-full items-center rounded-2xl border border-edge bg-panel px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-panel-raised"
                  >
                    {nom}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FeuilleDuBas>
      )}
    </>
  );
}
