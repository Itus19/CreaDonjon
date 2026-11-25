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

### ☑ V3.2-9 — Le prix vient des règles et du wiki · `M` · sans modèle IA — **fait (Opus)**

**Un objet** : son bloc `cost` (`rule-blocks/blocks.ts`, déjà saisi pour les objets du SRD, lots compris). **Revente** : la moitié du prix, arrondie à la pièce de cuivre inférieure (MdJ 2024).

**Un service ou une consommation** (une nuit, un repas, une boisson) : **la carte du lieu, sur sa page de wiki** (idée de l'auteur, 25 novembre). Le générateur Taverne tire déjà un menu à prix structurés (`GeneratorSlotItem.price` : montant et pièce) selon la richesse du lieu (axe `wealth` : modeste, correcte, réputée). Il manque deux choses :

1. **Un bloc typé « Carte et tarifs »** (`price_list`) sur la page du lieu : une liste d'offres (libellé, prix, nature service ou objet, renvoi facultatif vers une fiche de règle) et la richesse retenue. Pas du texte : le moteur doit lire un prix, pas le deviner dans une phrase. La promotion d'un tirage Taverne (`promotion.ts`) écrit aujourd'hui le menu en texte simple ; elle écrira ce bloc à la place. Nouveau type de bloc : schéma Zod et registre (`blocks/registry.ts`), aucune migration (`block_type` n'est pas contraint en base), une planche du catalogue.
2. **Un tirage paresseux et figé** : la carte se tire la première fois qu'on en a besoin (création du lieu, ou première demande « qu'est-ce que vous servez ? », ou premier achat), avec une graine tirée de l'identifiant du lieu, puis elle est écrite dans le bloc et ne bouge plus (ADR 0104 : un détail se fige quand on le découvre). Une richesse inconnue est tirée au même moment, et retenue dans le bloc.

**La nuit à l'auberge** (ajout du 25 novembre) : la section « La Chambre » du générateur ne tire ni prix ni palier. Le prix vient de la fiche « Train de vie » du SRD 2024, déjà en base (V2-J14, `lifestyle-expenses`, tableau « Repas, boisson et hébergement ») : de 7 pc (misérable) à 4 po (aristocratique). Correspondance avec la richesse du générateur : modeste → modeste (5 pa), correcte → confortable (8 pa), réputée → riche (2 po). Reste ouvert depuis V2-J14 : comparer les prix du Menu à ceux du SRD (bière 4 pc, repas modeste 1 pa).

**Ce que le PNJ vend** : les offres de ce bloc, et rien d'autre. C'est la liste fermée que l'intention de V3.2-10 reconnaît, et celle que le contexte du tour transmet au modèle (V3.2-11). L'auteur peut corriger la carte à la main : le wiki l'emporte.

**Hors de ce ticket** : l'Échoppe (même mécanisme pour un étal d'objets), à faire au deuxième cas concret.

**Livré** : bloc `price_list` (`src/core/schemas/blocks/priceList.ts`) et ses fonctions pures (`src/core/rules/priceList.ts` : lecture d'un prix « 5 pa », revente à moitié, prix d'un objet par son bloc `cost`, nuit par palier, offres du Menu, graine tirée de l'identifiant du lieu) ; tirage sans écriture (`src/server/services/priceListDraw.ts`, route `POST /api/blocks/[blockId]/price-list-draw`) ; « Créer la fiche » de l'outil Taverne écrit le bloc au lieu d'un paragraphe ; éditeur et lecture dans le wiki, planche `WikiVisuel` §carte-tarifs. Le déclenchement depuis le solo (première demande, premier achat) arrive avec V3.2-10.

**Critères d'acceptation**
- [x] Un objet du SRD a un prix d'achat et de revente sans saisie supplémentaire (`itemCostPrice`, `resaleCp`, testés ; branchés à l'achat en V3.2-10).
- [x] Une taverne sans carte en reçoit une à la demande (« Tirer la carte ») ; la redemander rend la même carte (graine de l'identifiant du lieu, testée). Le déclencheur solo vient avec V3.2-10.
- [x] La carte apparaît sur la page du lieu, modifiable. Que la correction change le prix payé se vérifiera avec V3.2-10, qui lit ce bloc.
- [x] Aucun prix n'est écrit dans le code.

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
