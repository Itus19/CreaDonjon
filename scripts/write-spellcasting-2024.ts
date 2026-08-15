// V1-D3b (SRD 5.2.1) : `spellcasting_progression.info` en francais pour les
// 8 classes incantatrices. Chaque paragraphe transcrit mot pour mot depuis
// data/srd/fr-source/srd-5.2.1-fr.txt (sections "Niveau 1 : Sorts" de
// chaque classe), verifie par correspondance de nom anglais->position dans
// le tableau deja importe (ruleset_entry_blocks), jamais par index nu — la
// structure 2024 est standardisee (Sorts mineurs/Emplacements de
// sort/Sorts prepares du 1er niveau et plus/Modification des sorts
// prepares/Caracteristique d'incantation/Focaliseur d'incantation) mais
// Paladin et Rodeur n'ont pas de sorts mineurs (5 rubriques au lieu de 6).
//
// Lancement : npx tsx --env-file=.env.local scripts/write-spellcasting-2024.ts [--write]

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Variables d'environnement manquantes.");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WRITE = process.argv.includes("--write");
const RULESET_ID = "110d20e9-dd80-4752-a57e-a957601b4eae"; // SRD 5.2.1

const FR: Record<string, Record<string, string>> = {
  bard: {
    Cantrips:
      "Vous connaissez deux sorts mineurs que vous choisissez dans la liste des sorts de Barde. Lumières dansantes et moquerie cruelle sont recommandés. Chaque fois que vous gagnez un niveau de Barde, vous pouvez remplacer l’un de vos sorts mineurs par un autre sort mineur de votre choix dans la liste du Barde. Lorsque vous atteignez le niveau 4 de Barde, puis le niveau 10, vous apprenez un autre sort mineur de votre choix issu de la liste du Barde, comme indiqué à la colonne Sorts mineurs de la table « Aptitudes du Barde ».",
    "Spell Slots":
      "La table « Aptitudes du Barde » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts du 1er niveau et supérieur. Vous récupérez tous les emplacements dépensés en terminant un Repos long.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. Pour commencer, choisissez quatre sorts du 1er niveau issus de la liste de sorts du Barde. Charme-personne, couleurs dansantes, mot de guérison et murmures dissonants sont recommandés. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux de Barde, comme l’indique la colonne Sorts préparés de la table « Aptitudes du Barde ». Chaque fois que ce nombre augmente, choisissez des sorts de Barde supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table. Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Si, par exemple, vous êtes un Barde de niveau 3, votre liste de sorts préparés peut inclure six sorts de Barde du 1er ou 2e niveau, répartis à votre guise. Si une autre aptitude de Barde vous octroie des sorts toujours préparés, ces sorts ne sont pas décomptés du nombre de sorts que vous pouvez préparer avec la présente aptitude, mais ils sont considérés pour vous comme des sorts de Barde.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous gagnez un niveau de barde, vous pouvez remplacer un sort de votre liste par un autre sort de barde pour lequel vous disposez d’au moins un emplacement.",
    "Spellcasting Ability": "Le Charisme est la caractéristique d’incantation de vos sorts de Barde.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un instrument de musique comme focaliseur d’incantation de vos sorts de Barde.",
  },
  cleric: {
    Cantrips:
      "Vous connaissez trois sorts mineurs que vous choisissez dans la liste de sorts du Clerc. Assistance, flamme sacrée et thaumaturgie sont recommandés. Chaque fois que vous gagnez un niveau de Clerc, vous pouvez remplacer l’un de vos sorts mineurs par un autre sort mineur de votre choix dans la liste du Clerc. Lorsque vous atteignez le niveau 4 de Clerc, puis le niveau 10, vous apprenez un autre sort mineur de votre choix issu de la liste du Clerc, comme indiqué à la colonne Sorts mineurs de la table « Aptitudes du Clerc ».",
    "Spell Slots":
      "La table « Aptitudes du Clerc » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts du 1er niveau et supérieur. Vous récupérez tous les emplacements dépensés en terminant un Repos long.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. Pour commencer, choisissez quatre sorts du 1er niveau issus de la liste de sorts du Clerc. Bénédiction, bouclier de la foi, rayon traçant et soins sont recommandés. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux de Clerc, comme l’indique la colonne Sorts préparés de la table « Aptitudes du Clerc ». Chaque fois que ce nombre augmente, choisissez des sorts de Clerc supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table. Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Si, par exemple, vous êtes un Clerc de niveau 3, votre liste de sorts préparés peut inclure six sorts de Clerc du 1er ou 2e niveau, répartis à votre guise. Si une autre aptitude de Clerc vous octroie des sorts toujours préparés, ces sorts ne sont pas décomptés du nombre de sorts que vous pouvez préparer avec la présente aptitude, mais ils sont considérés pour vous comme des sorts de Clerc.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous terminez un Repos long, vous pouvez changer votre liste de sorts préparés en remplaçant des sorts par d’autres sorts de clerc pour lesquels vous disposez d’emplacements.",
    "Spellcasting Ability": "La Sagesse est la caractéristique d’incantation de vos sorts de clerc.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un symbole sacré comme focaliseur d’incantation de vos sorts de clerc.",
  },
  druid: {
    Cantrips:
      "Vous connaissez deux sorts mineurs que vous choisissez dans la liste des sorts de Druide. Druidisme et flammes sont recommandés. Chaque fois que vous gagnez un niveau de Druide, vous pouvez remplacer l’un de vos sorts mineurs par un autre sort mineur de votre choix dans la liste du Druide. Lorsque vous atteignez le niveau 4 de Druide, puis le niveau 10, vous apprenez un autre sort mineur de votre choix issu de la liste du Druide, comme indiqué à la colonne Sorts mineurs de la table « Aptitudes du Druide ».",
    "Spell Slots":
      "La table « Aptitudes du Druide » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts du 1er niveau et supérieur. Vous récupérez tous les emplacements dépensés en terminant un Repos long.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. Pour commencer, choisissez quatre sorts du 1er niveau issus de la liste de sorts du Druide. Amitié avec les animaux, lueurs féeriques, soins et vague tonnante sont recommandés. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux de Druide, comme l’indique la colonne Sorts préparés de la table « Aptitudes du Druide ». Chaque fois que ce nombre augmente, choisissez des sorts de Druide supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table. Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Si, par exemple, vous êtes un Druide de niveau 3, votre liste de sorts préparés peut inclure six sorts de Druide du 1er ou 2e niveau, répartis à votre guise. Si une autre aptitude de Druide vous octroie des sorts toujours préparés, ces sorts ne sont pas décomptés du nombre de sorts que vous pouvez préparer avec la présente aptitude, mais ils sont considérés pour vous comme des sorts de Druide.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous terminez un Repos long, vous pouvez changer votre liste de sorts préparés en remplaçant des sorts par d’autres sorts de Druide pour lesquels vous disposez d’emplacements.",
    "Spellcasting Ability": "La Sagesse est la caractéristique d’incantation de vos sorts de druide.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un focaliseur druidique comme focaliseur d’incantation de vos sorts de druide.",
  },
  wizard: {
    Cantrips:
      "Vous connaissez trois sorts mineurs de Magicien de votre choix. Chaque fois que vous terminez un Repos long, vous pouvez remplacer l’un de vos sorts mineurs de cette aptitude par un autre sort mineur de Magicien de votre choix. Lorsque vous atteignez les niveaux 4 et 10 de Magicien, vous apprenez un autre sort mineur de Magicien de votre choix, comme indiqué en colonne Sorts mineurs de la table « Aptitudes du Magicien ».",
    "Spell Slots":
      "La table « Aptitudes du Magicien » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts du 1er niveau et supérieur. Vous récupérez tous les emplacements dépensés en terminant un Repos long.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. À cette fin, choisissez quatre sorts de votre grimoire. Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux de Magicien, comme l’indique la colonne Sorts préparés de la table « Aptitudes du Magicien ». Chaque fois que ce nombre augmente, choisissez des sorts de Magicien supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table. Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Si, par exemple, vous êtes un Magicien de niveau 3, votre liste de sorts préparés peut inclure six sorts de Magicien du 1er ou 2e niveau, répartis à votre guise.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous terminez un Repos long, vous pouvez changer votre liste de sorts préparés en remplaçant des sorts par d’autres sorts de Magicien de votre grimoire.",
    "Spellcasting Ability": "L’Intelligence est la caractéristique d’incantation de vos sorts de Magicien.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un focaliseur arcanique ou de votre grimoire comme focaliseur d’incantation de vos sorts de Magicien.",
  },
  sorcerer: {
    Cantrips:
      "Vous connaissez quatre sorts mineurs d’Ensorceleur de votre choix. Éruption ensorcelée, lumière, poigne électrique et prestidigitation sont recommandés. Chaque fois que vous gagnez un niveau d’Ensorceleur, vous pouvez remplacer l’un de vos sorts mineurs de cette aptitude par un autre sort mineur d’Ensorceleur de votre choix. Lorsque vous atteignez les niveaux 4 et 10 d’Ensorceleur, vous apprenez un autre sort mineur d’Ensorceleur de votre choix, comme indiqué en colonne Sorts mineurs de la table « Aptitudes de l’Ensorceleur ».",
    "Spell Slots":
      "La table « Aptitudes de l’Ensorceleur » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts du 1er niveau et supérieur. Vous récupérez tous les emplacements dépensés en terminant un Repos long.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. Pour commencer, choisissez deux sorts d’Ensorceleur du 1er niveau. Détection de la magie et mains brûlantes sont recommandés. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux d’Ensorceleur, comme l’indique la colonne Sorts préparés de la table « Aptitudes de l’Ensorceleur ». Chaque fois que ce nombre augmente, choisissez des sorts d’Ensorceleur supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table « Aptitudes de l’Ensorceleur ». Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Si, par exemple, vous êtes un Ensorceleur de niveau 3, votre liste de sorts préparés peut inclure six sorts d’Ensorceleur du 1er ou 2e niveau, répartis à votre guise. Si une autre aptitude d’Ensorceleur vous octroie des sorts toujours préparés, ces sorts ne sont pas décomptés du nombre de sorts que vous pouvez préparer avec la présente aptitude, mais ils sont considérés pour vous comme des sorts d’Ensorceleur.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous gagnez un niveau d’Ensorceleur, vous pouvez remplacer un sort de votre liste par un autre sort d’Ensorceleur pour lequel vous disposez d’au moins un emplacement.",
    "Spellcasting Ability": "Le Charisme est la caractéristique d’incantation de vos sorts d’Ensorceleur.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un focaliseur arcanique comme focaliseur d’incantation de vos sorts d’Ensorceleur.",
  },
  warlock: {
    Cantrips:
      "Vous connaissez deux sorts mineurs d’Occultiste de votre choix. Décharge occulte et prestidigitation sont recommandés. Chaque fois que vous gagnez un niveau d’Occultiste, vous pouvez remplacer l’un de vos sorts mineurs de cette aptitude par un autre sort mineur d’Occultiste de votre choix. Lorsque vous atteignez les niveaux 4 et 10 d’Occultiste, vous apprenez un autre sort mineur d’Occultiste de votre choix, comme indiqué en colonne Sorts mineurs de la table Aptitudes de l’Occultiste.",
    "Spell Slots":
      "La table « Aptitudes de l’Occultiste » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts d’Occultiste du 1er au 5e niveau. La table indique en outre le niveau de ces emplacements, qui sont tous du même niveau. Vous récupérez tous les emplacements de sort de Magie de pacte dépensés en terminant un Repos court ou long. En tant qu’Occultiste de niveau 5, par exemple, vous disposez de deux emplacements de sorts du 3e niveau. Pour lancer le sort du 1er niveau charme-personne, vous devez dépenser l’un de ces emplacements et vous le lancez comme un sort du 3e niveau.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. Pour commencer, choisissez deux sorts du 1er niveau de l’Occultiste. Charme-personne et maléfice sont recommandés. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux d’Occultiste, comme l’indique la colonne Sorts préparés de la table « Aptitudes de l’Occultiste ». Chaque fois que ce nombre augmente, choisissez des sorts d’Occultiste supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table « Aptitudes de l’Occultiste ». Les sorts choisis ne doivent pas être d’un niveau supérieur à ce qui figure dans la colonne Niveau des emplacements pour votre niveau. Lorsque vous atteignez le niveau 6, par exemple, vous apprenez un nouveau sort d’Occultiste, qui peut être du 1er au 3e niveau. Si une autre aptitude d’Occultiste vous octroie des sorts toujours préparés, ces sorts ne sont pas décomptés du nombre de sorts que vous pouvez préparer avec la présente aptitude, mais ils sont considérés pour vous comme des sorts d’Occultiste.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous gagnez un niveau d’Occultiste, vous pouvez remplacer un sort de votre liste par un autre sort d’Occultiste de niveau conforme.",
    "Spellcasting Ability": "Le Charisme est la caractéristique d’incantation de vos sorts d’Occultiste.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un focaliseur arcanique comme focaliseur d’incantation de vos sorts d’Occultiste.",
  },
  paladin: {
    "Spell Slots":
      "La table « Aptitudes du Paladin » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts du 1er niveau et supérieur. Vous récupérez tous les emplacements dépensés en terminant un Repos long.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. Pour commencer, choisissez deux sorts du 1er niveau du Paladin. Héroïsme et châtiment de fournaise sont recommandés. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux de Paladin, comme l’indique la colonne Sorts préparés de la table « Aptitudes du Paladin ». Chaque fois que ce nombre augmente, choisissez des sorts de Paladin supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table « Aptitudes du Paladin ». Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Si, par exemple, vous êtes un Paladin de niveau 5, votre liste de sorts préparés peut inclure six sorts de Paladin du 1er ou 2e niveau, répartis à votre guise. Si une autre aptitude de Paladin vous octroie des sorts toujours préparés, ces sorts ne sont pas décomptés du nombre de sorts que vous pouvez préparer avec la présente aptitude, mais ils sont considérés pour vous comme des sorts de Paladin.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous terminez un Repos long, vous pouvez remplacer l’un des sorts de votre liste par un autre sort de Paladin pour lequel vous disposez d’emplacements de sort.",
    "Spellcasting Ability": "Le Charisme est la caractéristique d’incantation de vos sorts de paladin.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un symbole sacré comme focaliseur d’incantation de vos sorts de paladin.",
  },
  ranger: {
    "Spell Slots":
      "La table « Aptitudes du Rôdeur » vous indique le nombre d’emplacements de sort dont vous disposez pour lancer vos sorts du 1er niveau et supérieur. Vous récupérez tous les emplacements dépensés en terminant un Repos long.",
    "Prepared Spells of Level 1+":
      "Vous devez préparer la liste des sorts du 1er niveau et supérieur que cette aptitude vous permet de lancer. Pour commencer, choisissez deux sorts du 1er niveau du Rôdeur. Frappe piégeuse et soins sont recommandés. Le nombre de sorts de votre liste augmente à mesure que vous recevez des niveaux de Rôdeur, comme l’indique la colonne Sorts préparés de la table « Aptitudes du Rôdeur ». Chaque fois que ce nombre augmente, choisissez des sorts de Rôdeur supplémentaires jusqu’à ce que le nombre de sorts de votre liste corresponde au nombre indiqué dans la table « Aptitudes du Rôdeur ». Ces sorts doivent être d’un niveau pour lequel vous disposez d’emplacements de sort. Si, par exemple, vous êtes un Rôdeur de niveau 5, votre liste de sorts préparés peut inclure six sorts de Rôdeur du 1er ou 2e niveau, répartis à votre guise. Si une autre aptitude de Rôdeur vous octroie des sorts toujours préparés, ces sorts ne sont pas décomptés du nombre de sorts que vous pouvez préparer avec la présente aptitude, mais ils sont considérés pour vous comme des sorts de Rôdeur.",
    "Changing Your Prepared Spells":
      "Chaque fois que vous terminez un Repos long, vous pouvez remplacer l’un des sorts de votre liste par un autre sort de Rôdeur pour lequel vous disposez d’emplacements de sort.",
    "Spellcasting Ability": "La Sagesse est la caractéristique d’incantation de vos sorts de Rôdeur.",
    "Spellcasting Focus": "Vous pouvez vous servir d’un focaliseur druidique comme focaliseur d’incantation de vos sorts de Rôdeur.",
  },
};

