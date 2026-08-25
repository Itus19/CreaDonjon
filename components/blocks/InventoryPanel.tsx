"use client";

import { useState } from "react";
import Link from "next/link";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { weaponAttackAbilityMod } from "@/src/core/rules/action";
import type { ArmorData, ItemCost, WeaponData } from "@/src/core/rules/srdMapping";
import { lbToKg, ftToM } from "@/src/core/rules/encumbrance";
import { CURRENCY_ORDER, depositCoins, spendCoins, type CoinType } from "@/src/core/rules/currency";
import { useReferenceChips, refIdentity, type ResolvedChipView } from "./useReferenceChips";
import { itemLabel, itemRef } from "./inventoryItem";
import ItemAutocomplete from "./ItemAutocomplete";
import { ARMOR_CATEGORY_LABELS_FR, CURRENCY_LABELS_FR, WEAPON_PROPERTY_LABELS_FR } from "@/src/i18n/fr";

/**
 * Bouton d'action a trois lignes (V1-C12, sur retour utilisateur) : verbe
 * (« Attaquer »), formule resolue en nombres (« 1d20+2+2 »), puis le detail
 * symbolique en police plus petite (« 1d20+DEX+maîtrise ») — tout dans le
 * bouton, plus rien en dehors. Les deux formules sont deja calculees par
 * l'appelant (memes valeurs que celles reellement envoyees au serveur au
 * clic, jamais une seconde regle qui pourrait diverger).
 */
function ActionButton({
  label,
  resolvedFormula,
  detailFormula,
  busy,
  onClick,
}: {
  label: string;
  resolvedFormula: string;
  detailFormula: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex min-w-[6.5rem] flex-col items-center gap-0.5 rounded-md border border-edge px-3 py-1.5 text-ink hover:bg-panel disabled:opacity-50"
    >
      {/* `.mech` (globals.css) impose son propre `font-size: 0.9em`, hors de
          tout `@layer` Tailwind — il l'emporte toujours sur une classe
          `text-[Npx]` combinee sur le meme element, peu importe l'ordre
          ecrit ici (regle CSS Cascade Layers : le non-layer bat tout layer).
          Seul un style en ligne (priorite maximale, avant `!important`) peut
          fixer une taille exacte a cote de `mech` — d'ou son usage ici,
          jamais une classe Tailwind seule. */}
      <span className="text-[10px] font-medium">{label}</span>
      <span className="mech" style={{ fontSize: "0.875rem" }}>
        {resolvedFormula}
      </span>
      <span className="mech text-ink-muted" style={{ fontSize: "0.625rem" }}>
        {detailFormula}
      </span>
    </button>
  );
}

/** Ajoute un modificateur signe a une notation de de (`"1d20"` + 2 -> `"1d20+2"`), omis si nul. */
function withModifier(base: string, mod: number): string {
  if (mod === 0) return base;
  return `${base}${mod > 0 ? "+" : ""}${mod}`;
}

/**
 * Retire le prefixe redondant d'un `ai_digest` (toujours `"<nom> (<type>) —
 * <texte>"`, cf. `scripts/ingest-srd.ts`) — sans ca, une propriete d'arme
 * affichee a cote de son propre badge FR redirait deux fois son nom (« Light
 * — Light (feature) — A light weapon... »). Repli sur le texte complet si le
 * motif attendu n'est pas trouve, jamais une chaine vide.
 */
function stripDigestPrefix(digest: string): string {
  const match = digest.match(/^.*? \([a-z]+\) — ([\s\S]*)$/);
  return match ? match[1] : digest;
}

/**
 * Encadre d'objet d'inventaire (V1-C11/V1-C12/V1-C18, sur retours
 * utilisateur successifs) : meme langage visuel que les encadres de l'onglet
 * Traits (V1-C9). Reutilise par l'onglet Actions de la fiche jouable
 * (`onToggleEquipped`/`onChangeQty`/`onRemove` omis dans ce contexte : gerer
 * l'inventaire n'est pas le role de cet onglet, seulement l'utiliser) et par
 * `InventoryPanel` (bloc d'inventaire autonome, V1-C18) — un seul composant,
 * jamais une copie qui pourrait diverger.
 *
 * Bascule Equiper en bandeau vertical (V1-C12) : `writing-mode` + rotation
 * plutot qu'un bouton en ligne — occupe toute la hauteur de l'encadre a
 * gauche, `items-stretch` (comportement flex par defaut) fait le reste.
 */
