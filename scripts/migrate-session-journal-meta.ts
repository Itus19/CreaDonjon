// V2.1-3 suite (retour utilisateur) — bascule les entrees du Livre de
// sessions creees AVANT la refonte du bloc "Séance" (infobox generique,
// lignes supprimables) vers le nouveau type dedie `session_journal_meta`
// (champs fixes, "Session du"). `submitJournalEntry` ne pose ce bloc qu'A
// LA CREATION d'une entree : les entrees deja redigees ne se mettent jamais
// a jour toutes seules, d'ou cette bascule ponctuelle.
//
// Source de verite : `session_journal_entries` (ingame_date, assigned_to,
// written_at) — jamais une relecture du texte de l'ancien infobox, qui ne
// contient qu'un libelle mis en forme ("1 Vendémiaire 0"), pas une date
// structuree ni un identifiant de compte.
//
// Idempotent : ne touche que les blocs encore `block_type = "infobox"`
// libelles "Séance" sur une entite `session_journal` redigee — une fois
// bascule en `session_journal_meta`, une deuxieme execution l'ignore.
//
// Lancement : npm run migrate:session-journal-meta           (simulation, lit seulement)
//             npm run migrate:session-journal-meta -- --write (ecrit pour de vrai)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WRITE = process.argv.includes("--write");

interface EntryRow {
  id: string;
  campaign_id: string;
  ingame_date: unknown;
  assigned_to: string;
  written_at: string | null;
  entity_id: string;
}

interface BlockRow {
  id: string;
  entity_id: string;
  block_type: string;
  display: { label?: string } | null;
  version: number;
}

async function resolveAuthorName(campaignId: string, userId: string, cache: Map<string, Map<string, string>>): Promise<string> {
  let byUser = cache.get(campaignId);
  if (!byUser) {
    byUser = new Map();
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select("user_id, role")
      .eq("campaign_id", campaignId);
    if (membersError) throw new Error(membersError.message);
    for (const m of members) {
      if (m.role === "gm") byUser.set(m.user_id, "MJ");
    }

    const { data: characters, error: charactersError } = await supabase
      .from("campaign_characters")
      .select("entity_id, user_id, is_pc")
      .eq("campaign_id", campaignId)
      .eq("is_pc", true);
    if (charactersError) throw new Error(charactersError.message);
    const pcs = characters.filter((c): c is typeof c & { user_id: string } => c.user_id !== null);
    if (pcs.length > 0) {
      const { data: entities, error: entitiesError } = await supabase
        .from("entities")
        .select("id, name")
        .in("id", pcs.map((c) => c.entity_id));
      if (entitiesError) throw new Error(entitiesError.message);
      const nameByEntity = new Map(entities.map((e) => [e.id, e.name]));
      for (const pc of pcs) {
        if (!byUser.has(pc.user_id)) byUser.set(pc.user_id, nameByEntity.get(pc.entity_id) ?? "?");
      }
    }
    cache.set(campaignId, byUser);
  }
  return byUser.get(userId) ?? "?";
}

async function main() {
  const { data: entries, error: entriesError } = await supabase
    .from("session_journal_entries")
    .select("id, campaign_id, ingame_date, assigned_to, written_at, entity_id")
    .eq("status", "written")
    .not("entity_id", "is", null)
    .returns<EntryRow[]>();
  if (entriesError) throw new Error(entriesError.message);
  console.log(`${entries.length} entree(s) redigee(s) trouvee(s) dans session_journal_entries.`);

  const entityIds = entries.map((e) => e.entity_id);
  const { data: blocks, error: blocksError } = await supabase
    .from("blocks")
    .select("id, entity_id, block_type, display, version")
    .in("entity_id", entityIds)
    .eq("block_type", "infobox")
    .returns<BlockRow[]>();
  if (blocksError) throw new Error(blocksError.message);
  const seanceBlocksByEntity = new Map(
    blocks.filter((b) => b.display?.label === "Séance").map((b) => [b.entity_id, b])
  );
  console.log(`${seanceBlocksByEntity.size} bloc(s) "Séance" encore au format infobox.`);

  const nameCache = new Map<string, Map<string, string>>();
  let migrated = 0;

  for (const entry of entries) {
    const block = seanceBlocksByEntity.get(entry.entity_id);
    if (!block) continue;

    const authorName = await resolveAuthorName(entry.campaign_id, entry.assigned_to, nameCache);
    const newData = {
      __v: 1,
      ingameDate: entry.ingame_date,
      writtenBy: { userId: entry.assigned_to, name: authorName },
      writtenAt: entry.written_at,
      realSession: null,
    };

    console.log(`  -> entite ${entry.entity_id} (bloc ${block.id}) : rédigé par "${authorName}", écrit le ${entry.written_at}`);

    if (WRITE) {
      const { error: updateError } = await supabase
        .from("blocks")
        .update({ block_type: "session_journal_meta", data: newData, version: block.version + 1 })
        .eq("id", block.id);
      if (updateError) throw new Error(`update bloc ${block.id}: ${updateError.message}`);
    }
    migrated++;
  }

  console.log(`\n${WRITE ? "Basculés" : "À basculer (simulation, relancer avec --write pour écrire)"} : ${migrated}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
