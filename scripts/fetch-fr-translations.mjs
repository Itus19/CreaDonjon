// One-off (rerunnable) script: pulls whatever French translations already
// exist on the public dnd5eapi.co API (the same source our SRD JSON files
// came from) and generates SQL UPDATE statements for rows where the French
// name actually differs from what we have (i.e. a real translation exists,
// not just the API's English fallback). Coverage is partial - spells and
// classes are translated, monsters/equipment mostly are not, at least as
// of 2026-07-28 - so most entries will simply be skipped, which is expected.
//
// Usage: node scripts/fetch-fr-translations.mjs <output.sql>
// Then apply the result with:
//   npx supabase db query --linked --file <output.sql>

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const outputPath = process.argv[2];
if (!outputPath) {
  console.error("Usage: node scripts/fetch-fr-translations.mjs <output.sql>");
  process.exit(1);
}

const envContent = fs.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

async function fetchTranslation(url, cache) {
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(`https://www.dnd5eapi.co${url}?lang=fr-FR`)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  cache.set(url, promise);
  return promise;
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  let done = 0;
  async function next() {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]);
      done++;
      if (done % 200 === 0) {
        console.error(`... ${done}/${items.length} entries checked`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function fetchAllRows() {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, human_readable, structured_data")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    console.error(`... fetched ${rows.length} rows so far`);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  console.error("Fetching ruleset_entries from Supabase...");
  const rows = await fetchAllRows();
  console.error(`Loaded ${rows.length} rows.`);

  const withUrl = rows.filter((r) => r.structured_data?.url);
  console.error(`${withUrl.length} rows have a url field, checking for French translations...`);

  const cache = new Map();
  const updates = [];
  let translated = 0;
  let errors = 0;

  await runPool(withUrl, 6, async (row) => {
    const url = row.structured_data.url;
    let json;
    try {
      json = await fetchTranslation(url, cache);
    } catch {
      errors++;
      return;
    }
    if (!json) {
      errors++;
      return;
    }
    const frName = json.name;
    const currentName = row.human_readable?.name;
    if (frName && frName !== currentName) {
      const newHumanReadable = { ...row.human_readable, name: frName };
      if (json.desc !== undefined) newHumanReadable.desc = json.desc;
      updates.push({ id: row.id, human_readable: newHumanReadable });
      translated++;
    }
  });

  console.error(`Done. Checked ${withUrl.length}, translated ${translated}, errors ${errors}.`);

  const sqlLines = updates.map(
    (u) =>
      `update ruleset_entries set human_readable = '${escapeSql(JSON.stringify(u.human_readable))}'::jsonb where id = '${u.id}';`,
  );
  fs.writeFileSync(outputPath, sqlLines.join("\n") + "\n");
  console.error(`Wrote ${sqlLines.length} UPDATE statements to ${outputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