async function main() {
  const { data: entries, error } = await supabase
    .from("ruleset_entries")
    .select("id, entry_key")
    .eq("ruleset_id", RULESET_ID)
    .eq("entry_type", "class")
    .in("entry_key", Object.keys(FR));
  if (error) throw new Error(error.message);

  const { data: blocks, error: e2 } = await supabase
    .from("ruleset_entry_blocks")
    .select("entry_id, data")
    .in("entry_id", entries.map((e) => e.id))
    .eq("block_type", "spellcasting_progression");
  if (e2) throw new Error(e2.message);

  const upserts: { entry_key: string; entry_id: string; info: { name: string; description: string }[] }[] = [];

  for (const entry of entries) {
    const block = blocks.find((b) => b.entry_id === entry.id);
    if (!block) throw new Error(`${entry.entry_key} : pas de bloc spellcasting_progression`);
    const englishInfo = (block.data as { info?: { name: string }[] }).info ?? [];
    const frMap = FR[entry.entry_key];
    const info = englishInfo.map((e) => {
      const description = frMap[e.name];
      if (!description) throw new Error(`${entry.entry_key} : pas de traduction pour "${e.name}"`);
      return { name: e.name, description };
    });
    if (info.length !== englishInfo.length) throw new Error(`${entry.entry_key} : ${info.length} rubriques francaises, ${englishInfo.length} attendues`);
    upserts.push({ entry_key: entry.entry_key, entry_id: entry.id, info });
    console.log(`${entry.entry_key} : ${info.length} rubrique(s) — OK`);
  }

  if (!WRITE) {
    console.log("\n(mode dry-run, rien ecrit — relancer avec --write pour ecrire en base)");
    return;
  }

  for (const u of upserts) {
    const { data: existing } = await supabase.from("ruleset_entry_translations").select("name, blocks").eq("entry_id", u.entry_id).eq("locale", "fr").maybeSingle();
    const existingBlocks = (existing?.blocks as Record<string, unknown> | undefined) ?? {};
    const existingSpellcasting = (existingBlocks.spellcasting_progression as { ability?: string; starts_at_level?: number } | undefined) ?? {};
    const mergedBlocks = { ...existingBlocks, spellcasting_progression: { ...existingSpellcasting, info: u.info } };
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
