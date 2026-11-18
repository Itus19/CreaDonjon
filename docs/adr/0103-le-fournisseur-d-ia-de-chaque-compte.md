# 0103 — Le fournisseur d'IA de chaque compte

**Date :** 2026-11-18
**Statut :** acceptée (V3.1-224)

## Contexte

Le fournisseur d'IA est aujourd'hui une variable d'environnement du serveur : `AI_LOCAL_BASE_URL`, `AI_LOCAL_MODEL`, `AI_LOCAL_API_KEY`, lues par `getOpenAiCompatibleProviderFromEnv()`. Un seul fournisseur pour toute l'application, et changer d'avis demande d'éditer un fichier puis de redémarrer un serveur.

Deux constats l'ont rendu intenable, le 18 novembre, en voulant jouer :

1. **En ligne, un modèle local n'est pas joignable.** `localhost:1234` désigne le serveur Vercel, pas la machine du joueur. Les tours partaient et restaient muets (V3.1-223).
2. **Chacun doit payer pour soi.** L'auteur veut que chaque compte déclare son propre fournisseur — sa clé chez un fournisseur distant, ou un lien vers sa machine. Personne ne consomme les ressources d'un autre, et l'hébergeur ne paie pour personne.

La spec l'annonçait déjà : « le choix du modèle est un réglage du monde ou de l'utilisateur, pas une constante » (`specs/cible-locale-et-ia.md`).

Trois décisions commandent tout le reste.

## Options envisagées

### 1. Où vit le secret, et comment il est protégé

- **A — Chiffré par l'application** (AES-256-GCM, Node `crypto`), stocké en base sous forme opaque. La clé de chiffrement est une variable d'environnement du serveur, comme `ENGINE_SIGNING_KEY`.
- B — Chiffré par la base (`pgcrypto`, `pgp_sym_encrypt`). Autorisé par la règle 24, mais la valeur en clair traverse alors la requête SQL, donc potentiellement les journaux du serveur de base.
- C — En clair, protégé par la seule RLS. Refusé : une sauvegarde, un export, un journal de requêtes suffit à tout révéler.

### 2. Une URL fournie par l'utilisateur, appelée par notre serveur

C'est une **SSRF** par construction : l'utilisateur choisit une adresse, notre serveur l'appelle avec ses privilèges réseau.

- **A — Liste blanche de schémas, refus des adresses privées en production, aucune redirection suivie, délai court.** En développement (serveur sur la machine du joueur), les adresses privées restent permises : c'est tout l'intérêt du mode local.
- B — Tout autoriser. Refusé : sur un hébergeur, `169.254.169.254` est l'adresse des métadonnées d'instance.
- C — N'autoriser qu'une liste fermée de fournisseurs connus. Refusé : ferme la porte au lien vers sa propre machine, qui est la moitié de la demande.

### 3. Ce que voit un compte sans fournisseur

- **A — Il joue sans IA.** Le moteur est entier sans elle (`docs/backlog-v3/00-cadre.md` §3) ; l'écran dit que la narration est indisponible (V3.1-223).
- B — On lui prête celui du serveur. Refusé : c'est précisément ce que l'auteur ne veut pas.

## Décision

**1-A, 2-A, 3-A.**

### La table

Une ligne par compte, `ai_providers` :

| Colonne | Rôle |
|---|---|
| `user_id` | clé primaire, `references auth.users on delete cascade` |
| `label` | ce que l'utilisateur en dit (« Venice », « mon PC ») |
| `base_url` | l'adresse, compatible OpenAI (`…/v1`) |
| `model` | l'identifiant du modèle |
| `secret` | la clé d'API **chiffrée**, `text`, `null` si le fournisseur n'en demande pas |
| `created_at`, `updated_at` | — |

RLS en refus par défaut : chacun ne lit et n'écrit que **sa** ligne (`user_id = auth.uid()`). Aucun rôle, pas même un administrateur de monde, n'a de raison de lire la ligne d'un autre.

### Le secret ne revient jamais au client

C'est la règle qui tient tout le reste : `secret` ne sort **jamais** de la couche serveur, pas même vers son propriétaire. L'écran affiche « clé posée le 18 novembre », jamais la valeur — et surtout pas un champ pré-rempli, qui la remettrait dans le HTML. La remplacer veut dire la retaper.

Chiffrement : AES-256-GCM, clé `AI_SECRETS_KEY` (32 octets, 64 caractères hexadécimaux), posée comme `ENGINE_SIGNING_KEY` (voir `docs/CLE-MOTEUR.md` pour le motif). Sans elle, poser une clé est refusé avec un message explicite plutôt qu'un secret écrit en clair.

### La défense contre la SSRF

Avant tout appel, et à l'enregistrement :

- schéma **`https` seulement** en production ; `http` toléré en développement ;
- **refus des adresses privées et locales** en production : `localhost`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (métadonnées d'instance), `::1`, `fc00::/7` ;
- **aucune redirection suivie** (`redirect: "manual"`) : une adresse publique peut rediriger vers une adresse privée ;
- **délai court** et taille de réponse bornée, comme aujourd'hui.

Un lien vers sa propre machine passe donc par un tunnel, c'est-à-dire par une adresse publique — ce qui est exactement la bonne façon de l'exposer.

### Qui l'emporte

Pour un appel donné, le fournisseur se résout dans cet ordre :

1. celui **du compte** qui déclenche l'appel ;
2. à défaut, celui de l'**environnement** (`AI_LOCAL_*`), ce qui garde le comportement d'aujourd'hui sur une machine locale ;
3. à défaut, **aucun** : l'appel n'a pas lieu, le tour reste joué, l'écran le dit.

La résolution vit dans `src/server/ai/` (règle absolue 12), à côté de l'adaptateur. `ai_usage_log` continue de s'écrire à chaque appel (règle 13) et gagne de quoi dire **quel** fournisseur a servi.

## Conséquences

- Un compte peut jouer en ligne avec sa propre clé, sans que personne d'autre ne paie.
- Le texte de la partie quitte la machine dès qu'un fournisseur distant est choisi : l'écran le dit au moment de la saisie (`specs/cible-locale-et-ia.md`), et le collage assisté sur du contenu d'ouvrage reste réservé à un fournisseur local.
- Une clé perdue ne se récupère pas, elle se remplace. C'est le prix de ne jamais la rendre.
- Sans `AI_SECRETS_KEY`, l'application fonctionne : seule la pose d'une clé est refusée.
