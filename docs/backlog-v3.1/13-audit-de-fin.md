# V3.1 — L'audit de fin : les retouches relevées en chemin

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md). Un seul ticket, qui grossit
au fil des tickets : chaque défaut d'affichage ou petite gêne relevé en
vérifiant un ticket, et qu'aucun ticket prévu ne couvre, s'ajoute ici (avec
sa date et le ticket où il a été vu) au lieu de rester dans une note
« Restes » de `termines.md`. Il se traite **à la fin de V3.1**, en une passe :
une seule session de vérification au navigateur, des retouches cohérentes
entre elles. Un défaut qu'un ticket à venir touche de toute façon va dans ce
ticket-là, pas ici.

### ☐ V3.1-144 — Audit de fin de V3.1 : les retouches d'affichage · `M` · sans modèle IA — **à faire en dernier**

**Modèle conseillé : Sonnet** pour les retouches, une fois la liste triée par
Opus ; vérification au navigateur par Opus.

**Relevé le 24 octobre**
- *V3.1-38, Initiative du MJ au téléphone* : les noms des participants sont
  très tronqués (« Mons… ») — les colonnes CA/PV prennent la place.
- *V3.1-38, joueuse* : après le jet d'initiative, le volet de dés s'ouvre
  par-dessus la fiche, alors que l'invitation a déjà montré le résultat.
- *V3.1-38* : le bleu des PV temporaires est une constante locale
  (`oklch(0.72 0.13 235)`), à promouvoir en jeton de la charte (§ jetons).
- *V3.1-57, Règles actives* : « Variantes et import » ne s'ouvre de force
  dès `@md` que sur les navigateurs qui connaissent `::details-content`
  (Chromium 131+, Firefox 143+) ; ailleurs il reste replié.
- *V3.1-60, Publication* : supprimer, depuis la galerie, l'image
  personnelle qui est le fond du wiki fait basculer le wiki sur « Artwork C »
  sans le dire ; un enregistrement de fond qui échoue laisse l'aperçu sur le
  choix non enregistré (le message d'erreur s'affiche).
- *V3.1-42, Cahier* : une page partagée, ou qui l'a été, ne se supprime pas
  depuis le cahier (aucune route ne retire l'entité `shared_note`).

- *V3.1-106, création d'un combat* : `POST …/combats` accepte une clé de
  monstre inconnue du ruleset (« goblin » dans un monde 2024) et crée un
  participant sans CA, sans PV ni actions, au lieu de refuser ; l'écran ne
  propose que des monstres valides, mais la route devrait dire non.

- *V3.1-112, sauvegardes* : supprimer ou terminer un combat laisse ses
  sauvegardes en attente (`combat_id` remis à nul) ; la joueuse peut encore
  y répondre, le MJ non (« Cible introuvable »). La fin d'un combat devrait
  les annuler.
- *V3.1-112, historique des jets* : le jet de dégâts d'un sort s'intitule
  par la clé (« Sort — sacred-flame ») au lieu du nom traduit ; même chose
  dans le fait d'une attaque de sort ciblée (`targetedRoll`, branche
  `spell_attack`).

**À rejouer en direct pendant l'audit** (codé, relu, jamais vu à l'écran) :
la fin de combat confirmée (« Terminer » / « Continuer ») et la liste des
combats qui suit l'état sans recharger (V3.1-38) ; les dés doublés au
critique d'un jet ciblé (un 20 naturel).

**Critères d'acceptation**
- [ ] Chaque point ci-dessus est corrigé, ou écarté avec sa raison.
- [ ] Vérifié au navigateur, ordinateur et 390 px.
