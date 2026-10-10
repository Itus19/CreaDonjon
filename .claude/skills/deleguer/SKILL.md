---
name: deleguer
description: Méthode de délégation de la session principale (Opus) aux sous-agents dev-sonnet et aide-haiku — quoi déléguer, à qui, avec quel brief, comment relire, et comment noter le coût. À charger AVANT tout appel à un sous-agent sur CreaDonjon, et au début de tout ticket du backlog qui pourrait se déléguer.
metadata:
  origin: écrit pour CreaDonjon (ADR 0053). La méthode de tri et de reclassement reprend les idées de TokenWise (github.com/CodeShuX/tokenwise, MIT), lu le 10 octobre ; l'outil lui-même n'est pas installé.
---

# Déléguer aux sous-agents

But : que **chaque modèle fasse ce qu'il fait bien au moindre coût**, sans que la qualité baisse. Opus orchestre et reste responsable de tout ce qui est commité.

## 1. Trier : à qui va la tâche ?

Applique ces règles **dans l'ordre**. Quand deux cases conviennent, prends **la moins chère** : une erreur de tri coûte un reclassement, alors qu'un tri trop haut coûte à chaque fois.

| # | Si la tâche… | Elle va à |
|---|---|---|
| 1 | tient en quelques lignes, ou a besoin du contexte déjà chargé dans cette session | **Opus, en direct** : déléguer coûterait plus que faire |
| 2 | touche la conception, un ADR, la sécurité, la RLS, une migration, le noyau du moteur, l'IA, ou un ticket marqué « Opus » | **Opus** |
| 3 | a **une seule bonne réponse**, sans jugement : vérifier, résumer des échecs, reporter des libellés, mettre à jour une planche d'après du code écrit, recenser des usages, cocher des cases désignées | **`aide-haiku`** |
| 4 | est un ticket « Sonnet », ou une implémentation bornée (refactorisation, tests d'un module, écran d'après une planche décidée) | **`dev-sonnet`** |
| 5 | est une relecture, un diagnostic, un choix entre options déjà posées | **Opus** |

Repères de taille :
- **Plus de deux fichiers à concevoir ensemble**, ou une spécification ambiguë : c'est de la conception, Opus d'abord. Opus pose le plan, puis délègue l'exécution.
- **Contexte à lire de plus de ~30 000 jetons** (un gros fichier, de nombreux fichiers) : monte d'un cran, de Haiku à Sonnet ou de Sonnet à Opus.

## 2. Le brief : ce que le sous-agent reçoit

Un sous-agent **repart de zéro**. Chaque information que le brief ne donne pas, il la cherchera en lisant, et c'est ce qui coûte. Un bon brief tient en 10 à 25 lignes :

```
Ticket : V3.1-NN — <titre>, dans docs/backlog-v3.1/<fichier>.md (ne lis que ce ticket).
But : <une phrase>.
Plan décidé (ne pas rediscuter) :
1. …
2. …
Fichiers à toucher : <chemins>. À lire si besoin : <chemins précis, pas « le projet »>.
Ne pas toucher : <chemins, ou « rien hors de ces fichiers »>.
Arrête-toi et rends la question si : <cas prévisibles : schéma, sécurité, choix de design>.
Rends : fichiers touchés ; critères cochés ou non (et pourquoi) ; à vérifier en direct ;
hésitations. Court : pas de recopie du code.
```

Pour `aide-haiku`, **regroupe en une seule délégation** les sous-tâches Haiku d'un même ticket : libellés, planche, vérifications. Donne-lui les **clés et les textes exacts**, jamais « trouve les libellés à ajouter ».

## 3. Économiser

- **En parallèle** : lance dans le même message les délégations indépendantes, par exemple Haiku qui recense pendant que Sonnet code une autre partie.
- **Le même agent pour corriger** : pour une reprise, envoie un message à l'agent déjà lancé (`SendMessage`) plutôt qu'en ouvrir un nouveau, qui relirait tout.
- **Des comptes rendus courts** : le résultat d'un sous-agent entre dans le contexte d'Opus. Exige des listes, pas de prose, pas de code recopié ; Opus lit le diff lui-même.
- **Pas de délégation en cascade** : un sous-agent ne lance jamais d'autre sous-agent. C'est Opus qui répartit.

## 4. Relire avant de commiter

Ce qui est délégué reste sous la responsabilité d'Opus.

1. `git diff --stat`, puis le diff complet des fichiers sensibles : routes, services, `src/core`, tout ce qui touche à l'accès.
2. Contrôle les **règles absolues** au vu du diff, sans faire confiance au compte rendu : Zod en entrée, requêtes seulement dans `repos/`, pas de `any`, pas de `catch` silencieux, libellés dans `messages/`, pas d'émoji.
3. Relance toi-même `npm run typecheck && npm run lint && npm run test`, ou fais-les relancer par `aide-haiku` avec un résumé.
4. Un défaut **local** se corrige directement ; un défaut **de fond** (mauvaise approche) repart au même agent avec la raison.
5. Commit par Opus, message en français, avec la note de clôture du ticket.

## 5. Quand un sous-agent bute

Il **ne s'escalade jamais tout seul** : il s'arrête et rend la main avec une raison :
- « mauvaise case » ;
- « spécification ambiguë » ;
- « hors de ses capacités » ;
- « touche une règle absolue ».

Opus reclasse **une seule fois**, directement vers la bonne case. Si ça bute encore, Opus finit lui-même. Une question qui engage le projet (schéma, sécurité, choix de produit) va à l'auteur.

## 6. Mesurer

À la clôture d'un ticket délégué, ajoute une ligne à [`docs/DELEGATIONS.md`](../../../docs/DELEGATIONS.md) : date, ticket, agent, jetons du sous-agent (si son résultat les indique), issue (accepté tel quel / corrigé / renvoyé / repris par Opus), et une remarque courte.

Après une dizaine de lignes, relis le journal. Les tâches souvent renvoyées montent d'un cran ; celles toujours acceptées peuvent descendre. On ajuste ce skill sur ces chiffres, pas sur une impression.
