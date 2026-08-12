// V1-D3b (point 8, complement) : les 18 formes de loup-garou/ours-garou/
// rat-garou/sanglier-garou/tigre-garou/vampire partagent TOUTES un seul et
// meme bloc de caracteristiques francais (une forme = un qualificatif
// parenthetique sur certains traits/actions, ex. "Griffes (forme hybride
// uniquement)"), jamais un en-tete separe par forme. L'extracteur generique
// (extract-monster-blocks-fr.ts) suppose un en-tete -> un monstre : ici,
// TROIS entry_key partagent le meme en-tete et ne demandent CHACUN qu'un
// sous-ensemble different des memes traits/actions (verifie contre le
// nombre attendu par forme dans ruleset_entry_blocks, deja importe en
// anglais). Verifie a la main dans data/srd/fr-source/srd-5.1-fr.txt
// (lignes 32997-33247, 35318-35462) plutot que devine : chaque description
// ci-dessous est une transcription mot pour mot du texte officiel, chaque
// sous-ensemble par forme confirme par le qualificatif parenthetique du
// texte francais lui-meme (ex. "forme de loup ou hybride uniquement").
//
// Lancement : npx tsx --env-file=.env.local scripts/write-lycanthrope-vampire-blocks.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies.");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WRITE = process.argv.includes("--write");

interface Trait {
  name: string;
  description: string;
}

interface ActionSource {
  name: string;
  description: string;
}

// --- Loup-garou (Werewolf) : lignes 32997-33045 ---
const loupGarouTraits: Trait[] = [
  {
    name: "Métamorphe",
    description:
      "Le loup-garou peut consacrer son action à se transformer en hybride de loup et d’humanoïde ou en loup, ou à reprendre sa forme véritable d’humanoïde. En dehors de sa CA, son profil reste le même quelle que soit la forme. Rien de ce qu’il porte n’est transformé. S’il meurt, il reprend sa forme véritable.",
  },
  {
    name: "Odorat et ouïe aiguisés",
    description: "Le loup-garou est avantagé aux tests de Sagesse (Perception) qui font intervenir l’ouïe ou l’odorat.",
  },
];
const loupGarouActions: Record<string, ActionSource> = {
  Multiattack: {
    name: "Attaques multiples (forme humanoïde ou hybride uniquement)",
    description: "Le loup-garou effectue deux attaques : une de Morsure et une de Griffes ou de Lance.",
  },
  Claws: {
    name: "Griffes (forme hybride uniquement)",
    description: "Attaque d’arme au corps à corps : +4 pour toucher, allonge 1,50 m, une créature. Touché : 7 (2d4 + 2) dégâts tranchants.",
  },
  Spear: {
    name: "Lance (forme humanoïde uniquement)",
    description:
      "Attaque d’arme au corps à corps ou à distance : +4 pour toucher, allonge 1,50 m ou portée 6/18 m, une créature. Touché : 5 (1d6 + 2) dégâts perforants, ou 6 (1d8 + 2) dégâts perforants si utilisée à deux mains dans le cadre d’une attaque de corps à corps.",
  },
  Bite: {
    name: "Morsure (forme de loup ou hybride uniquement)",
    description:
      "Attaque d’arme au corps à corps : +4 pour toucher, allonge 1,50 m, une cible. Touché : 6 (1d8 + 2) dégâts perforants. Si la cible est humanoïde, elle doit réussir un jet de sauvegarde de Constitution DD 12 sous peine de subir la malédiction de la lycanthropie (loup-garou).",
  },
};

