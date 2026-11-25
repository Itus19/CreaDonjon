# 0110 — Acheter, vendre, échanger en solo : le moteur règle, le PNJ réagit

**Date :** 2026-11-25
**Statut :** proposée (demande de l'auteur du 25 novembre, à confirmer avant tout code)

## Contexte

Séance du 25 novembre : Mabelle, du Fanal, annonce « cinq pièces pour la nuit ». Si la personne qui joue accepte, rien n'est débité. Plus tôt, une bière a été servie et jamais réclamée. Trois trous dans le code :

- « Je prends la chambre » est une **action libre** (`turnIntent.ts`, `kind: "free"`), journalisée avec `resolution: "aucune"`.
- La narration (`soloNarrationProposal.ts`) n'a **aucun canal** pour une dépense ; c'est voulu (règle absolue 9), mais du coup personne ne débite.
- Le contexte du tour (`buildTurnContext`) ne contient **ni la bourse, ni un prix, ni ce qui reste dû**. Le prix « cinq pièces » est inventé par le modèle, sans même dire de quelle pièce : contraire à l'ADR 0104 (« ses chiffres viennent des règles »).

Le débit existe déjà côté serveur (`changeCurrency`, `inventoryActions.ts`, refus `insufficient_funds`) mais seule la fiche l'appelle.

L'auteur demande en plus : (1) que les **objets** entrent et sortent de l'inventaire lors d'un achat, d'une vente ou d'un échange ; (2) qu'un **manque de moyens ne bloque pas** l'échange à l'écran, mais soit envoyé au modèle, qui joue un PNJ qui s'en rend compte.

## Options

- **A — L'IA propose la transaction** (un canal `trade` dans la sortie de narration, validé par Zod). Refusé : le modèle fixerait le prix et déciderait de l'échange, deux résultats de règle (règle absolue 8).
- **B — Le moteur règle tout, la personne qui joue confirme, le modèle ne fait que réagir.** Retenu.
- **C — Ne rien automatiser, payer à la main dans l'Inventaire.** C'est l'état actuel ; il casse le jeu à chaque auberge.

## Décision

B, en quatre pièces.

1. **Un échange est une donnée du noyau** (`src/core/rules/trade.ts`, pur, testé d'abord) : une contrepartie (le PNJ), ce que la personne donne (pièces, objets de son inventaire) et ce qu'elle reçoit (pièces, objets, un service). Une fonction pure dit : **réglé** (le nouvel inventaire, pièces et objets) ou **court** (la liste de ce qui manque). Aucune lecture, aucun hasard.
2. **Le prix vient des règles, jamais du modèle.** Un objet : son bloc `cost` (déjà saisi pour les objets du SRD). Un service sans fiche (nuit, repas, boisson) : une table de prix de la partie, rangée par niveau de richesse du lieu (même axe `wealth` que le générateur Menu de taverne). La revente rapporte la moitié du prix (règle du MdJ 2024). Le contenu de ces tables est de la donnée de ruleset, pas du code (CLAUDE.md, « Saisir des règles »).
3. **Un manque n'est pas une erreur, c'est un fait.** Quand l'échange est court, le moteur n'écrit rien, mais le tour continue : un fait comme « Edran tend 3 pa ; il en manque 2 pour la chambre (5 pa) » part dans le contexte de narration, et le PNJ réagit (refuse, propose moins, appelle la garde). Ce que le PNJ « propose » n'est **jamais appliqué** : c'est de la narration ; pour en faire un nouvel échange, la personne qui joue le reformule et le moteur le règle. Marchander avec un jet viendra plus tard (hors de cet ADR).
4. **Le PNJ sait ce que la personne possède et ce qu'elle doit.** Le contexte du tour reçoit la bourse (en clair : « 12 pa, 3 pc ») et l'**ardoise** : ce qui a été servi sans être payé, avec son prix. L'ardoise est tenue par le moteur dans `scene_states.state` (jsonb validé par `zSceneState`, aucune migration) et indexée par lieu et par créancier, pour survivre au changement de scène.

## Conséquences

- Nouveau type d'intention `trade` à côté des jets ; la carte « ce que le moteur a compris » montre le prix et, s'il y a lieu, ce qui manque, sans empêcher l'envoi.
- Chaque échange réglé écrit le bloc `inventory` par le même chemin que `changeCurrency` (une révision, immuable) et doit pouvoir **s'annuler** comme un tour : `undo_before` gagne l'inventaire, il ne garde aujourd'hui que l'état d'exécution et la scène.
- La sortie du modèle ne change pas : aucun nouveau canal, aucun appel de plus. Seul le contexte grossit de deux lignes encadrées.
- Route ou action nouvelle : schéma Zod, autorisation par `canEditEntity`, liste de contrôle de `docs/SECURITE.md`.
- Tickets : V3.2-8 à V3.2-11 (`docs/backlog-v3.2/04-commerce.md`).
