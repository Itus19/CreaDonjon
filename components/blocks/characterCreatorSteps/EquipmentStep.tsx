"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { ArmorBlockData, ItemPropertiesBlockData, WeaponBlockData } from "@/src/core/schemas/rule-blocks";
import type { CharacterRules } from "@/src/core/schemas/rule-blocks/characterRules";
import type { RuleEntrySummary } from "@/src/server/services/rules";
import { armorDataFromBlock, costFromQuantity, perUnitCost, perUnitWeight, weaponDataFromBlock, weightFromQuantity, type ArmorData, type ItemCost, type WeaponData } from "@/src/core/rules/srdMapping";
import { depositCoins, spendCoins, totalValueCp } from "@/src/core/rules/currency";
import { ftToM, lbToKg, type EncumbranceResult } from "@/src/core/rules/encumbrance";
import { startingAtHigherLevel, startingGold } from "@/src/core/rules/characterRules";
import { weaponAttackAbilityMod } from "@/src/core/rules/action";
import { ARMOR_CATEGORY_LABELS_FR, CURRENCY_LABELS_FR, DAMAGE_TYPE_LABELS_FR, ITEM_RARITY_LABELS_FR, WEAPON_MASTERY_LABELS_FR, WEAPON_PROPERTY_LABELS_FR } from "@/src/i18n/fr";
import { acheter, basculerPort, emplacementDe, filtrerBoutique, rendre, type Emplacement } from "@/lib/ui/equipement";
import { mouvementReduit } from "@/lib/ui/animationDe";
import { lancerOrDeDepartApi } from "@/lib/ui/orDeDepartApi";
import Checkbox from "@/components/shared/Checkbox";
import { useRuleEntryBlocks, type RuleEntryBlockData } from "../useRuleEntryBlocks";
import { itemLabel, itemRef } from "../inventoryItem";
import { withModifier } from "../InventoryPanel";
import IconeEquipement from "./IconesEquipement";

/**
 * L'or du départ à haut niveau déjà versé (V3.1-53), gardé par l'assistant :
 * revenir sur l'écran ne relance pas le dé, et un changement de palier retire
 * cet or de la bourse avant d'en proposer un nouveau.
 */
export interface OrDepart {
  minLevel: number;
  or: number;
  rolls: number[];
}

const EMPLACEMENTS: readonly Emplacement[] = ["armor", "main", "shield"];
const DUREE_SCINTILLEMENT_MS = 650;
const PAS_SCINTILLEMENT_MS = 55;
const BOURSE_VIDE = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

/** Un objet connu du monde (boutique, inventaire, objets magiques) : ce qu'il faut pour le lister, le chercher et le montrer chiffré. */
interface Objet {
  key: string;
  nom: string;
  emplacement: Emplacement | null;
  arme: WeaponData | null;
  armure: ArmorData | null;
  fiche: string;
  texte: string;
  /** Poids et prix d'UNE unité : l'inventaire compte des unités (« 20 × Flèches »). */
  poidsLb: number | null;
  cout: ItemCost | null;
  /** V3.1-53 : la boutique vend un lot entier (20 flèches) ; 1 pour un objet vendu seul. */
  lot: number;
  poidsLotLb: number | null;
  coutLot: ItemCost | null;
}

type Traduire = (cle: string, valeurs?: Record<string, string | number>) => string;

function bloc<T>(blocs: RuleEntryBlockData[] | undefined, type: string): T | null {
  const trouve = blocs?.find((b) => b.blockType === type);
  return trouve ? (trouve.data as T) : null;
}

function minuscule(texte: string): string {
  return texte.charAt(0).toLocaleLowerCase("fr") + texte.slice(1);
}

function prix(cout: ItemCost | null): string {
  if (!cout) return "—";
  return `${cout.quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${CURRENCY_LABELS_FR[cout.unit] ?? cout.unit}`;
}

function poids(lb: number | null): string {
  return lb ? `${lbToKg(lb).toLocaleString("fr-FR")} kg` : "—";
}

function metres(ft: number): string {
  return ftToM(ft).toLocaleString("fr-FR");
}