// --- Ours-garou (Werebear) : lignes 33046-33090 ---
const oursGarouTraits: Trait[] = [
  {
    name: "Métamorphe",
    description:
      "L’ours-garou peut consacrer son action à se transformer en hybride d’ours et d’humanoïde ou en ours de taille G, ou à reprendre sa forme véritable d’humanoïde. Hormis sa catégorie de taille et sa CA, son profil reste le même, quelle que soit sa forme. Rien de ce qu’il porte n’est transformé. S’il meurt, il reprend sa forme véritable.",
  },
  {
    name: "Odorat aiguisé",
    description: "L’ours-garou est avantagé aux tests de Sagesse (Perception) qui font intervenir l’odorat.",
  },
];
const oursGarouActions: Record<string, ActionSource> = {
  Multiattack: {
    name: "Attaques multiples",
    description:
      "Sous forme d’ours, l’ours-garou effectue deux attaques de Griffe. Sous forme humanoïde, il effectue deux attaques de Hache à deux mains. Sous forme hybride, il peut attaquer comme un ours ou un humanoïde.",
  },
  Claw: {
    name: "Griffe (forme d’ours ou hybride uniquement)",
    description: "Attaque d’arme au corps à corps : +7 pour toucher, allonge 1,50 m, une cible. Touché : 13 (2d8 + 4) dégâts tranchants.",
  },
  Greataxe: {
    name: "Hache à deux mains (forme humanoïde ou hybride uniquement)",
    description: "Attaque d’arme au corps à corps : +7 pour toucher, allonge 1,50 m, une cible. Touché : 10 (1d12 + 4) dégâts tranchants.",
  },
  Bite: {
    name: "Morsure (forme d’ours ou hybride uniquement)",
    description:
      "Attaque d’arme au corps à corps : +7 pour toucher, allonge 1,50 m, une cible. Touché : 15 (2d10 + 4) dégâts perforants. Si la cible est humanoïde, elle doit réussir un jet de sauvegarde de Constitution DD 14 sous peine de subir la malédiction de la lycanthropie (ours-garou).",
  },
};

// --- Rat-garou (Wererat) : lignes 33091-33138 ---
const ratGarouTraits: Trait[] = [
  {
    name: "Métamorphe",
    description:
      "Le rat-garou peut consacrer son action à se transformer en hybride de rat et d’humanoïde ou en rat géant, ou à reprendre sa forme véritable d’humanoïde. En dehors de sa taille, son profil reste le même, quelle que soit la forme. Rien de ce qu’il porte n’est transformé. S’il meurt, il reprend sa forme véritable.",
  },
  {
    name: "Odorat aiguisé",
    description: "Le rat-garou est avantagé aux tests de Sagesse (Perception) qui font intervenir l’odorat.",
  },
];
const ratGarouActions: Record<string, ActionSource> = {
  Multiattack: {
    name: "Attaques multiples (forme humanoïde ou hybride uniquement)",
    description: "Le rat-garou effectue deux attaques, mais pas plus d’une Morsure.",
  },
  Shortsword: {
    name: "Épée courte (forme humanoïde ou hybride uniquement)",
    description: "Attaque d’arme au corps à corps : +4 pour toucher, allonge 1,50 m, une cible. Touché : 5 (1d6 + 2) dégâts perforants.",
  },
  Bite: {
    name: "Morsure (formes de rat et hybride uniquement)",
    description:
      "Attaque d’arme au corps à corps : +4 pour toucher, allonge 1,50 m, une cible. Touché : 4 (1d4 + 2) dégâts perforants. Si la cible est humanoïde, elle doit réussir un jet de sauvegarde de Constitution DD 11 sous peine de subir la malédiction de la lycanthropie (rat-garou).",
  },
  "Hand Crossbow": {
    name: "Arbalète de poing (forme humanoïde ou hybride uniquement)",
    description: "Attaque d’arme à distance : +4 pour toucher, portée 9/36 m, une cible. Touché : 5 (1d6 + 2) dégâts perforants.",
  },
};

// --- Sanglier-garou (Wereboar) : lignes 33139-33186 ---
const sanglierGarouTraits: Record<string, Trait> = {
  Shapechanger: {
    name: "Métamorphe",
    description:
      "Le sanglier-garou peut consacrer son action à se transformer en hybride de sanglier et d’humanoïde ou en sanglier, ou à reprendre sa forme véritable d’humanoïde. En dehors de sa CA, son profil reste le même quelle que soit la forme. Rien de ce qu’il porte n’est transformé. S’il meurt, il reprend sa forme véritable.",
  },
  "Charge (Boar or Hybrid Form Only)": {
    name: "Charge (forme de sanglier ou hybride uniquement)",
    description:
      "Si le sanglier-garou se déplace d’au moins 4,50 m en ligne droite vers une cible qu’il touche ensuite avec ses Défenses au même tour, il lui inflige 7 (2d6) dégâts tranchants supplémentaires. Si la cible est une créature, elle doit réussir un jet de sauvegarde de Force DD 13 sous peine d’être jetée à terre.",
  },
  Relentless: {
    name: "Implacable (recharge après un repos court ou long)",
    description: "Si le sanglier-garou subit 14 dégâts ou moins censés le faire tomber à 0 point de vie, il se retrouve en fait à 1 point de vie.",
  },
};
const sanglierGarouActions: Record<string, ActionSource> = {
  Multiattack: {
    name: "Attaques multiples (forme humanoïde ou hybride uniquement)",
    description: "Le sanglier-garou effectue deux attaques, mais pas plus d’une avec ses Défenses.",
  },
  Tusks: {
    name: "Défenses (forme de sanglier ou hybride uniquement)",
    description:
      "Attaque d’arme au corps à corps : +5 pour toucher, allonge 1,50 m, une cible. Touché : 10 (2d6 + 3) dégâts tranchants. Si la cible est humanoïde, elle doit réussir un jet de sauvegarde de Constitution DD 12 sous peine de subir la malédiction de la lycanthropie (sanglier).",
  },
  Maul: {
    name: "Maillet d’armes (forme humanoïde ou hybride uniquement)",
    description: "Attaque d’arme au corps à corps : +5 pour toucher, allonge 1,50 m, une cible. Touché : 10 (2d6 + 3) dégâts contondants.",
  },
};

