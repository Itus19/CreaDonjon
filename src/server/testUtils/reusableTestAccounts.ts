import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Comptes de test reutilisables (retour utilisateur, apres depassement du
 * quota Egress/MAU de Supabase) : chaque test d'integration creait jusque
 * la un compte jetable unique (`admin.auth.admin.createUser`, horodate),
 * signe une fois puis supprime en `afterAll`. Le nombre de comptes CREES
 * n'a pas d'importance pour l'egress, mais chaque connexion compte comme un
 * "Monthly Active User" facture — meme un compte supprime dans la foulee.
 * Des dizaines de fichiers, executes des dizaines de fois dans le mois,
 * ont ainsi produit plus de 6000 MAU en un mois sur un plan gratuit qui en
 * inclut 50 000, faisant au passage deborder l'egress (chaque compte cree
 * une session, chaque session porte son propre trafic reseau).
 *
 * Ce module remplace "un compte jetable par test" par "un petit groupe fixe
 * de comptes reutilises par TOUS les fichiers" : un roublard nomme
 * (`ROLE_EMAILS`) par role generique, cree une seule fois puis retrouve par
 * email a chaque appel. Peu importe que "owner" signifie "proprietaire du
 * monde" dans un fichier et "createur de la campagne" dans un autre — le
 * compte ne porte aucune donnee entre deux tests, seulement une identite
 * stable. Chaque test reste responsable de nettoyer les donnees qu'il a
 * lui-meme creees (worlds/rulesets/etc. par owner_id/created_by, comme
 * avant) ; ce module ne supprime jamais le COMPTE lui-meme.
 *
 * Mot de passe fixe et partage : ce ne sont pas des comptes personnels,
 * seulement des identites de test, jamais exposees hors de ce module.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FIXED_PASSWORD = "integration-test-pool-2026-ne-pas-utiliser-ailleurs";

/**
 * Huit roles couvrent le fichier le plus exigeant du lot
 * (`canEditEntityRls`, sept profils simultanes) avec une marge d'un —
 * `playerB`/`playerC` servent partout ou un test a besoin de PLUSIEURS
 * joueurs distincts en meme temps (ex. "un joueur ne voit pas la fiche d'un
 * autre joueur"). Ajouter un role est une ligne ici, jamais une raison de
 * revenir a un compte jetable.
 */
const ROLE_EMAILS = {
  owner: "test-pool-owner@creadonjon.local",
  gm: "test-pool-gm@creadonjon.local",
  editor: "test-pool-editor@creadonjon.local",
  player: "test-pool-player@creadonjon.local",
  playerB: "test-pool-player-b@creadonjon.local",
  playerC: "test-pool-player-c@creadonjon.local",
  outsider: "test-pool-outsider@creadonjon.local",
  viewer: "test-pool-viewer@creadonjon.local",
} as const;
export type ReusableRole = keyof typeof ROLE_EMAILS;

export interface ReusableAccount {
  id: string;
  email: string;
  /** Client anonyme deja connecte comme ce compte — jamais `persistSession`, meme convention que les clients de test crees a la main. */
  client: SupabaseClient;
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  // Pas d'endpoint "par email" cote Admin API — le pool reste assez petit
  // (six roles) pour qu'un listUsers pagine, filtre cote client, reste
  // trivial. Jamais appele en boucle serree : un seul appel par compte
  // demande, memoise par `getReusableTestAccount` au niveau du processus
  // de test n'apporterait rien ici (chaque fichier tourne dans son propre
  // process vitest) — le cout reel est deja au niveau du reseau, pas de la
  // pagination.
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
    page++;
  }
}

/**
 * Retrouve (ou cree la toute premiere fois) le compte reutilisable d'un
 * role, et renvoie un client deja connecte comme lui. Course possible si
 * deux fichiers de test tournent en parallele et demandent le MEME role
 * pour la toute premiere fois : `createUser` echoue alors avec "already
 * registered" cote le perdant de la course, repli sur une recherche par
 * email plutot qu'une erreur — le gagnant a deja cree exactement le compte
 * que le perdant cherchait.
 */
export async function getReusableTestAccount(admin: SupabaseClient, role: ReusableRole): Promise<ReusableAccount> {
  if (!SUPABASE_URL || !ANON_KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent etre definies.");
  const email = ROLE_EMAILS[role];

  let userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: FIXED_PASSWORD, email_confirm: true });
    if (error) {
      if (!/already.*registered|already exists/i.test(error.message)) throw new Error(error.message);
      userId = await findUserIdByEmail(admin, email);
      if (!userId) throw new Error(`compte de pool "${role}" introuvable apres une creation en double`);
    } else {
      if (!data.user) throw new Error(`creation du compte de pool "${role}" echouee sans message`);
      userId = data.user.id;
    }
  }

  const client = createSupabaseClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: FIXED_PASSWORD });
  if (signInError) throw new Error(signInError.message);

  return { id: userId, email, client };
}