function signe(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

/** La fiche chiffrée d'une arme : dés et propriétés, portée, botte. */
function ficheArme(arme: WeaponData, portee: WeaponBlockData["range"] | undefined, t: Traduire): string {
  const type = arme.damageType ? minuscule(DAMAGE_TYPE_LABELS_FR[arme.damageType] ?? arme.damageType) : "";
  const proprietes = arme.properties
    .filter((p) => p !== "monk" && p !== "versatile")
    .map((p) => minuscule(WEAPON_PROPERTY_LABELS_FR[p] ?? p));
  return [
    `${arme.damageDice} ${type}`.trim(),
    arme.versatileDamageDice ? t("equip.fiche.polyvalente", { des: arme.versatileDamageDice }) : null,
    ...proprietes,
    portee ? t("equip.fiche.portee", { n: portee.long ? `${metres(portee.normal.value)}/${metres(portee.long.value)}` : metres(portee.normal.value) }) : null,
    arme.masteryKey ? t("equip.fiche.botte", { nom: WEAPON_MASTERY_LABELS_FR[arme.masteryKey] ?? arme.masteryKey }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** La fiche chiffrée d'une armure ou d'un bouclier : CA, limite de Dextérité, Force requise, discrétion. */
function ficheArmure(armure: ArmorData, bloc: ArmorBlockData | null, t: Traduire): string {
  if (armure.category === "Shield") return t("equip.fiche.bouclier", { n: armure.base });
  const dex = !armure.dexBonus ? "" : bloc?.max_dex_bonus !== undefined ? t("equip.fiche.caDexMax", { n: bloc.max_dex_bonus }) : t("equip.fiche.caDex");
  return [
    `${t("equip.fiche.ca", { n: armure.base })}${dex}`,
    bloc?.strength_minimum ? t("equip.fiche.force", { n: bloc.strength_minimum }) : null,
    bloc?.stealth_disadvantage ? t("equip.fiche.discretion") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Un objet du monde d'après ses blocs de règle (`weapon`, `armor`, `item_properties`). */
function objetDepuisBlocs(entree: RuleEntrySummary, blocs: RuleEntryBlockData[] | undefined, t: Traduire): Objet {
  const dataArme = bloc<WeaponBlockData>(blocs, "weapon");
  const dataArmure = bloc<ArmorBlockData>(blocs, "armor");
  const dataObjet = bloc<ItemPropertiesBlockData>(blocs, "item_properties");
  const arme = dataArme ? weaponDataFromBlock(dataArme) : null;
  const armure = dataArmure ? armorDataFromBlock(dataArmure) : null;
  const emplacement = emplacementDe(armure, arme);
  const fiche = armure ? ficheArmure(armure, dataArmure, t) : arme ? ficheArme(arme, dataArme?.range, t) : "";
  const poidsLotLb = weightFromQuantity(dataArme?.weight ?? dataArmure?.weight ?? dataObjet?.weight);
  const coutLot = costFromQuantity(dataArme?.cost ?? dataArmure?.cost ?? dataObjet?.cost);
  const type = emplacement === "shield" ? t("equip.type.bouclier") : armure ? t("equip.type.armure") : arme ? t("equip.type.arme") : t("equip.type.objet");
  const categorie = armure
    ? (ARMOR_CATEGORY_LABELS_FR[armure.category] ?? "")
    : dataArme
      ? `${t(dataArme.category === "martial" ? "equip.cat.guerre" : "equip.cat.courante")} ${t(dataArme.is_ranged ? "equip.cat.distance" : "equip.cat.corps")}`
      : "";
  return {
    key: entree.key,
    nom: entree.name,
    emplacement,
    arme,
    armure,
    fiche,
    // Le texte cherché : nom, type, catégorie, dégâts et propriétés, dans les libellés français déjà affichés.
    texte: [entree.name, type, categorie, fiche].join(" "),
    poidsLb: perUnitWeight(poidsLotLb, dataObjet?.bundle_size),
    cout: perUnitCost(coutLot, dataObjet?.bundle_size),
    lot: dataObjet?.bundle_size ?? 1,
    poidsLotLb,
    coutLot,
  };
}

function libelleRarete(rarete: string): string {
  const cle = Object.keys(ITEM_RARITY_LABELS_FR).find((k) => k.toLowerCase() === rarete.toLowerCase());
  return cle ? minuscule(ITEM_RARITY_LABELS_FR[cle]) : rarete;
}

interface Props {
  worldSlug: string;
  inventory: InventoryBlockData;
  onUpdateInventory: Dispatch<SetStateAction<InventoryBlockData>>;
  /** Le nom et le type de chaque règle du monde (`useWorldRuleEntries`, déjà chargé par l'assistant). */
  allEntries: RuleEntrySummary[];
  /** La classe d'armure du moteur (`sheet.ac.value`) : jamais recalculée ici (règle 16). */
  ca: number;
  encumbrance: EncumbranceResult;
  strMod: number;
  dexMod: number;
  proficiencyBonus: number;
  weaponByKey: Record<string, WeaponData | null>;
  equipment: Record<string, ArmorData | null>;
  weight: Record<string, number | null>;
  cost: Record<string, ItemCost | null>;
  characterRules: CharacterRules | undefined;
  niveauTotal: number;
  orDepart: OrDepart | null;
  onChangeOrDepart: (valeur: OrDepart | null) => void;
}

interface Scintillement {
  emplacement: Emplacement;
  caDepart: number;
  progres: number;
  pas: number;
}

/**
 * V3.1-53 — L'étape Équipement : la bourse et la charge, trois tuiles (Armure,
 * Main principale, Main secondaire), l'inventaire en ordre alphabétique avec sa
 * bande d'équipement, la boutique cherchable et le départ à haut niveau.
 *
 * Les gestes sur l'inventaire (porter, acheter, rendre) sont purs
 * (`lib/ui/equipement.ts`) ; la CA, la charge et le bonus de maîtrise viennent
 * du moteur. Les blocs de règle des objets du monde ne sont demandés qu'une fois
 * la boutique ouverte (ou la sous-étape des objets magiques visible) : un seul
 * appel, jamais au montage (docs/QUOTAS.md).
 */
export default function EquipmentStep({
  worldSlug,
  inventory,
  onUpdateInventory,
  allEntries,
  ca,
  encumbrance,
  strMod,
  dexMod,
  proficiencyBonus,
  weaponByKey,
  equipment,
  weight,
  cost,
  characterRules,
  niveauTotal,
  orDepart,
  onChangeOrDepart,
}: Props) {
  const tNext = useTranslations("creation");
  const t: Traduire = (cle, valeurs) => tNext(cle, valeurs);

  const [ouverte, setOuverte] = useState(false);
  const [requete, setRequete] = useState("");
  const [scintillement, setScintillement] = useState<Scintillement | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreurOr, setErreurOr] = useState<string | null>(null);
  const [orRetire, setOrRetire] = useState<number | null>(null);

  const palier = startingAtHigherLevel(characterRules ?? {}, niveauTotal);
  const picks = palier?.magic_item_picks ?? [];
  const visibleMagique = picks.length > 0;

  const entreesBoutique = useMemo(() => allEntries.filter((e) => e.entryType === "weapon" || e.entryType === "armor" || e.entryType === "item"), [allEntries]);
  const entreesMagiques = useMemo(() => allEntries.filter((e) => e.entryType === "magic_item"), [allEntries]);
  const nomParCle = useMemo(() => new Map(allEntries.map((e) => [e.key, e.name])), [allEntries]);

  // Un seul appel, et seulement quand on en a besoin : boutique ouverte (avec les objets déjà possédés, pour leur fiche
  // complète) ou objets magiques visibles. Fermée et sans palier magique : aucune clé, aucune requête.
  const clesPossedees = inventory.items.flatMap((item) => {
    const ref = itemRef(item);
    return ref?.kind === "rule" ? [ref.key] : [];
  });
  const cles = [...(ouverte ? [...entreesBoutique.map((e) => e.key), ...clesPossedees] : []), ...(visibleMagique ? entreesMagiques.map((e) => e.key) : [])];
  const blocs = useRuleEntryBlocks(worldSlug, cles);

  const catalogue = useMemo(() => {
    const parCle = new Map<string, Objet>();
    for (const entree of [...entreesBoutique, ...entreesMagiques]) {
      if (blocs[entree.key]) parCle.set(entree.key, objetDepuisBlocs(entree, blocs[entree.key], t));
    }
    return parCle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocs, entreesBoutique, entreesMagiques]);

  /** Un objet possédé : la fiche complète de la boutique si elle est chargée, sinon ce que le moteur en sait déjà. */
  function objetDeCle(cle: string): Objet {
    const connu = catalogue.get(cle);
    if (connu) return connu;
    const arme = weaponByKey[cle] ?? null;
    const armure = equipment[cle] ?? null;
    return {
      key: cle,
      nom: nomParCle.get(cle) ?? cle,
      emplacement: emplacementDe(armure, arme),
      arme,
      armure,
      fiche: armure ? ficheArmure(armure, null, t) : arme ? ficheArme(arme, undefined, t) : "",
      texte: "",
      poidsLb: weight[cle] ?? null,
      cout: cost[cle] ?? null,
      lot: 1,
      poidsLotLb: weight[cle] ?? null,
      coutLot: cost[cle] ?? null,
    };
  }

  // --- Inventaire -----------------------------------------------------------
  const lignes = inventory.items.map((item, index) => {
    const ref = itemRef(item);
    const objet = ref?.kind === "rule" ? objetDeCle(ref.key) : null;
    return {
      item,
      index,
      objet,
      nom: objet ? objet.nom : itemLabel(item),
      emplacement: objet?.emplacement ?? null,
      magique: ref?.kind === "rule" && allEntries.some((e) => e.key === ref.key && e.entryType === "magic_item"),
    };
  });
  const emplacements = lignes.map((l) => l.emplacement);
  const lignesTriees = [...lignes].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  function porter(index: number) {
    const emplacement = emplacements[index];
    if (!emplacement) return;
    if (!mouvementReduit(typeof window === "undefined" ? undefined : window.matchMedia.bind(window))) {
      setScintillement({ emplacement, caDepart: ca, progres: 0, pas: 0 });
    }
    onUpdateInventory((prev) => ({ ...prev, items: basculerPort(prev.items, index, emplacements) }));
  }

  // Le scintillement dure ~650 ms ; la CA affichée compte jusqu'à celle du moteur pendant ce temps.
  const enCours = scintillement !== null;
  useEffect(() => {
    if (!enCours) return;
    const debut = Date.now();
    const horloge = setInterval(() => {
      const ecoule = Date.now() - debut;
      if (ecoule >= DUREE_SCINTILLEMENT_MS) {
        setScintillement(null);
        return;
      }
      setScintillement((s) => (s ? { ...s, progres: ecoule / DUREE_SCINTILLEMENT_MS, pas: s.pas + 1 } : s));
    }, PAS_SCINTILLEMENT_MS);
    return () => clearInterval(horloge);
  }, [enCours]);

  const caAffichee = scintillement ? Math.round(scintillement.caDepart + (ca - scintillement.caDepart) * scintillement.progres) : ca;

  function rendreObjet(index: number, cout: ItemCost | null) {
    onUpdateInventory((prev) => rendre(prev, index, cout, 1));
  }

  // --- Les trois tuiles -----------------------------------------------------
  const porteDe = (emplacement: Emplacement) => lignes.find((l) => l.emplacement === emplacement && l.item.equipped === true);
  const nomsParEmplacement = (emplacement: Emplacement): Objet[] => {
    const parNom = new Map<string, Objet>();
    for (const o of catalogue.values()) if (o.emplacement === emplacement) parNom.set(o.key, o);
    for (const l of lignes) if (l.objet && l.emplacement === emplacement) parNom.set(l.objet.key, l.objet);
    return [...parNom.values()];
  };

  const arme = porteDe("main")?.objet?.arme ?? null;
  const modArme = arme ? weaponAttackAbilityMod(arme.properties, arme.isRanged, strMod, dexMod) : 0;
  const attaque = arme
    ? `${signe(modArme + proficiencyBonus)} · ${withModifier(arme.damageDice, modArme)}${arme.damageType ? ` ${minuscule(DAMAGE_TYPE_LABELS_FR[arme.damageType] ?? arme.damageType)}` : ""}`
    : "—";

  // --- Boutique -------------------------------------------------------------
  const objetsBoutique = useMemo(
    () => entreesBoutique.flatMap((e) => (catalogue.get(e.key) ? [catalogue.get(e.key) as Objet] : [])).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [entreesBoutique, catalogue]
  );
  const resultats = useMemo(() => filtrerBoutique(objetsBoutique, requete), [objetsBoutique, requete]);

  function nouvelObjet(cle: string, qty = 1): InventoryItem {
    return { id: crypto.randomUUID(), qty, ref: { kind: "rule", key: cle } };
  }

  // Un lot s'achète entier, au prix du lot ; rendu, chaque unité rembourse son prix unitaire.
  function peutAcheter(objet: Objet): boolean {
    return objet.coutLot !== null && acheter(inventory, nouvelObjet(objet.key, objet.lot), objet.coutLot) !== null;
  }

  function acheterObjet(objet: Objet) {
    const prixLot = objet.coutLot;
    if (!prixLot) return;
    onUpdateInventory((prev) => acheter(prev, nouvelObjet(objet.key, objet.lot), prixLot) ?? prev);
  }

  // --- Départ à haut niveau -------------------------------------------------
  async function lancerOr() {
    if (occupe) return;
    if (!palier) return;
    setOccupe(true);
    setErreurOr(null);
    try {
      const jets = palier.gold_roll ? await lancerOrDeDepartApi(palier.gold_roll.count, palier.gold_roll.faces) : [];
      if (!jets) {
        setErreurOr(t("equip.hauteNiveau.echec"));
        return;
      }
      const or = startingGold(palier, jets);
      onUpdateInventory((prev) => ({ ...prev, currency: depositCoins(prev.currency, "gp", or) }));
      onChangeOrDepart({ minLevel: palier.min_level, or, rolls: jets });
      setOrRetire(null);
    } catch (erreur) {
      console.error("Or de départ non lancé", erreur);
      setErreurOr(t("equip.hauteNiveau.echec"));
    } finally {
      setOccupe(false);
    }
  }

  // Le palier a changé (le niveau a bougé) : l'or du précédent quitte la bourse, ou tout ce qui reste s'il ne suffit plus.
  // La référence évite de retirer deux fois le même or (le mode strict rejoue les effets).
  const palierActuel = palier?.min_level ?? null;
  const dejaTraite = useRef<OrDepart | null>(null);
  useEffect(() => {
    if (!orDepart || orDepart.minLevel === palierActuel || dejaTraite.current === orDepart) return;
    dejaTraite.current = orDepart;
    onUpdateInventory((prev) => ({ ...prev, currency: spendCoins(prev.currency, "gp", orDepart.or) ?? BOURSE_VIDE }));
    onChangeOrDepart(null);
    setOrRetire(orDepart.or);
  }, [orDepart, palierActuel, onUpdateInventory, onChangeOrDepart]);

  const orVerse = orDepart && palier && orDepart.minLevel === palier.min_level ? orDepart : null;

  function cocherMagique(objet: Objet, coche: boolean) {
    if (coche) {
      onUpdateInventory((prev) => ({ ...prev, items: [...prev.items, nouvelObjet(objet.key)] }));
      return;
    }
    onUpdateInventory((prev) => {
      const i = prev.items.findIndex((it) => itemRef(it)?.kind === "rule" && (itemRef(it) as { key: string }).key === objet.key);
      return i < 0 ? prev : { ...prev, items: prev.items.filter((_, j) => j !== i) };
    });
  }

  // --- Rendu ----------------------------------------------------------------
  const bourse = (totalValueCp(inventory.currency) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const pourcentCharge = encumbrance.capacity > 0 ? Math.min(100, Math.round((encumbrance.carried / encumbrance.capacity) * 100)) : 0;
  const titresTuile: Record<Emplacement, string> = { armor: t("equip.tuile.armure"), main: t("equip.tuile.main"), shield: t("equip.tuile.secondaire") };
  const videTuile: Record<Emplacement, string> = { armor: t("equip.tuile.sansArmure"), main: t("equip.tuile.mainsNues"), shield: t("equip.tuile.libre") };

  /** Les colonnes communes à l'inventaire et à la boutique : bande, nom et fiche, poids, prix, action. */
  const classeLigne =
    "grid grid-cols-[2.25rem_1fr_3.5rem_4.5rem] items-stretch overflow-hidden rounded-xl border bg-panel-sunken pr-3 @md/equip:grid-cols-[2.25rem_1fr_4.5rem_5.5rem_6rem] @md/equip:gap-x-2";
  const classeBande = "row-span-2 flex items-center justify-center border-r @md/equip:row-span-1";
  const classeAction =
    "col-span-3 col-start-2 mb-2 justify-self-end self-center rounded-full border px-2.5 py-0.5 text-xs @md/equip:col-span-1 @md/equip:col-start-auto @md/equip:mb-0";

  return (
    <div className="@container/equip flex flex-col gap-4">
      {/* En tête : la bourse et la charge. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-edge bg-panel-sunken px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-ink-muted">{t("equip.bourse")}</span>
          <b className="text-base text-ink">{bourse} po</b>
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="uppercase tracking-wide text-ink-muted">{t("equip.charge")}</span>
            <span className={encumbrance.tier === "none" ? "text-ink-soft" : "text-danger"}>
              {t("equip.chargeValeur", { porte: lbToKg(encumbrance.carried).toLocaleString("fr-FR"), capacite: lbToKg(encumbrance.capacity).toLocaleString("fr-FR") })}
            </span>
          </div>
          <div
            role="meter"
            aria-label={t("equip.charge")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pourcentCharge}
            className="h-1.5 overflow-hidden rounded-full bg-panel-raised"
          >
            <div className={`h-full rounded-full ${encumbrance.tier === "none" ? "bg-accent" : "bg-danger"}`} style={{ width: `${pourcentCharge}%` }} />
          </div>
        </div>
      </div>

      {/* Les trois tuiles, sans boutons. */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 @md/equip:grid-cols-3">
          {EMPLACEMENTS.map((emplacement) => {
            const porte = porteDe(emplacement);
            const objet = porte?.objet ?? null;
            const scintille = scintillement?.emplacement === emplacement;
            const reserve = scintille ? nomsParEmplacement(emplacement) : [];
            const montre = scintillement && scintille && reserve.length > 0 ? reserve[(scintillement.pas * 5 + 1) % reserve.length] : objet;
            return (
              <div
                key={emplacement}
                className={`flex min-w-0 flex-col gap-0.5 rounded-xl border bg-panel-sunken px-3 py-2 ${montre ? "border-edge" : "border-dashed border-edge"} ${
                  emplacement === "shield" ? "col-span-2 @md/equip:col-span-1" : ""
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-muted">
                  <IconeEquipement emplacement={emplacement} className="h-3.5 w-3.5" />
                  {titresTuile[emplacement]}
                </span>
                <b className={`text-sm transition-[filter] ${montre ? "text-ink" : "font-medium text-ink-muted"} ${scintille ? "opacity-75 blur-[1.6px]" : ""}`}>
                  {montre ? montre.nom : t("equip.tuile.vide")}
                </b>
                <span className={`text-xs text-ink-soft ${scintille ? "opacity-75 blur-[1.6px]" : ""}`}>{montre ? montre.fiche : videTuile[emplacement]}</span>
                {objet && !scintille && (
                  <span className="font-mono text-xs text-ink-muted">
                    {poids(objet.poidsLb)} · {prix(objet.cout)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-1 text-sm text-ink-soft">
          <span>
            {t("equip.ca")} <b className={`text-ink ${scintillement ? "blur-[1.2px]" : ""}`}>{caAffichee}</b>
          </span>
          <span>
            {t("equip.attaque")} <b className="text-ink">{attaque}</b>
          </span>
        </p>
      </div>

      {/* L'inventaire, par ordre alphabétique, objets portés compris. */}
      <section aria-label={t("equip.inventaire.titre")} className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-ink">{t("equip.inventaire.titre")}</h3>
        {lignesTriees.length === 0 && <p className="text-sm text-ink-muted">{t("equip.inventaire.vide")}</p>}
        {lignesTriees.map(({ item, index, objet, nom, emplacement, magique }) => {
          const porte = item.equipped === true;
          const cout = objet?.cout ?? null;
          return (
            <div key={item.id} className={`${classeLigne} ${porte ? "border-accent/45" : "border-edge"}`}>
              {emplacement ? (
                <button
                  type="button"
                  aria-pressed={porte}
                  aria-label={t(porte ? "equip.ranger" : "equip.porter", { nom })}
                  title={t(porte ? "equip.ranger" : "equip.porter", { nom })}
                  onClick={() => porter(index)}
                  className={`${classeBande} transition-colors duration-300 motion-reduce:transition-none ${
                    porte ? "border-accent bg-accent text-accent-ink" : "border-edge bg-panel-raised text-ink-muted hover:text-ink"
                  }`}
                >
                  <IconeEquipement emplacement={emplacement} className="h-[1.1rem] w-[1.1rem]" />
                </button>
              ) : (
                <div className={`${classeBande} border-transparent`} aria-hidden />
              )}
              <div className="col-start-2 flex min-w-0 flex-col gap-0.5 px-2.5 py-2 text-sm text-ink">
                <span>
                  {nom}
                  {item.qty > 1 && <span className="text-ink-muted"> ×{item.qty}</span>}
                </span>
                {objet?.fiche && <span className="text-xs text-ink-muted">{objet.fiche}</span>}
              </div>
              {/* La ligne montre le total de la pile (20 flèches : 0,5 kg, 1 po) ; « rendre » retire une unité. */}
              <span className="self-center text-right font-mono text-xs text-ink-muted">{poids(objet?.poidsLb != null ? objet.poidsLb * item.qty : null)}</span>
              <span className="self-center text-right font-mono text-xs text-ink-muted">
                {magique ? t("equip.prixMJ") : prix(cout ? { quantity: cout.quantity * item.qty, unit: cout.unit } : null)}
              </span>
              <button
                type="button"
                aria-disabled={magique}
                onClick={() => {
                  if (magique) return;
                  rendreObjet(index, cout);
                }}
                className={`${classeAction} border-edge text-ink-soft transition-colors hover:bg-panel-raised ${magique ? "cursor-default opacity-40 hover:bg-transparent" : ""}`}
              >
                {magique ? t("equip.sousEtape") : t("equip.rendre")}
              </button>
            </div>
          );
        })}
      </section>

      {/* La boutique, repliée par défaut : ses blocs ne se chargent qu'à l'ouverture. */}
      <section aria-label={t("equip.boutique.titre")} className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={ouverte}
          onClick={() => setOuverte((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-edge px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-panel-raised"
        >
          {t("equip.boutique.titre")}
          <span aria-hidden className="text-xs text-ink-muted">
            {ouverte ? "▴" : "▾"}
          </span>
        </button>
        {ouverte && (
          <div className="flex flex-col gap-2">
            <label className="block">
              <input
                type="search"
                value={requete}
                onChange={(e) => setRequete(e.target.value)}
                aria-label={t("equip.boutique.rechercheAria")}
                placeholder={t("equip.boutique.recherche")}
                className="w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(["epee", "armure", "perforants"] as const).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setRequete(t(`equip.boutique.suggestions.${suggestion}`))}
                  className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
                >
                  {t(`equip.boutique.suggestions.${suggestion}`)}
                </button>
              ))}
              {requete && (
                <button type="button" onClick={() => setRequete("")} className="rounded-full px-3 py-1 text-xs text-ink-muted hover:text-ink">
                  {t("equip.boutique.effacer")}
                </button>
              )}
            </div>
            {objetsBoutique.length === 0 && <p className="text-sm text-ink-muted">{t("equip.boutique.chargement")}</p>}
            {objetsBoutique.length > 0 && resultats.length === 0 && <p className="text-sm text-ink-muted">{t("equip.boutique.aucun")}</p>}
            {resultats.map((objet) => {
              const peut = peutAcheter(objet);
              return (
                <div key={objet.key} className={`${classeLigne} border-edge`}>
                  <div className={`${classeBande} border-transparent text-ink-muted`}>
                    {objet.emplacement && <IconeEquipement emplacement={objet.emplacement} className="h-[1.1rem] w-[1.1rem]" />}
                  </div>
                  <div className="col-start-2 flex min-w-0 flex-col gap-0.5 px-2.5 py-2 text-sm text-ink">
                    <span>{objet.lot > 1 ? t("equip.boutique.lot", { nom: objet.nom, n: objet.lot }) : objet.nom}</span>
                    {objet.fiche && <span className="text-xs text-ink-muted">{objet.fiche}</span>}
                  </div>
                  <span className="self-center text-right font-mono text-xs text-ink-muted">{poids(objet.poidsLotLb)}</span>
                  <span className="self-center text-right font-mono text-xs text-ink-muted">{prix(objet.coutLot)}</span>
                  <button
                    type="button"
                    aria-disabled={!peut}
                    onClick={() => {
                      if (!peut) return;
                      acheterObjet(objet);
                    }}
                    className={`${classeAction} border-accent/60 bg-accent/10 text-accent transition-colors ${peut ? "hover:bg-accent/20" : "cursor-default opacity-40"}`}
                  >
                    {t("equip.acheter")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Départ à haut niveau : or en plus et objets magiques à choisir. */}
      {palier && (
        <section aria-label={t("equip.hauteNiveau.titre", { niveau: niveauTotal })} className="flex flex-col gap-2 rounded-xl border border-edge bg-panel-sunken px-3 py-3">
          <h3 className="text-sm font-semibold text-ink">{t("equip.hauteNiveau.titre", { niveau: niveauTotal })}</h3>
          {(palier.gold > 0 || palier.gold_roll) && (
            <>
              <p className="text-sm text-ink-soft">
                {[
                  palier.gold > 0 ? t("equip.hauteNiveau.fixe", { or: palier.gold.toLocaleString("fr-FR") }) : null,
                  palier.gold_roll ? t("equip.hauteNiveau.jet", { count: palier.gold_roll.count, faces: palier.gold_roll.faces, mult: palier.gold_roll.multiplier }) : null,
                ]
                  .filter(Boolean)
                  .join(" + ")}
              </p>
              {orVerse ? (
                <p className="text-sm text-ink">
                  {orVerse.rolls.length > 0
                    ? t("equip.hauteNiveau.resultat", { jets: orVerse.rolls.join(" + "), or: orVerse.or.toLocaleString("fr-FR") })
                    : t("equip.hauteNiveau.resultatFixe", { or: orVerse.or.toLocaleString("fr-FR") })}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-disabled={occupe}
                    onClick={() => void lancerOr()}
                    className={`rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10 ${occupe ? "opacity-50" : ""}`}
                  >
                    {palier.gold_roll ? t("equip.hauteNiveau.lancer") : t("equip.hauteNiveau.recevoir")}
                  </button>
                  {orRetire !== null && <span className="text-xs text-ink-muted">{t("equip.hauteNiveau.retire", { or: orRetire.toLocaleString("fr-FR") })}</span>}
                </div>
              )}
              {erreurOr && (
                <p role="alert" className="text-sm text-danger">
                  {erreurOr}
                </p>
              )}
            </>
          )}
          {picks.map((pick) => {
            const candidats = entreesMagiques.flatMap((e) => {
              const objet = catalogue.get(e.key);
              const rarete = bloc<ItemPropertiesBlockData>(blocs[e.key], "item_properties")?.rarity;
              return objet && rarete && rarete.toLowerCase() === pick.rarity.toLowerCase() ? [objet] : [];
            });
            const choisis = new Set(clesPossedees);
            const nbChoisis = candidats.filter((c) => choisis.has(c.key)).length;
            return (
              <fieldset key={pick.rarity} className="flex flex-col gap-1.5">
                <legend className="mb-1 text-sm text-ink">{t("equip.hauteNiveau.magique", { rarete: libelleRarete(pick.rarity), choisis: nbChoisis, count: pick.count })}</legend>
                {candidats.length === 0 && <p className="text-xs text-ink-muted">{t("equip.boutique.chargement")}</p>}
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 @md/equip:grid-cols-2">
                  {candidats.map((objet) => {
                    const coche = choisis.has(objet.key);
                    return (
                      <Checkbox
                        key={objet.key}
                        checked={coche}
                        disabled={!coche && nbChoisis >= pick.count}
                        onChange={() => cocherMagique(objet, !coche)}
                        label={<span className="text-sm text-ink">{objet.nom}</span>}
                      />
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </section>
      )}
    </div>
  );
}