// --- Tigre-garou (Weretiger) : lignes 33187-33247 ---
const tigreGarouTraits: Record<string, Trait> = {
  Shapechanger: {
    name: "Métamorphe",
    description:
      "Le tigre-garou peut consacrer son action à se transformer en hybride de tigre et d’humanoïde ou en tigre, ou à reprendre sa forme véritable d’humanoïde. En dehors de sa taille, son profil reste le même, quelle que soit la forme. Rien de ce qu’il porte n’est transformé. S’il meurt, il reprend sa forme véritable.",
  },
  "Keen Hearing and Smell": {
    name: "Odorat et ouïe aiguisés",
    description: "Le tigre-garou est avantagé aux tests de Sagesse (Perception) qui font intervenir l’ouïe ou l’odorat.",
  },
  Pounce: {
    name: "Bond agressif (forme de tigre ou hybride uniquement)",
    description:
      "Si le tigre-garou se déplace d’au moins 4,50 m en ligne droite vers une cible qu’il touche ensuite avec une attaque de Griffe au même tour, la cible doit réussir un jet de sauvegarde de Force DD 14 sous peine d’être jetée à terre. Si la cible est à terre, le tigre-garou peut effectuer contre elle une attaque de Morsure par une action bonus.",
  },
};
const tigreGarouActions: Record<string, ActionSource> = {
  Multiattack: {
    name: "Attaques multiples (forme humanoïde ou hybride uniquement)",
    description:
      "Sous forme humanoïde, le tigre-garou effectue deux attaques de Cimeterre ou deux attaques d’Arc long. Sous forme hybride, il peut attaquer comme un humanoïde ou effectuer deux attaques de Griffe.",
  },
  Scimitar: {
    name: "Cimeterre (forme humanoïde ou hybride uniquement)",
    description: "Attaque d’arme au corps à corps : +5 pour toucher, allonge 1,50 m, une cible. Touché : 6 (1d6 + 3) dégâts tranchants.",
  },
  Claw: {
    name: "Griffe (forme de tigre ou hybride uniquement)",
    description: "Attaque d’arme au corps à corps : +5 pour toucher, allonge 1,50 m, une cible. Touché : 7 (1d8 + 3) dégâts tranchants.",
  },
  Bite: {
    name: "Morsure (forme de tigre ou hybride uniquement)",
    description:
      "Attaque d’arme au corps à corps : +5 pour toucher, allonge 1,50 m, une cible. Touché : 8 (1d10 + 3) dégâts perforants. Si la cible est humanoïde, elle doit réussir un jet de sauvegarde de Constitution DD 13 sous peine de subir la malédiction de la lycanthropie (tigre-garou).",
  },
  Longbow: {
    name: "Arc long (forme humanoïde ou hybride uniquement)",
    description: "Attaque d’arme à distance : +4 pour toucher, portée 45/180 m, une cible. Touché : 6 (1d8 + 2) dégâts perforants.",
  },
};

