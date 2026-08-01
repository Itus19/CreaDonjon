import { existsSync } from "node:fs";

// Charge .env.local pour les tests qui en ont besoin (integration, contact
// reel a Supabase — V1 D-01). Absent en CI ou sans base configuree : ces
// tests se sautent alors eux-memes (describe.skipIf), rien n'echoue. Pas
// de try/catch ici : si le fichier existe mais est mal forme, l'erreur de
// process.loadEnvFile doit remonter, pas etre avalee.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
