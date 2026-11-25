# V3.2 — Acheter, vendre, échanger

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md). La décision : [ADR 0110](../adr/0110-acheter-vendre-echanger-en-solo.md).*

**Constaté le 25 novembre** : Mabelle, du Fanal, demande « cinq pièces pour la nuit ». Accepter ne débiterait rien : l'achat est une action libre, sans résolution. Une bière servie plus tôt n'a jamais été réclamée, parce que le modèle ne sait ni ce que la personne possède, ni ce qu'elle doit. Le prix lui-même est inventé.

**Demandé le même jour** : que les objets entrent et sortent de l'inventaire lors d'un achat, d'une vente ou d'un échange ; et qu'un manque de moyens ne bloque pas l'échange, mais soit joué par le PNJ, qui s'en rend compte.

Ordre : 8 et 9 d'abord (le noyau et les prix), puis 10 (l'écran), puis 11 (le contexte du modèle).

---

### ☐ V3.2-8 — Le moteur règle un échange · `M` · sans modèle IA — **prêt (Opus)**

**Le noyau d'abord, testé d'abord.** `src/core/rules/trade.ts` : un échange porte une contrepartie, ce que la personne donne et ce qu'elle reçoit. Chaque ligne est des pièces (dans le système monétaire du monde, `currency.ts`), un objet de l'inventaire (identifiant, quantité) ou un service (qui ne s'inscrit pas dans l'inventaire). Une fonction pure `settleTrade(inventory, trade, system)` rend soit `{ status: "settled", inventory }`, soit `{ status: "short", missing }`.

**Rendre la monnaie** : payer 5 pa avec une po rend 5 pa ; la conversion réutilise `applyCurrencyDelta`, sans réécrire l'arithmétique des pièces.

**L'écriture** passe par le même chemin que `changeCurrency` (`inventoryActions.ts`) : une révision du bloc `inventory`, jamais une mise à jour en place (règle absolue 17). Un échange court n'écrit rien.

**Annulable comme un tour** : `undo_before` (`turnIntent.ts`) garde aujourd'hui l'état d'exécution et la scène ; il gagne l'inventaire de la personne qui joue, et `turnUndo.ts` le restaure.

**Critères d'acceptation**
- [ ] Tests du noyau : achat exact, achat avec monnaie rendue, vente, échange objet contre objet, échange court (pièces, objet absent, quantité insuffisante), quantité d'un lot.
- [ ] Un échange réglé crée une révision de l'inventaire ; un échange court n'en crée aucune.
- [ ] Annuler le tour restitue pièces et objets.

---

### ☐ V3.2-9 — Le prix vient des règles · `M` · sans modèle IA — **à confirmer avec l'auteur (Opus)**

**Un objet** : son bloc `cost` (`rule-blocks/blocks.ts`, déjà saisi pour les objets du SRD, lots compris). **Revente** : la moitié du prix, arrondie à la pièce de cuivre inférieure (MdJ 2024).

**Un service sans fiche** (une nuit, un repas, une boisson, un bain) : une table de prix de la partie, rangée par niveau de richesse du lieu, sur le même axe `wealth` que le générateur Menu de taverne. Le contenu de la table est de la donnée de ruleset (`data/personnel/` ou base), jamais du code ni une migration (CLAUDE.md, « Saisir des règles »).

**Ce que le PNJ vend** : la liste fermée des offres du lieu (services de sa table, objets de son étal). C'est elle que l'intention de V3.2-10 reconnaît ; un objet absent de la liste ne s'achète pas.

**À trancher avec l'auteur avant de coder** : où vit la table de prix des services (un bloc de règle, une table aléatoire existante détournée, un réglage de partie), et d'où vient la richesse d'un lieu tant que les agrégats de lieux (ADR 0104) n'existent pas.

**Critères d'acceptation**
- [ ] Un objet du SRD a un prix d'achat et de revente sans saisie supplémentaire.
- [ ] Une nuit à l'auberge coûte un prix différent selon la richesse du lieu.
- [ ] Aucun prix n'est écrit dans le code.

---

### ☐ V3.2-10 — Acheter, vendre, échanger depuis « Que fais-tu ? » · `M` · sans modèle IA — **prêt après 8 et 9 (Sonnet)**

**Une intention `trade`** à côté des jets (`IntentChoice`, `turnIntent.ts`) : verbes « acheter, prendre, payer, vendre, échanger, donner, commander » ajoutés à `INTENT_VERBS_FR`, offres du lieu et objets de l'inventaire ajoutés au catalogue.

**La carte « ce que le moteur a compris »** montre l'échange et son prix : « Acheter : une nuit (auberge modeste) à Mabelle, 5 pa. » Deux boutons : « Payer » et « Mettre sur l'ardoise » (quand il s'agit de consommer sur place), plus « Annuler ».

**Un manque ne bloque pas.** La carte le signale (« tu as 3 pa sur 5 ») mais laisse envoyer. Le moteur n'écrit rien et produit un fait : « Edran tend 3 pa ; il en manque 2 pour la nuit (5 pa). » Ce fait part à la narration, et c'est le PNJ qui réagit.

**Critères d'acceptation**
- [ ] « Je prends la chambre » propose un achat au prix de la table, et Payer débite la bourse.
- [ ] « Je vends ma dague » retire la dague et crédite la moitié de son prix.
- [ ] Un achat sans assez de pièces part quand même, n'écrit rien, et le fait du manque est journalisé.
- [ ] Planche du catalogue mise à jour pour la carte (`docs/catalogue/`).

---

### ☐ V3.2-11 — Le PNJ sait ce que tu as et ce que tu dois · `S` · **avec modèle IA** — **prêt après 10 (Opus)**

**Deux lignes de plus dans le contexte du tour** (`buildTurnContext`), encadrées comme le reste : la bourse en clair (« 12 pa, 3 pc »), et l'ardoise du lieu (« 1 bière, 4 pc, due à Mabelle »). Le fait d'un manque (V3.2-10) y arrive comme tout autre fait.

**L'ardoise** est tenue par le moteur dans `scene_states.state` (`zSceneState`, aucune migration), indexée par lieu et par créancier pour survivre au changement de scène. Elle se remplit par « Mettre sur l'ardoise » et se vide par un paiement.

**Une consigne** : un PNJ qui a servi quelque chose d'impayé peut le réclamer ; il ne fixe jamais un prix lui-même et cite ceux du contexte. Ce qu'il propose (rabais, troc) reste de la narration : rien n'est appliqué sans un nouvel échange réglé par le moteur.

**Critères d'acceptation**
- [ ] Après une bière mise sur l'ardoise, le PNJ la réclame dans les trois tours suivants (vérifié avec le fournisseur choisi).
- [ ] Après un achat court, le PNJ réagit au manque sans inventer de nouveau prix.
- [ ] Aucun appel d'IA de plus ; `ai_usage_log` inchangé.

---

**Plus tard, hors de ces tickets** : marchander avec un jet de Persuasion (le moteur fixe le rabais par palier de réussite), et des PNJ qui achètent ou refusent selon leur bourse.
