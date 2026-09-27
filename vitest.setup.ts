import { existsSync } from "node:fs";

// Charge .env.test.local EN PREMIER : ce fichier (ignore par Git, jamais
// commite) porte les identifiants Supabase LOCAUX (`supabase start`), pour
// que les tests d'integration touchent l'instance locale plutot que la
// production. `process.loadEnvFile` n'ecrase jamais une variable deja
// presente dans process.env — charger ce fichier en premier lui donne donc
// la priorite sur .env.local pour les cles qu'il definit (NEXT_PUBLIC_
// SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
if (existsSync(".env.test.local")) {
  process.loadEnvFile(".env.test.local");
}

// Puis .env.local pour le reste (cles IA, etc. — V1 D-01) : absent en CI ou
// sans base configuree, ces tests se sautent alors eux-memes
// (describe.skipIf), rien n'echoue. Pas de try/catch ici : si le fichier
// existe mais est mal forme, l'erreur de process.loadEnvFile doit remonter,
// pas etre avalee.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