// --- Vampire : lignes 35318-35462 (traits identiques pour les 3 formes) ---
const vampireTraits: Trait[] = [
  {
    name: "Échappatoire brumeuse",
    description:
      "Quand il tombe à 0 point de vie hors de son refuge, le vampire se transforme en nuage de brume (comme celui de son trait Métamorphe) au lieu de tomber inconscient, à condition qu’il ne soit pas exposé aux rayons du soleil ou dans l’eau vive. S’il ne peut pas se transformer, il est détruit. Tant qu’il est à 0 point de vie sous forme de brume, il ne peut pas retrouver sa forme de vampire et doit atteindre son refuge dans les 2 heures sous peine d’être détruit. Une fois dans son refuge, il retrouve sa forme de vampire. Il est alors paralysé jusqu’à ce qu’il récupère au moins 1 point de vie. S’il passe 1 heure en son refuge alors qu’il est à 0 point de vie, il récupère 1 point de vie.",
  },
  {
    name: "Faiblesses des vampires",
    description:
      "Le vampire présente les points faibles suivants : Allergie à l’eau vive. Le vampire subit 20 dégâts d’acide s’il termine son tour dans l’eau vive. Défense d’entrer. Le vampire ne peut pas entrer dans une habitation sans y avoir été invité par l’un de ses occupants. Hypersensibilité au soleil. Le vampire subit 20 dégâts radiants lorsqu’il commence son tour exposé au soleil. Exposé à la lumière du soleil, il est désavantagé aux jets d’attaque ainsi qu’aux tests de caractéristique. Pieu dans le cœur. Si on plante une arme perforante en bois dans le cœur du vampire alors qu’il est neutralisé dans son refuge, il se retrouve paralysé tant que ce pieu n’a pas été retiré.",
  },
  {
    name: "Métamorphe",
    description:
      "Si le vampire n’est pas exposé aux rayons du soleil ni dans l’eau vive, il peut consacrer son action à se transformer en chauve-souris de taille TP ou en nuage de brume de taille M, ou à reprendre sa forme véritable. Tant qu’il est sous forme de chauve-souris, le vampire ne peut pas parler, sa vitesse au sol est de 1,50 m et il dispose d’une vitesse de vol de 9 m. Son profil, outre sa catégorie de taille et sa vitesse, ne change pas. Tous les vêtements qu’il porte et les accessoires qui le parent se transforment avec lui, mais pas ce qu’il transporte. S’il meurt, il reprend sa forme véritable. Tant qu’il est sous forme de brume, le vampire ne peut entreprendre aucune action, ni parler, ni manipuler d’objets. Il ne pèse rien, dispose d’une vitesse de vol de 6 m avec le vol stationnaire, peut pénétrer dans l’espace d’une créature hostile et même s’y arrêter. De plus, la brume peut se glisser dans tout espace suffisant pour laisser circuler l’air, sans devoir se faufiler, mais il ne peut pas traverser l’eau. Il est avantagé aux jets de sauvegarde de Force, Dextérité et Constitution, et immunisé contre tous les dégâts non magiques, en dehors de ceux que lui infligent les rayons du soleil.",
  },
  {
    name: "Pattes d’araignée",
    description: "Le vampire peut parcourir les parois les plus difficiles à escalader, y compris les plafonds, sans passer par un test de caractéristique.",
  },
  {
    name: "Régénération",
    description:
      "Le vampire récupère 20 points de vie au début de chacun de ses tours s’il lui reste au moins 1 point de vie et à condition de n’être ni exposé aux rayons du soleil ni dans l’eau vive. S’il subit des dégâts radiants ou des dégâts infligés par de l’eau bénite, ce trait ne fonctionne pas au début de son tour suivant.",
  },
  {
    name: "Résistance légendaire (3/jour)",
    description: "Si le vampire rate un jet de sauvegarde, il peut décider de le réussir tout de même.",
  },
];
const vampireActions: Record<string, ActionSource> = {
  Multiattack: {
    name: "Attaques multiples (forme de vampire uniquement)",
    description: "Le vampire effectue deux attaques, mais pas plus d’une Morsure.",
  },
  "Unarmed Strike": {
    name: "Attaque à mains nues (forme de vampire uniquement)",
    description:
      "Attaque d’arme au corps à corps : +9 pour toucher, allonge 1,50 m, une créature. Touché : 8 (1d8 + 4) dégâts contondants. Au lieu d’infliger des dégâts, le vampire peut agripper la cible (évasion DD 18).",
  },
  Bite: {
    name: "Morsure (forme de chauve-souris ou de vampire uniquement)",
    description:
      "Attaque d’arme au corps à corps : +9 pour toucher, allonge 1,50 m, une créature consentante ou une créature agrippée par le vampire, neutralisée ou entravée. Touché : 7 (1d6 + 4) dégâts perforants plus 10 (3d6) dégâts nécrotiques. Le maximum de points de vie de la cible est réduit d’un montant égal aux dégâts nécrotiques subis et le vampire récupère autant de points de vie que ce même montant. Cette réduction persiste jusqu’à ce que la cible termine un repos long. La cible meurt si cet effet réduit son maximum de points de vie à 0. Un humanoïde ainsi tué, puis enterré, se relève la nuit suivante comme vampirien sous le contrôle du vampire.",
  },
  Charm: {
    name: "Charme",
    description:
      "Le vampire cible un humanoïde qu’il voit dans un rayon de 9 m. Si la cible voit le vampire, elle doit réussir un jet de sauvegarde de Sagesse DD 17 contre cette magie sous peine d’être charmée par le vampire. Ainsi charmée, la cible considère le vampire comme un ami fidèle qu’elle doit écouter et protéger. Bien que la cible ne soit pas sous le contrôle du mort-vivant, elle accorde la plus grande considération à tout ce qu’il lui demande et tout ce qu’il fait, et constitue une cible consentante pour son attaque de Morsure. Chaque fois que le vampire ou l’un de ses compagnons nuit directement à la cible, celle-ci peut réitérer le jet de sauvegarde et met un terme à l’effet sur elle-même en cas de réussite. Sans cela, l’effet dure 24 heures sauf si le vampire est détruit, se trouve sur un plan d’existence différent de celui de la cible ou met un terme à l’effet par une action bonus.",
  },
  "Children of the Night": {
    name: "Rejetons des ténèbres (1/jour)",
    description:
      "Le vampire appelle magiquement 2d4 nuées de chauves-souris ou de rats, à condition que le soleil ne soit pas levé. S’il est en extérieur, le vampire peut préférer appeler 3d6 loups. Les créatures appelées arrivent en 1d4 rounds ; elles se comportent comme des alliés du vampire et obéissent à ses instructions verbales. Elles restent 1 heure mais disparaissent si le vampire meurt, ou si ce dernier les révoque par une action bonus.",
  },
};

