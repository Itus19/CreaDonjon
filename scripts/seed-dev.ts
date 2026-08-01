// Jeu de donnees de demonstration (P0-09, SCHEMA.md §23), environnement de
// developpement uniquement.
//
// Lancement : npm run seed:dev — APRES avoir applique les migrations et
// lance `npm run ingest:srd`. Ce n'est volontairement pas une migration
// SQL : la variante "Valdoria" reference le ruleset officiel SRD 5.1 par
// `parent_ruleset_id`, et ce ruleset n'existe qu'apres l'import du SRD
// (P0-08), qui est lui-meme un script, pas une migration. Une migration
// numerotee 013 s'executerait pendant `supabase db reset`, avant que ce
// script ait pu tourner : elle ne trouverait jamais le ruleset officiel.
//
// Idempotent : si le monde "valdoria" existe deja, le script s'arrete sans
// rien recreer.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local)."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Identifiants fixes pour tout ce qui n'est pas auth.users (dont les ids
// sont attribues par Supabase Auth) : simplifie les references croisees
// (relations, `ref` dans les segments narratifs, personnage joue en solo).
const IDS = {
  world: "aaaaaaaa-0000-0000-0000-000000000001",
  rulesetVariant: "aaaaaaaa-0000-0000-0000-000000000004",
  entityValdoria: "aaaaaaaa-0000-0000-0000-00000000ad01",
  entityAncre: "aaaaaaaa-0000-0000-0000-00000000a001",
  entityMain: "aaaaaaaa-0000-0000-0000-00000000f001",
  entityDague: "aaaaaaaa-0000-0000-0000-00000000d001",
  entityBram: "aaaaaaaa-0000-0000-0000-00000000b001",
  mechRev1: "aaaaaaaa-0000-0000-0000-00000000c001",
  mechRev2: "aaaaaaaa-0000-0000-0000-00000000c002",
  campaignGroup: "aaaaaaaa-0000-0000-0000-000000000005",
  campaignSolo: "aaaaaaaa-0000-0000-0000-000000000006",
  session: "aaaaaaaa-0000-0000-0000-000000000007",
  templates: {
    pnj: "aaaaaaaa-0000-0000-0000-0000000000e1",
    creature: "aaaaaaaa-0000-0000-0000-0000000000e2",
    lieu: "aaaaaaaa-0000-0000-0000-0000000000e3",
    faction: "aaaaaaaa-0000-0000-0000-0000000000e4",
    objet: "aaaaaaaa-0000-0000-0000-0000000000e5",
    quete: "aaaaaaaa-0000-0000-0000-0000000000e6",
    evenement: "aaaaaaaa-0000-0000-0000-0000000000e7",
  },
} as const;

