# V3.1 — Défauts vus par la session de vérification du 11 octobre

Source : compte rendu `docs/verifications/2026-10-11-fiches-banc.md` (branche `claude/verif-fiches-banc`). Les fiches des PJ du Banc d'essai ont été remplies par l'assistant de création (Humaine Guerrière 1 Soldat ; Nain Clerc 1 Acolyte), puis les deux PJ sont entrés dans un combat.

Déjà couverts ailleurs, donc pas de ticket ici :
- Style de combat (Guerrier 1), Ordre divin (Clerc 1) et choix de taille de l'espèce absents de l'assistant : **V3.1-118**.
- Aucune vue joueur du combat (Testeur B ne peut pas suivre le tour) : **V3.1-102**.

---

### ☐ V3.1-121 — Ténacité naine ignorée dans les PV max · `S` — **à diagnostiquer (Opus)**

**Modèle conseillé : Opus** — calcul de la fiche (`characterSheet()`, noyau).

Nain Clerc 1, CON 14 : PV max 10 au lieu de 11. Les sources de PV renvoyées par `GET /api/entities/[id]/sheet` ne listent que « Dés de vie (1d8) » 8 et « Constitution » 2 ; le trait est affiché à l'étape Espèce mais ne produit aucun modificateur.

**Critères d'acceptation**
- [ ] Test d'abord (noyau) : un Nain niveau 1 gagne +1 PV max, puis +1 par niveau.
- [ ] La fiche du PJ de Testeur B affiche 11 PV max, avec la source « Ténacité naine ».

---

### ☐ V3.1-122 — Initiative : PV d'une saisie libre, liste des combats · `S` — **prêt (Sonnet)**

**Modèle conseillé : Sonnet.**

1. Le formulaire de saisie libre ne demande que le nom, et la ligne PV d'un participant n'apparaît que si ses PV max sont renseignés : impossible de donner des PV à un adversaire saisi à la main. Le formulaire demande aussi CA et PV max (facultatifs).
2. « Mes combats » affiche « Pas engagé » pour un combat commencé puis terminé, alors que l'en-tête suit : la liste se rafraîchit après « Go », « Stop » et la suppression.

**Critères d'acceptation**
- [ ] Un Gobelin saisi avec CA 15 et PV 7 les affiche et se modifie comme un PJ.
- [ ] La liste suit l'état du combat sans recharger la page.

---

### ☐ V3.1-123 — Fiche jouable : l'état transitoire après l'enregistrement · `S` — **à diagnostiquer (Sonnet)**

**Modèle conseillé : Sonnet.**

Juste après « Enregistrer le personnage », la fiche jouable affiche quelques secondes CA 11, PV 0/0, dés de vie vides, « Aucune arme équipée », puis se corrige seule (données enregistrées justes). Pendant le chargement, l'inventaire montre les clés techniques (`chain-mail`, `greatsword`). Afficher l'état de chargement de la charte (`docs/CHARTE-UI.md`) tant que la fiche calculée n'est pas arrivée, jamais des valeurs fausses.

**Critères d'acceptation**
- [ ] Aucune valeur provisoire fausse ni clé technique visible après l'enregistrement ou au chargement.

---

### ☐ V3.1-124 — Assistant, étape Compétences : doublons et maîtrises d'outil · `S` — **à diagnostiquer (Sonnet)**

**Modèle conseillé : Sonnet.**

- « Lance » apparaît deux fois dans les maîtrises d'arme (Guerrier).
- « Déjà acquis » affiche en anglais « Tool: Calligrapher's Supplies » (Acolyte) : libellé français attendu.
- La maîtrise d'outil du Soldat (boîte de jeux) n'apparaît pas dans « Déjà acquis ».

**Critères d'acceptation**
- [ ] Chaque maîtrise une seule fois, en français, y compris celles d'outil venues de l'historique.

---

### ☐ V3.1-125 — Données et affichages de règles · `S` — **à diagnostiquer (Sonnet ; Haiku pour le recensement)**

**Modèle conseillé : Sonnet.** Sous-tâches Haiku : recenser les affichages de distance non formatés en français.

- Humain : le trait « Polyvalente » (propriété d'arme) figure parmi ses traits, confusion probable de référence avec « Polyvalent ».
- Masse d'armes : 0,9 kg affiché ; le SRD donne 4 lb, soit environ 1,8 kg.
- Vitesses affichées « 9.1 m » : nombre au format français, et arrondi à 9 m (convention des livres français).
- Sources de CA de la fiche : clés techniques (`chain-shirt`, `shield`) au lieu des noms.

**Critères d'acceptation**
- [ ] Les quatre points corrigés ; une donnée SRD fausse se corrige à l'import (`ingest-srd`), jamais à la main en base.

---

**Question à l'auteur (pas de ticket tant qu'elle n'est pas tranchée).** Le Guerrier est « Encombré (vitesse −3 m) » avec 75 kg pour FOR 17 : c'est la règle d'encombrement variante. Voulue par défaut, ou à rendre optionnelle (réglage de table) ?