interface EntrySpec {
  entryKey: string;
  traits: Trait[] | { byEnglishName: Record<string, Trait> };
  actionsByEnglishName: Record<string, ActionSource>;
}

const specs: EntrySpec[] = [
  { entryKey: "werewolf-human", traits: loupGarouTraits, actionsByEnglishName: loupGarouActions },
  { entryKey: "werewolf-wolf", traits: loupGarouTraits, actionsByEnglishName: loupGarouActions },
  { entryKey: "werewolf-hybrid", traits: loupGarouTraits, actionsByEnglishName: loupGarouActions },
  { entryKey: "werebear-bear", traits: oursGarouTraits, actionsByEnglishName: oursGarouActions },
  { entryKey: "werebear-human", traits: oursGarouTraits, actionsByEnglishName: oursGarouActions },
  { entryKey: "werebear-hybrid", traits: oursGarouTraits, actionsByEnglishName: oursGarouActions },
  { entryKey: "wererat-human", traits: ratGarouTraits, actionsByEnglishName: ratGarouActions },
  { entryKey: "wererat-rat", traits: ratGarouTraits, actionsByEnglishName: ratGarouActions },
  { entryKey: "wererat-hybrid", traits: ratGarouTraits, actionsByEnglishName: ratGarouActions },
  { entryKey: "wereboar-boar", traits: { byEnglishName: sanglierGarouTraits }, actionsByEnglishName: sanglierGarouActions },
  { entryKey: "wereboar-human", traits: { byEnglishName: sanglierGarouTraits }, actionsByEnglishName: sanglierGarouActions },
  { entryKey: "wereboar-hybrid", traits: { byEnglishName: sanglierGarouTraits }, actionsByEnglishName: sanglierGarouActions },
  { entryKey: "weretiger-human", traits: { byEnglishName: tigreGarouTraits }, actionsByEnglishName: tigreGarouActions },
  { entryKey: "weretiger-hybrid", traits: { byEnglishName: tigreGarouTraits }, actionsByEnglishName: tigreGarouActions },
  { entryKey: "weretiger-tiger", traits: { byEnglishName: tigreGarouTraits }, actionsByEnglishName: tigreGarouActions },
  { entryKey: "vampire-vampire", traits: vampireTraits, actionsByEnglishName: vampireActions },
  { entryKey: "vampire-bat", traits: vampireTraits, actionsByEnglishName: vampireActions },
  { entryKey: "vampire-mist", traits: vampireTraits, actionsByEnglishName: vampireActions },
];