async function ensureUser(email: string): Promise<string> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`listUsers : ${listError.message}`);
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "demo-password-creadonjon",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${email}) : ${error?.message}`);
  return data.user.id;
}

/** Toutes les insertions ici n'ont pas besoin de la ligne retournee : on
 * connait deja les ids (fixes ou captures via ensureUser). Cette aide
 * verifie juste l'absence d'erreur. */
function must(result: { error: { message: string } | null }, label: string): void {
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
}

async function main() {
  const { data: existingWorld } = await supabase
    .from("worlds")
    .select("id")
    .eq("slug", "valdoria")
    .maybeSingle();
  if (existingWorld) {
    console.log("Le monde 'valdoria' existe deja — rien a faire.");
    return;
  }

  const { data: officialRuleset, error: officialRulesetError } = await supabase
    .from("rulesets")
    .select("id")
    .eq("is_official_base", true)
    .eq("base_system", "dnd_srd_51")
    .maybeSingle();
  if (officialRulesetError) throw new Error(officialRulesetError.message);
  if (!officialRuleset) {
    throw new Error(
      "Aucun ruleset officiel SRD 5.1 en base. Lancer `npm run ingest:srd` avant `npm run seed:dev`."
    );
  }

  const mjUserId = await ensureUser("mj-demo@creadonjon.local");
  const playerUserId = await ensureUser("joueur-demo@creadonjon.local");

  must(
    await supabase.from("worlds").insert({
      id: IDS.world,
      owner_id: mjUserId,
      name: "Valdoria",
      slug: "valdoria",
      calendar: {
        name: "Calendrier de Valdoria",
        days_per_week: 7,
        months: [
          { name: "Semailles", days: 30 }, { name: "Floraison", days: 30 },
          { name: "Solstice", days: 30 }, { name: "Moisson", days: 30 },
          { name: "Vendange", days: 30 }, { name: "Brumaire", days: 30 },
          { name: "Gelee", days: 30 }, { name: "Neigefonte", days: 30 },
          { name: "Renouveau", days: 30 }, { name: "Zenith", days: 30 },
          { name: "Declin", days: 30 }, { name: "Veille", days: 30 },
        ],
        eras: [{ name: "Troisieme Age", starts_year: 0 }],
      },
    }),
    "insert worlds"
  );

  must(
    await supabase
      .from("world_members")
      .insert({ world_id: IDS.world, user_id: playerUserId, role: "viewer" }),
    "insert world_members"
  );

  must(
    await supabase.from("rulesets").insert({
      id: IDS.rulesetVariant,
      name: "Valdoria — variante maison",
      base_system: "dnd_srd_51",
      parent_ruleset_id: officialRuleset.id,
      is_official_base: false,
      created_by: mjUserId,
    }),
    "insert rulesets (variante)"
  );

  must(
    await supabase
      .from("worlds")
      .update({ default_ruleset_id: IDS.rulesetVariant })
      .eq("id", IDS.world),
    "update worlds.default_ruleset_id"
  );

  // « Chez moi la boule de feu... » : une surcharge vise un bloc, pas
  // l'entree entiere (specs/regles-blocs.md §8).
  must(
    await supabase.from("ruleset_overrides").insert({
      ruleset_id: IDS.rulesetVariant,
      entry_key: "fireball",
      block_type: "description",
      action: "patch_block",
      patch: {
        segments: [
          {
            text: "Variante maison (Valdoria) : la boule de feu laisse une odeur de souffre caracteristique, reconnue par les gardes de la ville.",
          },
        ],
      },
      note: "Ambiance locale pour Valdoria, aucun changement de regle.",
      created_by: mjUserId,
    }),
    "insert ruleset_overrides"
  );

  must(
    await supabase.from("entity_templates").insert([
      { id: IDS.templates.pnj, world_id: null, name: "PNJ", entity_kind: "character", icon: "user", blocks: ["text", "character", "relationships"], is_builtin: true },
      { id: IDS.templates.creature, world_id: null, name: "Créature", entity_kind: "creature", icon: "paw-print", blocks: ["text", "statblock"], is_builtin: true },
      { id: IDS.templates.lieu, world_id: null, name: "Lieu", entity_kind: "location", icon: "map-pin", blocks: ["text", "infobox", "image"], is_builtin: true },
      { id: IDS.templates.faction, world_id: null, name: "Faction", entity_kind: "faction", icon: "flag", blocks: ["text", "infobox", "relationships"], is_builtin: true },
      { id: IDS.templates.objet, world_id: null, name: "Objet", entity_kind: "item", icon: "package", blocks: ["text", "inventory"], is_builtin: true },
      { id: IDS.templates.quete, world_id: null, name: "Quête", entity_kind: "quest", icon: "scroll", blocks: ["text"], is_builtin: true },
      { id: IDS.templates.evenement, world_id: null, name: "Événement", entity_kind: "event", icon: "calendar", blocks: ["text", "timeline"], is_builtin: true },
    ]),
    "insert entity_templates"
  );

  // Plus de `summary` sur l'entite (V0-06e) : le texte descriptif vit dans
  // un bloc `text`, comme le reste du contenu narratif.
  must(
    await supabase.from("entities").insert([
      { id: IDS.entityValdoria, world_id: IDS.world, entity_kind: "location", slug: "valdoria-royaume", name: "Valdoria", created_by: mjUserId },
      { id: IDS.entityAncre, world_id: IDS.world, entity_kind: "location", slug: "l-ancre-rouillee", name: "L'Ancre Rouillée", created_by: mjUserId },
      { id: IDS.entityMain, world_id: IDS.world, entity_kind: "faction", slug: "la-main-silencieuse", name: "La Main Silencieuse", created_by: mjUserId },
      { id: IDS.entityDague, world_id: IDS.world, entity_kind: "item", slug: "dague", name: "Dague", created_by: mjUserId },
      { id: IDS.entityBram, world_id: IDS.world, entity_kind: "character", slug: "bram-le-tavernier", name: "Bram le Tavernier", created_by: mjUserId },
    ]),
    "insert entities"
  );

  must(
    await supabase.from("blocks").insert([
      {
        entity_id: IDS.entityValdoria, block_type: "text", display: { label: "Description", layout: "prose" }, visibility_level: "public", display_order: 100, created_by: mjUserId,
        data: { __v: 1, segments: [{ id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "Un royaume côtier au climat tempéré, entre forêt et falaises." }] }] },
      },
      {
        entity_id: IDS.entityAncre, block_type: "text", display: { label: "Description", layout: "prose" }, visibility_level: "public", display_order: 100, created_by: mjUserId,
        data: { __v: 1, segments: [{ id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "Une taverne au port, connue pour sa bière tiède et ses rumeurs fraîches." }] }] },
      },
      {
        entity_id: IDS.entityMain, block_type: "text", display: { label: "Description", layout: "prose" }, visibility_level: "public", display_order: 100, created_by: mjUserId,
        data: { __v: 1, segments: [{ id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "Personne n'admet en faire partie." }] }] },
      },
      {
        entity_id: IDS.entityDague, block_type: "text", display: { label: "Description", layout: "prose" }, visibility_level: "public", display_order: 100, created_by: mjUserId,
        data: { __v: 1, segments: [{ id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "Une dague simple, sans histoire particulière — pour l'instant." }] }] },
      },
      // Bram — description publique, deux segments dont un `ref` (SCHEMA.md
      // §6, exemple donne au mot pres).
      {
        entity_id: IDS.entityBram, block_type: "text", display: { label: "Description", layout: "prose" }, visibility_level: "public", display_order: 100, created_by: mjUserId,
        data: { __v: 1, segments: [{
          id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null },
          content: [
            { t: "text", v: "Le tavernier de " },
            { t: "ref", kind: "entity", id: IDS.entityAncre, label: "L'Ancre Rouillée" },
            { t: "text", v: " semble jovial et accueillant." },
          ],
        }] },
      },
      {
        entity_id: IDS.entityBram, block_type: "text", display: { label: "Description", layout: "prose" }, visibility_level: "gm", display_order: 200, created_by: mjUserId,
        data: { __v: 1, segments: [{
          id: "s2", blockType: "paragraph", visibility: { level: "gm", scopeId: null },
          content: [
            { t: "text", v: "En réalité, il travaille pour " },
            { t: "ref", kind: "entity", id: IDS.entityMain, label: "la Main Silencieuse" },
            { t: "text", v: "." },
          ],
        }] },
      },
      {
        entity_id: IDS.entityBram, block_type: "character", visibility_level: "gm", display_order: 300, created_by: mjUserId,
        data: {
          species: { kind: "rule", key: "human" },
          background: null,
          classes: [],
          abilities: { method: "standard_array", base: { str: 11, dex: 12, con: 12, int: 10, wis: 13, cha: 14 } },
          choices: {},
          hp_method: "fixed",
          portrait_asset_id: null,
        },
      },
      {
        entity_id: IDS.entityBram, block_type: "inventory", visibility_level: "gm", display_order: 400, created_by: mjUserId,
        data: {
          items: [
            { id: "i1", ref: { kind: "entity", id: IDS.entityDague }, qty: 1, equipped: true, slot: "main_hand" },
            { id: "i2", label: "Trousseau de clés de la taverne", qty: 1 },
          ],
          containers: [],
          currency: { pp: 0, gp: 14, ep: 0, sp: 6, cp: 0 },
        },
      },
    ]),
    "insert blocks"
  );

  must(
    await supabase.from("relations").insert([
      { world_id: IDS.world, source_entity_id: IDS.entityBram, target_entity_id: IDS.entityMain, relation_type: "member_of", visibility_level: "gm", created_by: mjUserId },
      { world_id: IDS.world, source_entity_id: IDS.entityBram, target_entity_id: IDS.entityDague, relation_type: "owns", visibility_level: "public", created_by: mjUserId },
      { world_id: IDS.world, source_entity_id: IDS.entityAncre, target_entity_id: IDS.entityValdoria, relation_type: "part_of", visibility_level: "public", created_by: mjUserId },
    ]),
    "insert relations"
  );

  must(
    await supabase.from("entity_mechanical_revisions").insert([
      { id: IDS.mechRev1, entity_id: IDS.entityDague, revision_number: 1, mechanical_data: { ref: { kind: "rule", key: "dagger" }, enchantment: 0 }, change_note: "État initial : dague standard.", created_by: mjUserId },
      { id: IDS.mechRev2, entity_id: IDS.entityDague, revision_number: 2, mechanical_data: { ref: { kind: "rule", key: "dagger" }, enchantment: 1, name_suffix: "+1" }, change_note: "Enchantée lors d'une séance.", created_by: mjUserId },
    ]),
    "insert entity_mechanical_revisions"
  );

  must(
    await supabase.from("entities").update({ current_mechanical_revision_id: IDS.mechRev2 }).eq("id", IDS.entityDague),
    "update entities.current_mechanical_revision_id"
  );

  must(
    await supabase.from("campaigns").insert([
      { id: IDS.campaignGroup, world_id: IDS.world, ruleset_id: IDS.rulesetVariant, gm_user_id: mjUserId, mode: "campaign", name: "La Garde de L'Ancre" },
      { id: IDS.campaignSolo, world_id: IDS.world, ruleset_id: IDS.rulesetVariant, gm_user_id: null, mode: "solo", name: "Bram, une nuit tranquille" },
    ]),
    "insert campaigns"
  );

  must(
    await supabase.from("campaign_members").insert([
      { campaign_id: IDS.campaignGroup, user_id: mjUserId, role: "gm" },
      { campaign_id: IDS.campaignGroup, user_id: playerUserId, role: "player" },
      { campaign_id: IDS.campaignSolo, user_id: playerUserId, role: "player" },
    ]),
    "insert campaign_members"
  );

  must(
    await supabase.from("campaign_characters").insert({
      campaign_id: IDS.campaignSolo, entity_id: IDS.entityBram, user_id: playerUserId, is_pc: true,
    }),
    "insert campaign_characters"
  );

  must(
    await supabase.from("entity_runtime_state").insert({
      entity_id: IDS.entityBram, campaign_id: IDS.campaignSolo,
      state: { hp: { current: 9, temp: 0 }, hit_dice: { d8: 1 }, exhaustion: 0, conditions: [] },
    }),
    "insert entity_runtime_state"
  );

  must(
    await supabase.from("sessions").insert({ id: IDS.session, campaign_id: IDS.campaignSolo, title: "Une nuit tranquille à L'Ancre" }),
    "insert sessions"
  );

  must(
    await supabase.from("session_events").insert([
      { session_id: IDS.session, seq: 1, kind: "narration", actor: "ai", payload: { text: "La taverne est calme en ce début de soirée." } },
      { session_id: IDS.session, seq: 2, kind: "player_action", actor: "player", actor_user_id: playerUserId, payload: { text: "Bram range les chopes derrière le comptoir." } },
      { session_id: IDS.session, seq: 3, kind: "roll", actor: "system", payload: { expression: "1d20+1", result: 14, reason: "perception" } },
      { session_id: IDS.session, seq: 4, kind: "rule_application", actor: "ai", payload: { rule_key: "perception", outcome: "Bram remarque un individu louche près de la porte." } },
      { session_id: IDS.session, seq: 5, kind: "world_update", actor: "system", payload: { entity_discovery: { entity_id: IDS.entityMain, detail_level: "mentioned" } } },
    ]),
    "insert session_events"
  );

  console.log("Jeu de donnees de demonstration cree : monde Valdoria, 5 entites, 2 campagnes, 1 session.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
