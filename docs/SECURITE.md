# Sécurité de CreaDonjon

**À quoi sert ce document.** Les règles de sécurité existent déjà :
- les règles absolues 1 à 7 de `CLAUDE.md` ;
- les trois barrières d'[`ARCHITECTURE.md`](ARCHITECTURE.md) §4 ;
- la RLS dans [`SCHEMA.md`](SCHEMA.md) §19 ;
- les ADR.

Ce document ajoute ce qui manquait : **contre quoi on se protège** (§1), **comment on vérifie qu'un changement est sûr** (§2), et **ce qui a été trouvé et ce qui reste ouvert** (§3).

**Quand le lire :** avant tout ticket qui touche une route API, une action serveur, une migration ou un compte. Le skill `deleguer` l'impose aux sous-agents.

---

## 1. Le modèle de menace

CreaDonjon est un outil personnel : un MJ et sa table. Les menaces réalistes ne sont pas des attaquants organisés. Ce sont :

| Qui | Ce qu'il peut faire sans effort | Exemple |
|---|---|---|
| **Une joueuse curieuse** | Ouvrir les outils du navigateur, lire les réponses JSON, rejouer une requête en changeant un identifiant | Lire les PV d'un adversaire, changer ceux d'une autre joueuse |
| **N'importe qui avec un compte** | Créer un compte en libre-service depuis `/login`, puis créer son propre monde : il en devient administrateur | Utiliser ce droit d'administrateur de **son** monde pour agir sur un compte ou un objet d'un **autre** monde |
| **Quelqu'un qui a un lien** | Un lien d'invitation ou de partage public qui circule au-delà de la table | Rejoindre une campagne, lire une page partagée |
| **Une session Claude** | Les sessions cloud ont la clé service de Supabase, qui contourne toute la RLS | Une suppression ou une écriture faite trop vite, sur la vraie base |
| **L'usage lui-même** | Le plan gratuit de Supabase a des quotas (utilisateurs actifs par mois, trafic) | Des tests qui créent des comptes en boucle et font tomber l'app pour la table |

**Ce qu'aucun d'eux ne doit jamais obtenir :**
1. un **secret du MJ** : bloc ou segment caché, PV et CA des adversaires, notes privées ;
2. **le compte d'un autre** : sa session, son mot de passe, un lien de connexion ;
3. **modifier ce qui n'est pas à lui** : la fiche d'une autre, un combat, une règle d'un autre ruleset ;
4. **faire tomber l'app** pour tout le monde (quotas).

**Où sont les portes**, c'est-à-dire tout ce qu'un client peut appeler :
- les routes `app/api/**/route.ts` ;
- les actions serveur (`app/actions.ts`, `"use server"`) ;
- les tables, directement, avec la clé publique (la RLS est alors la seule barrière) ;
- les trois fichiers qui passent outre la RLS (ARCHITECTURE §4).

## 2. La liste de contrôle

Pour **toute** route, action serveur, migration ou fonction SQL nouvelle ou modifiée. Chaque case correspond à une faille réellement trouvée (§3).

**Entrée**
- [ ] Les paramètres d'adresse **et** le corps sont validés par un schéma Zod (règle 4). Un paramètre d'URL est une entrée comme une autre.
- [ ] La session est exigée (`auth.getUser()`), sauf page publique voulue et documentée.

**Droit**
- [ ] Le droit est vérifié **côté serveur**, avant toute lecture sensible ou écriture.
- [ ] Il porte sur **l'objet visé** et sur **son appartenance** : ce combat est-il bien dans cette campagne ? Ce participant dans ce combat ? Ce compte membre de cette campagne ?
- [ ] Être administrateur de *son* monde ne donne **aucun** droit ailleurs : on compare toujours le monde de l'appelant au monde de l'objet.
- [ ] « Refusé » est répondu **avant** « introuvable » : la différence ne doit pas trahir ce que l'appelant n'a pas le droit de voir.

**Confiance**
- [ ] Aucun identifiant venu du client n'est cru sur parole, qu'il arrive par l'URL, le corps ou un **cookie**. httpOnly empêche le JavaScript de lire un cookie ; il n'empêche personne d'en envoyer un forgé.
- [ ] Un geste qui donne la main sur un compte (« voir comme », réinitialisation, lien de connexion) ne vise jamais un compte à email réel, sauf superadmin pour la réinitialisation ; un MJ ne vise que les membres de sa campagne (ADR 0052).

**Base**
- [ ] La RLS de chaque table touchée est écrite pour **le rôle le plus faible** qui peut s'y connecter : joueuse, compte sans campagne.
- [ ] Une fonction `security definer` vérifie elle-même l'appelant (`auth.uid()`, appartenance) et fixe son `search_path`.
- [ ] Une valeur cachée n'est **pas envoyée** au client, même dans un champ inutilisé (règle 5).

**Preuve**
- [ ] Un test prouve qu'une joueuse, ou un compte d'un autre monde, est **refusé** : une règle pure dans `src/core` avec ses tests, et un test d'intégration RLS.
- [ ] `/security-review` (Claude Code) sur la branche, pour un changement qui touche une porte.

## 3. Le registre des failles

Chaque faille trouvée : sa date, sa correction et son état. **État** : *corrigée* (en ligne), *en attente* (code fusionné, migration ou vérification à faire), *ouverte*.

| Date | Faille | Gravité | Correction | État |
|---|---|---|---|---|
| 9 oct. | **Retour de « voir comme »** : le cookie portait l'identifiant du superadmin, et la route fabriquait un lien de connexion pour lui. Un cookie forgé suffisait à prendre son compte. | critique | ADR 0051 : le cookie porte le jeton de rafraîchissement de la session d'origine (`7005392`) | corrigée |
| 9 oct. | **Réinitialisation forcée** : tout administrateur de monde, donc tout compte, obtenait un lien de réinitialisation pour n'importe quel compte. | critique | ADR 0052 : membre de la campagne et compte « tag » seulement (`b4ff29e`) | corrigée |
| 10 oct. | **Combats** : tout membre du monde lisait les PV et la CA des adversaires et modifiait le combat ; dix routes sans contrôle MJ, sans Zod sur l'adresse, dont trois sans session. | haute | V3.1-101, ADR 0040 : porte commune `guardCombatRoute` (`5e202b5`) et migration `20261010120000_combats_gm_only` | **en attente** : appliquer la migration |
| 9 oct. | **État de jeu** : tout membre du monde écrit l'état de jeu de n'importe quelle fiche (PV, états, inspiration…). | haute | V3.1-108, ADR 0043 | **ouverte** (en cours) |
| 10 oct. | **Quota Supabase** : les anciens tests créaient un compte par exécution, ce qui a fait déborder les utilisateurs actifs. | moyenne (disponibilité) | Groupe fixe de comptes de test ; ménage de 69 → 15 comptes (`docs/TESTS.md`) | corrigée |

**Pour ajouter une ligne :** à chaque faille trouvée, même corrigée dans la foulée, avec le commit. Une ligne *en attente* ne passe à *corrigée* que vérifiée en ligne.