const RULESET_ID = "41ebff94-aabc-4f5c-b437-28f2f7a195ee"; // SRD 5.1

async function main() {
  const { data: entries, error } = await supabase
    .from("ruleset_entries")
    .select("id, entry_key")
    .eq("ruleset_id", RULESET_ID)
    .eq("entry_type", "monster")
    .in("entry_key", specs.map((s) => s.entryKey));
  if (error) throw new Error(error.message);
  const entryIdByKey = new Map(entries.map((e) => [e.entry_key, e.id]));

  const { data: blocks, error: e2 } = await supabase
    .from("ruleset_entry_blocks")
    .select("entry_id, block_type, data")
    .in("entry_id", entries.map((e) => e.id))
    .in("block_type", ["traits", "actions"]);
  if (e2) throw new Error(e2.message);
  const blocksByEntry = new Map<string, Record<string, unknown>>();
  for (const b of blocks) {
    const m = blocksByEntry.get(b.entry_id) ?? {};
    m[b.block_type] = b.data;
    blocksByEntry.set(b.entry_id, m);
  }

  const upserts: { entry_id: string; locale: string; blocks: Record<string, unknown> }[] = [];

  for (const spec of specs) {
    const entryId = entryIdByKey.get(spec.entryKey);
    if (!entryId) throw new Error(`Entree introuvable : ${spec.entryKey}`);
    const b = blocksByEntry.get(entryId) ?? {};
    const englishTraits = ((b.traits as { traits?: { name: string }[] })?.traits ?? []).map((t) => t.name);
    const englishActions = ((b.actions as { actions?: { name: string; attack_bonus?: number; damage?: unknown }[] })?.actions ?? []);

    let traitsOut: Trait[];
    if (Array.isArray(spec.traits)) {
      traitsOut = spec.traits;
      if (traitsOut.length !== englishTraits.length) {
        throw new Error(`${spec.entryKey} : ${traitsOut.length} traits fournis, ${englishTraits.length} attendus (${englishTraits.join(", ")})`);
      }
    } else {
      traitsOut = englishTraits.map((en) => {
        const t = spec.traits && "byEnglishName" in spec.traits ? spec.traits.byEnglishName[en] : undefined;
        if (!t) throw new Error(`${spec.entryKey} : pas de trait francais pour "${en}"`);
        return t;
      });
    }

    const actionsOut = englishActions.map((en) => {
      const fr = spec.actionsByEnglishName[en.name];
      if (!fr) throw new Error(`${spec.entryKey} : pas d'action francaise pour "${en.name}"`);
      return { name: fr.name, description: fr.description, attack_bonus: en.attack_bonus, damage: en.damage };
    });

    const blockData: Record<string, unknown> = {};
    if (traitsOut.length > 0) blockData.traits = { traits: traitsOut };
    if (actionsOut.length > 0) blockData.actions = { actions: actionsOut };

    upserts.push({ entry_id: entryId, locale: "fr", blocks: blockData });
    console.log(`${spec.entryKey} : ${traitsOut.length} trait(s), ${actionsOut.length} action(s) — OK`);
  }

  if (!WRITE) {
    console.log("\n(mode dry-run, rien ecrit — relancer avec --write pour ecrire en base)");
    return;
  }

  for (const u of upserts) {
    const { data: existing } = await supabase.from("ruleset_entry_translations").select("name, blocks").eq("entry_id", u.entry_id).eq("locale", "fr").maybeSingle();
    const mergedBlocks = { ...(existing?.blocks as Record<string, unknown> | undefined), ...u.blocks };
    const { error: upsertError } = await supabase
      .from("ruleset_entry_translations")
      .upsert({ entry_id: u.entry_id, locale: "fr", name: existing?.name, blocks: mergedBlocks, source: "official_srd" }, { onConflict: "entry_id,locale" });
    if (upsertError) throw new Error(upsertError.message);
  }
  console.log(`\n${upserts.length} fiches ecrites en base.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
