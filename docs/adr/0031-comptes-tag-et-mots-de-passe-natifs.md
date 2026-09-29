# 0031 — Comptes « tag » à mot de passe natif, liens joueurs réutilisables, réinitialisation médiée

**Date :** 2026-09-29
**Statut :** acceptée

## Contexte

V3.1-10 (`docs/BACKLOG_V3.1.md`) part d'un constat d'usage : les joueuses redemandent
systématiquement le lien d'invitation à l'auteur, parce qu'un compte invité
(ADR 0015, `provisionInviteSession`) n'a jamais d'email réel ni de mot de
passe — seulement une adresse synthétique et une reconnexion par lien
magique. Rien qu'une joueuse puisse retenir ou retrouver seule.

Ce document acte les décisions structurantes retenues sur plusieurs échanges
les 27-29 septembre, qui remplacent ce mécanisme plutôt que de l'étendre.

## Décisions

**1. Mot de passe natif Supabase Auth, jamais scrypt.** Un mot de passe de
*compte* passe par `auth.admin.createUser({ email, password })` /
`signInWithPassword` (GoTrue) — jamais par `hashSharePassword`
(`src/core/shareLinks/password.ts`), qui reste réservé aux mots de passe de
*lien* (partage, invitation), lesquels ne correspondent à aucune identité
`auth.users`.

**2. Le lien magique ne sert plus de canal de connexion courant.**
`mintSessionForInvitedAccount`/`mintSessionForOwnAccount` continuent
d'exister tels quels, réservés à « voir comme » côté superadmin (ADR 0015
inchangée). Rejoindre un monde ou se connecter passe désormais par un mot
de passe choisi par la personne elle-même, jamais par un jeton envoyé en
sous-main.

**3. Comptes « tag », comptes sans monde.** Un compte peut exister sans être
membre d'aucun monde. Il porte un nom affiché (`profiles.handle_name`, pas
unique seul) et un identifiant à 4 chiffres généré automatiquement
(`profiles.handle_tag`, unique avec `handle_name`) — attribution interne
uniquement, jamais visible hors des réglages du compte concerné. La
connexion se fait par nom + mot de passe ; la résolution essaie chaque
compte « tag » portant ce nom contre ce mot de passe, puis retombe sur un
email classique. Les comptes ordinaires (email réel, `/signup`/`/login`)
restent inchangés.

**4. Les liens joueurs deviennent réutilisables ; les liens MJ restent
nominatifs.** Renverse la décision de V2-M4 (« un lien par personne ») :
une fois que c'est la personne elle-même qui choisit son identité et son
mot de passe, la nominativité d'un lien joueur perd son intérêt. Un lien MJ
garde son usage unique (droits plus sensibles). Conséquence de schéma :
`campaign_invites.claimed_by_user_id`/`claimed_name` cessent d'être la
source de vérité pour un lien de rôle `player` — qui a rejoint un monde par
ce lien redevient une lecture de `campaign_members`, pas de l'invitation
elle-même. Aucune nouvelle table de suivi.

**5. Réinitialisation médiée par jeton à usage unique, pas par email.**
« Pas de miracle sans email. » Le bouton « mot de passe oublié » sur
l'écran de connexion dépose une demande (horodatage sur `profiles`, jamais
un jeton utilisable directement) ; elle apparaît dans le panneau de tout MJ
dont ce compte est membre d'un monde, ou du superadmin si le compte n'est
membre d'aucun. C'est le geste « Forcer une réinitialisation » qui génère le
jeton réellement utilisable — même primitive que les liens d'invitation
(`src/core/campaignInvites/token.ts`), pas une nouvelle mécanique. Le canal
de remise du lien (Discord, en personne...) reste hors de l'application, à
l'identique de ce que l'auteur fait déjà aujourd'hui.

**6. Un troisième trou confiné pour le client service-role**, jamais
l'élargissement des deux existants — même principe que l'ADR 0015, qui
anticipait explicitement ce cas dans ses conséquences. `accountProvisioning.ts`
reste borné à la séquence provisionner-compte-invité →
réclamer-personnage/rôle → générer-lien-magique (portée inchangée). Un
nouveau fichier, `src/server/services/accountAuth.ts`, construit seul son
propre client (`lib/supabase/serviceAccountAuth.ts`, confiné par la même
règle ESLint `no-restricted-imports`), pour tout ce qui touche un mot de
passe de compte : création d'un compte « tag », réinitialisation forcée,
et les gestes superadmin généralisés (réinitialiser/supprimer n'importe
quel compte, transférer un ruleset personnel).

## Conséquences

- `provisionInviteSession` change de nature : un lien réclamé pour la
  première fois ne crée plus un compte passif sans mot de passe, il ouvre
  un choix de mot de passe (compte neuf) ou une connexion (compte
  existant) — traité par `accountAuth.ts`, pas par `accountProvisioning.ts`.
  `accountProvisioning.ts` garde uniquement l'attache monde/rôle/personnage
  une fois l'identité établie, et le mécanisme de « voir comme ».
- Le garde-fou actuel de `deleteInvitedAccount`/`mintSessionForInvitedAccount`
  (« refuse un compte jamais issu d'un lien d'invitation ») ne suffit plus
  une fois les comptes « tag » libre-service possibles : la suppression
  généralisée (superadmin, tout compte) vit désormais dans `accountAuth.ts`,
  `deleteInvitedAccount` reste ce qu'il est pour son propre usage (« voir
  comme » sur un compte invité).
- Un troisième besoin de contournement RLS, plus tard, ouvrirait un
  quatrième trou du même type plutôt que d'élargir l'un des trois
  existants — le principe reconductible de l'ADR 0015 continue de tenir.