export function ItemCard({
  worldSlug,
  item,
  chip,
  weapon,
  armor,
  weightLb,
  cost,
  strMod,
  dexMod,
  proficiencyBonus,
  isMonk,
  /** Lignes Attaquer/Degats (V1-C18) : ne se calculent que si l'entite a une vraie fiche de personnage a cote (FOR/DEX/maitrise reels) — un bloc d'inventaire seul sur une entite sans personnage (boutique, coffre) n'a rien de reel a partir de quoi les deviner ; `strMod`/`dexMod`/`proficiencyBonus` valent alors 0 par convention et ne doivent jamais s'afficher comme si c'etait un vrai calcul. */
  showAttackInfo,
  collapsible,
  busy,
  onAttack,
  onDamage,
  onToggleEquipped,
  onChangeQty,
  onRemove,
}: {
  worldSlug: string;
  item: InventoryItem;
  chip: ResolvedChipView | undefined;
  weapon: WeaponData | null;
  armor: ArmorData | null;
  weightLb: number | null;
  cost: ItemCost | null;
  strMod: number;
  dexMod: number;
  proficiencyBonus: number;
  /** Masque la propriete "monk" (V1-C12 suite, sur retour utilisateur) : pertinente seulement pour un personnage qui a des niveaux de Moine, contrairement aux autres proprietes d'arme qui restent des faits sur l'objet lui-meme. */
  isMonk: boolean;
  showAttackInfo: boolean;
  /** Repliable (V1-C13, onglet Inventaire seulement) : l'onglet Actions garde ses boutons toujours visibles, c'est son seul role. Replie par defaut — les descriptions/boutons restent a un clic, pas caches definitivement. */
  collapsible: boolean;
  busy: boolean;
  onAttack?: () => void;
  onDamage?: (versatile: boolean) => void;
  onToggleEquipped?: () => void;
  onChangeQty?: (qty: number) => void;
  onRemove?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(collapsible);
  const title = chip?.found ? chip.name : itemLabel(item);

  /**
   * Cle de reference + libelle FR de chaque propriete d'arme (V1-C12) — la
   * cle sert a resoudre sa fiche de regle (`Weapon-Properties`, importee
   * depuis ce ticket, `entry_type: "feature"` comme `Traits`/`Feats`) pour
   * en tirer la vraie description SRD (`chip.summary`, non traduite comme
   * le reste des descriptions d'aptitude, cf. V1-C9). Prefixe
   * `weapon-property-` (pas l'index brut, ex. "light") : ces index sont des
   * mots ordinaires qui percutent un sort/une classe/un objet du meme nom
   * (verifie a l'import : "light", "monk", "ammunition", "versatile" y sont
   * deja pris) — sans prefixe, la fiche resolue serait celle du sort
   * "Light", pas de la propriete. Armure : un seul badge de categorie, sans
   * fiche de regle correspondante (aucune categorie `Armor-Categories` dans
   * le SRD) — pas de description a reporter.
   */
  function weaponPropertyRefKey(property: string): string {
    return `weapon-property-${property}`;
  }
  const propertyRefs = weapon
    ? weapon.properties.filter((p) => p !== "monk" || isMonk).map((p) => ({ key: p, label: WEAPON_PROPERTY_LABELS_FR[p] ?? p }))
    : [];
  const armorLabel = armor ? (ARMOR_CATEGORY_LABELS_FR[armor.category] ?? armor.category) : null;
  // Tableau recree a chaque rendu, sans useMemo : `useReferenceChips` deduplique
  // deja en interne sur la cle jointe des refs (`dedupeKey`), pas sur
  // l'identite du tableau — un useMemo ici n'aurait rien evite de reel.
  const propertyChips = useReferenceChips(
    worldSlug,
    propertyRefs.map((p) => ({ kind: "rule" as const, key: weaponPropertyRefKey(p.key) }))
  );

  // Meme regle que le serveur (`weaponAttackAbilityMod`, resolveAction.ts) —
  // le libelle affiche ici doit refleter la meme caracteristique que celle
  // reellement utilisee au clic, jamais une supposition separee.
  const abilityMod = weapon ? weaponAttackAbilityMod(weapon.properties, weapon.isRanged, strMod, dexMod) : 0;
  const abilityLabel = weapon ? (weapon.isRanged || (weapon.properties.includes("finesse") && dexMod > strMod) ? "DEX" : "FOR") : "";
  const attackResolved = withModifier(withModifier("1d20", abilityMod), proficiencyBonus);
  const attackDetail = `1d20+${abilityLabel}+maîtrise`;
  const damageResolved = (dice: string) => withModifier(dice, abilityMod);
  const damageDetail = (dice: string) => (abilityMod !== 0 ? `${dice}+${abilityLabel}` : dice);

  // Independant des handlers (V1-C14) : le texte informatif de l'onglet
  // Inventaire s'affiche meme sur une arme non equipee (onAttack/onDamage
  // alors absents), donc la fleche de pliage doit refleter cette meme
  // condition — sinon une arme non equipee n'aurait jamais de fleche alors
  // que le texte, une fois deplie, y apparaitrait bien.
  const hasCollapsibleContent = propertyRefs.length > 0 || weapon !== null;
  const showDetails = !collapsible || !collapsed;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-edge/60 bg-panel-raised">
      {/* Bascule pliage/depliage en bandeau horizontal (V1-C15, sur retour
       * utilisateur) : pleine largeur en tete de l'encadre, symetrique du
       * bandeau vertical "Equiper" plus bas (meme principe de bande
       * cliquable, sur l'autre axe). Remplace la pastille centrale
       * qui mordait sur la largeur disponible au titre et empechait
       * l'alignement du poids/de la valeur/de la quantite entre objets. */}
      {collapsible && hasCollapsibleContent && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Déplier" : "Replier"}
          aria-label={collapsed ? "Déplier" : "Replier"}
          className="flex w-full items-center justify-center border-b border-edge/60 bg-panel py-px text-xs leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent"
        >
          {collapsed ? "▾" : "▴"}
        </button>
      )}
      <div className="flex">
        {onToggleEquipped && (
          <button
            type="button"
            onClick={onToggleEquipped}
            title={item.equipped ? "Cliquer pour déséquiper" : "Cliquer pour équiper"}
            className={`w-7 shrink-0 border-r text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              item.equipped ? "border-accent/50 bg-accent/20 text-accent" : "border-edge/60 bg-panel text-ink-muted hover:bg-panel-raised"
            }`}
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {item.equipped ? "Équipé" : "Équiper"}
          </button>
        )}
        <div
          className={`flex min-w-0 flex-1 flex-col gap-1.5 px-2.5 pb-2.5 ${
            collapsible && hasCollapsibleContent ? "pt-1.5" : "pt-2.5"
          }`}
        >
          {/*
           * Deux mises en page distinctes (V1-C14, sur retour utilisateur) —
           * plus une simple option d'affichage, une vraie difference de role :
           * l'onglet Inventaire gere l'objet (pas de des a jeter d'ici, juste
           * du texte informatif) ; l'onglet Actions ne fait que l'utiliser
           * (boutons, pas de prose). `collapsible` distingue deja les deux
           * contextes a chaque site d'appel, reutilise ici tel quel plutot que
           * d'ajouter une prop redondante.
           *
           * Cote Actions : titre/tags a gauche, boutons a droite, top aligne
           * ("gagner de la place", demande explicite) — `items-start` sur le
           * conteneur horizontal suffit, les deux colonnes partent du meme
           * bord superieur sans calcul de hauteur a la main. `contents` sur le
           * wrapper interne cote Inventaire : evite une boite superflue pour
           * que titre/tags gardent leur empilement vertical d'origine, pleine
           * largeur, inchange.
           */}
          <div className={collapsible ? "flex flex-col gap-1.5" : "flex items-start justify-between gap-3"}>
            <div className={collapsible ? "contents" : "flex min-w-0 flex-col gap-1.5"}>
              {/* Poids/valeur/quantite a largeur fixe et texte aligne a
                  droite (V1-C15, sur retour utilisateur) : la meme largeur
                  pour chaque colonne d'un objet a l'autre les aligne entre
                  encadres quel que soit le contenu ; seul le titre s'etire
                  et se tronque (`min-w-0 flex-1 truncate`) pour laisser la
                  place aux noms longs. */}
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {chip?.found ? (
                    <Link href={chip.href} className="block truncate text-sm font-semibold no-underline hover:underline" style={{ color: "var(--link-rule)" }}>
                      {title}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-semibold text-ink">{title || "Sans nom"}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {weightLb !== null && (
                    <span className="mech w-12 text-right text-ink-muted" style={{ fontSize: "0.625rem" }}>
                      {lbToKg(weightLb)} kg
                    </span>
                  )}
                  {cost && (
                    <span className="mech w-14 text-right text-ink-muted" style={{ fontSize: "0.625rem" }}>
                      {cost.quantity} {CURRENCY_LABELS_FR[cost.unit] ?? cost.unit}
                    </span>
                  )}
                  {onChangeQty ? (
                    <input
                      type="number"
                      min={0}
                      value={item.qty}
                      onChange={(e) => onChangeQty(Number(e.target.value) || 0)}
                      className="w-12 rounded-md border border-edge bg-transparent px-1 py-0.5 text-right text-xs text-ink outline-none"
                      aria-label="Quantité"
                    />
                  ) : (
                    <span className="w-10 text-right text-[10px] text-ink-muted">× {item.qty}</span>
                  )}
                </div>
                {onRemove && (
                  <button
                    type="button"
                    onClick={onRemove}
                    title="Supprimer l'objet"
                    aria-label="Supprimer l'objet"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base text-danger transition-colors hover:bg-danger/10"
                  >
                    ×
                  </button>
                )}
              </div>

              {propertyRefs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {propertyRefs.map((p) => (
                    <span key={p.key} className="rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">
                      {p.label}
                    </span>
                  ))}
                </div>
              )}
              {armorLabel && (
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full border border-edge px-1.5 py-0 text-[10px] text-ink-muted">{armorLabel}</span>
                </div>
              )}
            </div>

            {/* Onglet Actions : boutons, jamais de texte — c'est le seul endroit ou on jette reellement les des. */}
            {!collapsible && weapon && (onAttack || onDamage) && (
              <div className="flex flex-wrap gap-2">
                {onAttack && (
                  <ActionButton label="Attaquer" resolvedFormula={attackResolved} detailFormula={attackDetail} busy={busy} onClick={onAttack} />
                )}
                {onAttack && weapon.properties.includes("thrown") && (
                  <ActionButton label="Lancer" resolvedFormula={attackResolved} detailFormula={attackDetail} busy={busy} onClick={onAttack} />
                )}
                {onDamage && (
                  <ActionButton
                    label="Dégâts"
                    resolvedFormula={damageResolved(weapon.damageDice)}
                    detailFormula={damageDetail(weapon.damageDice)}
                    busy={busy}
                    onClick={() => onDamage(false)}
                  />
                )}
                {onDamage && weapon.versatileDamageDice && (
                  <ActionButton
                    label="Dégâts (2 mains)"
                    resolvedFormula={damageResolved(weapon.versatileDamageDice)}
                    detailFormula={damageDetail(weapon.versatileDamageDice)}
                    busy={busy}
                    onClick={() => onDamage(true)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Onglet Inventaire seulement : descriptions de propriete (retirees
              de l'onglet Actions, "gagner de la place" — elles restent
              consultables depuis la fiche de regle liee au titre). Toujours
              affichees, meme sans personnage : ce sont des faits sur l'objet
              lui-meme (SRD), pas un calcul derive d'une fiche. */}
          {collapsible && showDetails && propertyRefs.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {propertyRefs.map((p) => {
                const propChip = propertyChips.get(refIdentity({ kind: "rule", key: weaponPropertyRefKey(p.key) }));
                const description = propChip?.found && propChip.summary ? stripDigestPrefix(propChip.summary) : null;
                return description ? (
                  <p key={p.key} className="text-xs leading-relaxed text-ink-muted">
                    <span className="font-semibold text-ink">{p.label}</span> — {description}
                  </p>
                ) : null;
              })}
            </div>
          )}

          {/* Onglet Inventaire seulement : texte informatif, jamais de bouton
              — on ne jette pas les des depuis la gestion de l'inventaire, cf.
              l'onglet Actions plus haut. Independant de l'equipement (contrairement
              aux boutons) : une info sur une arme reste utile meme non equipee.
              Meme format que les descriptions de propriete ci-dessus (V1-C15,
              sur retour utilisateur) : libelle en gras, tiret, valeur — cette
              ligne EST une caracteristique de l'objet, au meme titre que les
              autres. Gate par `showAttackInfo` (V1-C18) : sans personnage sur
              l'entite, il n'y a pas de FOR/DEX/maitrise reels a afficher. */}
          {collapsible && showDetails && weapon && showAttackInfo && (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs leading-relaxed text-ink-muted">
                <span className="font-semibold text-ink">Attaquer</span> — <span className="mech">{attackDetail}</span>
              </p>
              {weapon.properties.includes("thrown") && (
                <p className="text-xs leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink">Lancer</span> — <span className="mech">{attackDetail}</span>
                </p>
              )}
              <p className="text-xs leading-relaxed text-ink-muted">
                <span className="font-semibold text-ink">Dégâts</span> — <span className="mech">{damageDetail(weapon.damageDice)}</span>
              </p>
              {weapon.versatileDamageDice && (
                <p className="text-xs leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink">Dégâts (2 mains)</span> — <span className="mech">{damageDetail(weapon.versatileDamageDice)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Ajout d'objet par recherche de regle (V1-C11, remplace le couple menu
 * "Objet en ligne/Reference de regle" + champ separe) : un seul champ, une
 * quantite, un bouton. Une suggestion choisie cree une reference ; un texte
 * libre sans suggestion choisie cree un objet en ligne (homebrew) — les deux
 * flux restent possibles, `ItemAutocomplete` gere deja ce repli cote UI.
 */
export function AddItemRow({ worldSlug, onAdd }: { worldSlug: string; onAdd: (item: InventoryItem) => void }) {
  const [resetKey, setResetKey] = useState(0);
  const [ref, setRef] = useState<BlockReference | null>(null);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState(1);

  function submit() {
    const trimmed = query.trim();
    if (!ref && trimmed === "") return;
    const item: InventoryItem = ref ? { id: crypto.randomUUID(), qty, ref } : { id: crypto.randomUUID(), qty, label: trimmed };
    onAdd(item);
    setRef(null);
    setQuery("");
    setQty(1);
    setResetKey((k) => k + 1);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <ItemAutocomplete key={resetKey} worldSlug={worldSlug} value={ref} onChange={setRef} onQueryChange={setQuery} />
      </div>
      <input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        className="w-16 rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
        aria-label="Quantité"
      />
      <button
        type="button"
        onClick={submit}
        className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        + Ajouter
      </button>
    </div>
  );
}

/**
 * Corps de l'onglet Inventaire de la fiche jouable, extrait tel quel (V1-C18,
 * demande explicite : « un copier-coller de cet onglet ») pour etre partage
 * avec le bloc d'inventaire autonome (`InventoryBlockEditor`) — un seul
 * composant, deux points d'entree, jamais deux implementations qui pourraient
 * diverger. Les deux vues editent le meme bloc `inventory` (meme `id`, meme
 * etat React `EntityBlocks.blocks`) : ajouter un objet dans l'une le fait
 * apparaitre dans l'autre sans mecanisme de synchronisation dedie.
 *
 * Le contexte de personnage (`strMod`/`dexMod`/`proficiencyBonus`/`isMonk`/
 * `showAttackInfo`/`encumbrance`) est optionnel cote appelant : un bloc
 * d'inventaire sur une entite sans fiche de personnage (boutique, coffre)
 * n'a ni FOR/DEX/maitrise ni capacite de charge reels — `showAttackInfo:
 * false` et `encumbrance: undefined` degradent proprement l'affichage
 * (poids/valeur/tags/pliage restent identiques, seuls les jets et la barre
 * de charge disparaissent) plutot que d'afficher un faux "+0".
 */
export default function InventoryPanel({
  worldSlug,
  inventory,
  onUpdateInventory,
  strMod,
  dexMod,
  proficiencyBonus,
  isMonk,
  showAttackInfo,
  weaponByKey,
  equipment,
  weight,
  cost,
  encumbrance,
}: {
  worldSlug: string;
  inventory: InventoryBlockData | undefined;
  onUpdateInventory: (data: InventoryBlockData) => void;
  strMod: number;
  dexMod: number;
  proficiencyBonus: number;
  isMonk: boolean;
  showAttackInfo: boolean;
  weaponByKey: Record<string, WeaponData | null>;
  equipment: Record<string, ArmorData | null>;
  weight: Record<string, number | null>;
  cost: Record<string, ItemCost | null>;
  encumbrance?: { carried: number; capacity: number; tier: "none" | "encumbered" | "heavily_encumbered" };
}) {
  const [coinDelta, setCoinDelta] = useState("");
  const [coinType, setCoinType] = useState<CoinType>("gp");
  const [coinError, setCoinError] = useState(false);

  const inventoryRefs = (inventory?.items ?? []).map(itemRef).filter((r): r is BlockReference => r !== null);
  const itemChips = useReferenceChips(worldSlug, inventoryRefs);

  function inventoryBase(): InventoryBlockData {
    return inventory ?? { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } };
  }

  function updateInventoryItem(index: number, patch: Partial<InventoryItem>) {
    const base = inventoryBase();
    onUpdateInventory({ ...base, items: base.items.map((it, i) => (i === index ? ({ ...it, ...patch } as InventoryItem) : it)) });
  }

  function removeInventoryItem(index: number) {
    const base = inventoryBase();
    onUpdateInventory({ ...base, items: base.items.filter((_, i) => i !== index) });
  }

  function addInventoryItem(item: InventoryItem) {
    const base = inventoryBase();
    onUpdateInventory({ ...base, items: [...base.items, item] });
  }

  /**
   * Champ + boutons + type de piece (V1-C16, sur retour utilisateur) : meme
   * motif que `applyHpDelta`/`applyXpDelta` de la fiche jouable (montant
   * tape une fois, +/- l'appliquent puis vident le champ), avec un menu pour
   * cibler la denomination. Le depot ajoute simplement au type choisi ; la
   * depense passe par `spendCoins` (src/core/rules/currency.ts), qui casse
   * automatiquement des pieces plus grosses si le type choisi n'en a pas
   * assez, et recompose tout le porte-monnaie avec le moins de pieces
   * possible. `null` signale une valeur totale insuffisante : rien n'est
   * modifie, seul `coinError` s'allume pour le signaler.
   */
  function applyCoinDelta(sign: 1 | -1) {
    const amount = coinDelta.trim() === "" ? 1 : Math.abs(Math.trunc(Number(coinDelta)));
    if (!amount) return;
    const base = inventoryBase();
    if (sign === 1) {
      onUpdateInventory({ ...base, currency: depositCoins(base.currency, coinType, amount) });
    } else {
      const next = spendCoins(base.currency, coinType, amount);
      if (!next) {
        setCoinError(true);
        return;
      }
      onUpdateInventory({ ...base, currency: next });
    }
    setCoinError(false);
    setCoinDelta("");
  }

  return (
    <div className="flex flex-col gap-3">
      {encumbrance && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink-muted">
            <span>Charge</span>
            <span className={encumbrance.tier !== "none" ? "text-danger" : "text-ink-muted"}>
              {lbToKg(encumbrance.carried)}/{lbToKg(encumbrance.capacity)} kg
              {encumbrance.tier === "encumbered" && ` · Encombré (vitesse −${ftToM(10)} m)`}
              {encumbrance.tier === "heavily_encumbered" && ` · Lourdement encombré (vitesse −${ftToM(20)} m, désavantage FOR/DEX/CON)`}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-panel-sunken">
            <div
              className={`h-full rounded-full transition-[width] ${encumbrance.tier !== "none" ? "bg-danger" : "bg-accent"}`}
              style={{
                width: `${Math.min(100, encumbrance.capacity > 0 ? (encumbrance.carried / encumbrance.capacity) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Depot/depense a montant tape + type de piece choisi (V1-C16, sur
          retour utilisateur), sur la meme ligne que les cinq champs de
          pieces — colonne etroite (le panneau partage sa largeur avec les
          caracteristiques dans la fiche jouable) : champs et boutons
          resserres, pas de `flex-wrap` — a cette largeur, un retour a la
          ligne casserait la demande explicite ("sur la meme ligne"), alors
          qu'un shrink discret des elements suffit a tout faire tenir. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <div className="grid grid-cols-5 gap-1">
            {(["pp", "gp", "ep", "sp", "cp"] as const).map((coin) => (
              <label key={coin} className="flex flex-col gap-1 text-xs text-ink-muted">
                {CURRENCY_LABELS_FR[coin]}
                <input
                  type="number"
                  min={0}
                  value={inventory?.currency[coin] ?? 0}
                  onChange={(e) => {
                    const base = inventoryBase();
                    onUpdateInventory({ ...base, currency: { ...base.currency, [coin]: Number(e.target.value) || 0 } });
                  }}
                  className="w-full rounded-md border border-edge bg-transparent px-1 py-1 text-center text-xs text-ink outline-none"
                />
              </label>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <select
              value={coinType}
              onChange={(e) => {
                setCoinType(e.target.value as CoinType);
                setCoinError(false);
              }}
              title="Type de pièce"
              className="rounded-md border border-edge bg-transparent py-1 pl-1 pr-0 text-xs text-ink outline-none"
            >
              {CURRENCY_ORDER.map((coin) => (
                <option key={coin} value={coin}>
                  {CURRENCY_LABELS_FR[coin]}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={coinDelta}
              onChange={(e) => {
                setCoinDelta(e.target.value);
                setCoinError(false);
              }}
              placeholder="1"
              aria-label="Montant"
              className="w-10 rounded-md border border-edge bg-transparent px-1 py-1 text-center text-xs text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => applyCoinDelta(-1)}
              title="Retirer"
              className="rounded border border-edge px-1.5 py-0.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => applyCoinDelta(1)}
              title="Ajouter"
              className="rounded border border-edge px-1.5 py-0.5 text-xs hover:bg-panel disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
        {coinError && <span className="text-xs text-danger">Fonds insuffisants, même en cassant des pièces plus grosses.</span>}
      </div>

      <AddItemRow worldSlug={worldSlug} onAdd={addInventoryItem} />

      <div className="flex flex-col gap-2">
        {(inventory?.items ?? []).map((item, index) => {
          const ref = itemRef(item);
          const weapon = ref?.kind === "rule" ? weaponByKey[ref.key] : null;
          const armor = ref?.kind === "rule" ? equipment[ref.key] : null;
          return (
            <ItemCard
              key={item.id}
              worldSlug={worldSlug}
              item={item}
              chip={ref ? itemChips.get(refIdentity(ref)) : undefined}
              weapon={weapon}
              armor={armor}
              weightLb={ref?.kind === "rule" ? (weight[ref.key] ?? null) : null}
              cost={ref?.kind === "rule" ? (cost[ref.key] ?? null) : null}
              strMod={strMod}
              dexMod={dexMod}
              proficiencyBonus={proficiencyBonus}
              isMonk={isMonk}
              showAttackInfo={showAttackInfo}
              collapsible={true}
              busy={false}
              onToggleEquipped={() => updateInventoryItem(index, { equipped: !item.equipped })}
              onChangeQty={(qty) => updateInventoryItem(index, { qty })}
              onRemove={() => removeInventoryItem(index)}
            />
          );
        })}
        {(inventory?.items.length ?? 0) === 0 && <p className="text-sm text-ink-muted">Aucun objet pour l&apos;instant.</p>}
      </div>
    </div>
  );
}
