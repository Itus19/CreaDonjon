# V3.2 — La narration qui fait avancer l'histoire

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

**Constaté le 25 novembre**, à l'auberge du Gué-aux-Corbeaux. La personne qui joue propose ses services à Mabelle, accepte trois heures de plonge contre une nuit, puis écrit « Ok alors je fais ces trois heures de travail ». Le récit répond : « Tu acceptes d'accomplir ces trois heures de travail… Le Sergent Ourse et Petit Wil demeurent immobiles à portée », suivi d'une réplique de Mabelle. L'horloge reste à 19:54. Attendu : passer en cuisine, la voir décrite, et vivre trois heures de vaisselle racontées en accéléré, avec des détails.

Quatre défauts, trois tickets : la consigne (V3.2-17), l'horloge (V3.2-18), le déplacement (V3.2-19). Décisions de l'auteur du 25 novembre : tout faire, et une pièce qui n'existe pas encore (la cuisine) devient une **esquisse de pièce**, ancrée dans un **bloc typé « pièces » de la page du lieu**, jamais dans une page à part.

---

### ☐ V3.2-17 — Une consigne de MJ, et le contexte pour la suivre · `M` · **avec modèle IA** — **en cours (Opus)**

**Pourquoi c'était plat.** La consigne demandait « deux à quatre phrases qui intègrent les faits ». Pour une action libre, le seul fait est le texte du joueur : le modèle le reformulait. Trois endroits poussaient le PNJ à répondre à chaque tour (consigne, description du champ `npc_reaction`, second essai dès qu'un PNJ était nommé). Les présents étaient listés sans rien dire de quand les citer. Et le contexte ne donnait que le **nom** du lieu.

**Ce qui change**
- La consigne système (`src/server/ai/soloNarration.ts`) : un but (chaque tour change quelque chose), un rythme (bref pour un échange, accéléré en un à deux paragraphes pour une activité longue, descriptif pour un lieu nouveau), un PNJ ne parle que si sa parole apporte quelque chose, jamais de présents « immobiles ».
- `narration` passe de 1 000 à 1 800 caractères.
- Le second essai « le PNJ doit répondre » ne part plus que sur une **question directe** (`estQuestionDirecte` : point d'interrogation ou verbe qui demande). Sans question, la consigne du tour laisse le PNJ se taire.
- Le contexte gagne la description du lieu (premier paragraphe visible de sa page, filtré pour le joueur, encadré), la météo tirée, et les trois dernières actions du joueur.

**Ce que ça consomme** : une lecture de plus par tour narré (les blocs `text` du lieu). Les actions passées viennent de la même requête que les narrations récentes.

**Critères d'acceptation**
- [x] Tests du noyau : question directe, premier paragraphe, contexte (description encadrée, météo, actions hors balise, consigne PNJ selon la question).
- [ ] Rejoué avec le fournisseur local sur la scène du Fanal : moins de répliques non demandées, plus de présents « immobiles », un lieu décrit.

---

### ☐ V3.2-18 — L'horloge suit l'histoire · `M` · sans modèle IA pour le cœur — **en cours (Opus, [ADR 0112](../adr/0112-l-horloge-suit-l-histoire.md))**

**Constat.** Une action libre vaut une minute, codée en dur (`minutesForTurn`, `turnLoop.ts`) ; l'IA n'a aucun moyen d'annoncer une ellipse ; et l'en-tête de l'écran solo, rendu par la page serveur, ne se recharge pas après un tour.

**Ce qui est prévu**
1. Durée explicite dans le texte du joueur (« trois heures », « 2 h », « une demi-heure », « jusqu'au matin ») lue par un lexique fermé du noyau ; l'horloge avance **avant** la narration, et le fait « Trois heures passent. Il est maintenant 22h54. » part dans le contexte.
2. Sinon l'IA propose `elapsed` dans une liste fermée (instant, quelques minutes, un quart d'heure, une demi-heure, une heure, plusieurs heures de 2 à 8, jusqu'au lendemain matin). Le moteur refuse toute ellipse en combat, plafonne à 8 heures, et l'applique après la narration.
3. Le temps de parole : au moins 2 minutes, plus 1 par tranche de 100 mots échangés.
4. L'en-tête se rafraîchit après chaque tour.
5. ADR : le moteur accepte une durée proposée par l'IA dans une liste fermée.

**Ce que ça consomme** : une lecture de la scène après chaque narration, et une écriture seulement si l'horloge bouge. Aucun chargement de plus à l'écran : l'heure revient dans la réponse du tour.

**Critères d'acceptation**
- [x] Tests du noyau : durées écrites (lettres, chiffres, fractions, matin), heure du jour ignorée, bornes de la proposition, temps de parole, phrase de durée, `elapsed` fermé dans le schéma.
- [ ] Rejoué : « je fais ces trois heures de travail » à 19:54 affiche 22:54 sans recharger la page.

---

### ☐ V3.2-19 — L'IA t'emmène ailleurs : lieux et pièces · `M` · **avec modèle IA** — **codé (Opus)**, reste la vérification en jeu

**Ce qui est prévu**
1. `move_to` vers un lieu du wiki rattaché au lieu actuel et connu du joueur (liste fermée) ; le moteur change le lieu de la scène, comme le panneau de scène.
2. Une pièce qui n'existe pas encore (« la cuisine ») : esquisse de pièce dans l'état de scène, comme les esquisses de PNJ. Elle rejoint le **bloc typé `rooms`** de la page du lieu (nom, deux ou trois phrases, visibilité par pièce) quand on y revient ou qu'on la nomme. Pas de page à part, pas de migration (le type de bloc est un texte validé par Zod).
3. Le contexte d'un tour dans une pièce porte la description de la pièce, tirée du bloc.

**Point 1, livré** : `lieuxVoisins` (`src/core/rules/moveTargets.ts`) donne les lieux reliés par `part_of` (contenus, contenant, voisins du même parent) ; seuls ceux dont un bloc est visible du joueur entrent dans le contexte (`lieux-accessibles`) et dans l'enum de `move_to`. Après la narration, `moveSceneAfterNarration` appelle `setScene` avec le personnage joué et les PNJ réels qui suivent (`with`). La réponse du tour porte la nouvelle scène ; l'écran la pose et se rafraîchit par le même chemin que le panneau de scène (aucun `router.refresh()` de plus).

**Ce que ça consomme** : trois lectures de plus par tour narré (arêtes `part_of`, visibilité des blocs voisins, leurs noms) ; un déplacement coûte ce que coûte `setScene` depuis le panneau, plus la relecture de la scène pour l'écran.

**Points 2 et 3, livrés** (choix de l'auteur du 25 novembre : une pièce inventée entre seule dans la page du lieu, après le contrôle du moteur)
- Bloc `rooms` « Pièces » (`src/core/schemas/blocks/rooms.ts`) : nom et description par pièce. Une pièce secrète va dans un second bloc réservé au MJ, filtré comme tout bloc.
- La narration propose `enter_room` (nom, et description pour une pièce nouvelle) ou `leave_room`. `deciderPiece` (noyau pur) tranche : pièce du wiki, esquisse déjà vue (une visite de plus), ou pièce nouvelle si `validerNouvellePiece` l'accepte (nom court, sans chiffre ni balise, ni le nom du lieu ni d'un lieu voisin).
- À la seconde visite, ou dès que le joueur la nomme, l'esquisse s'ajoute au premier bloc « Pièces » visible de la page du lieu (ou à un bloc créé, visible des joueurs), par `updateBlockContent` / `createBlockWithData` et leurs barrières habituelles, avec une ligne `ai_proposals` déjà appliquée. Sans droit d'écriture sur la page, la pièce reste une esquisse.
- Le contexte du tour porte la pièce actuelle et les pièces du lieu ; le bandeau affiche la pièce après le lieu.

**Limites connues** : annuler le tour restaure la scène, mais une pièce déjà écrite dans le wiki y reste (elle se retire à la main) ; changer de lieu laisse les esquisses de pièces derrière.

**Critères d'acceptation**
- [x] Tests du noyau : voisins `part_of`, reconnaissance et contrôle d'une pièce, décision (wiki, esquisse, seconde visite, nommée, refus), schéma `move_to` / `enter_room`.
- [ ] Rejoué : « je la suis » mène en cuisine, le bandeau affiche « La cuisine » ; y revenir l'ajoute au bloc « Pièces » de l'auberge.


---

### ☑ V3.2-26 — Dormir dans le récit fait un repos long · `S` · sans modèle IA — **codé (Opus)**, reste la vérification en jeu

**Constaté le 25 novembre** : le personnage dort jusqu'à l'aube, aucun repos long n'est validé. Seul le bouton « Repos long » de la fiche l'appliquait ; un saut de temps du récit avançait l'horloge sans rien d'autre.

**Décidé par l'auteur le 26 novembre** : le moteur l'applique seul. Le sommeil vient du texte du joueur (« je dors », « je me couche », « repos long »), jamais de la narration (ADR 0112, amendement). `sommeilDemande` et `decideLongRest` (`src/core/rules/sleepRest.ts`, purs) : sans durée écrite, dormir vaut 8 h ; moins de 8 h, le temps passe sans repos ; jamais en combat ; 16 h après la fin du précédent (`scene.lastLongRestEnd`, sans changer `__v`). `turnLoop.ts` avance l'horloge, puis appelle `takeLongRest` (le même que la fiche) avec `advanceClock: false`. La phrase « Repos long : … » part dans les changements du tour.

**Critères d'acceptation**
- [x] Tests du noyau : tournures reconnues, négations et paroles ignorées, 8 h, 16 h, combat.
- [ ] Rejoué : « je vais me coucher » le soir, l'horloge passe au matin, PV et emplacements reviennent ; un second « je dors » deux heures plus tard ne rend rien.

### ☑ V3.2-27 — La ligne du tour, les notes du monde d'office, le temps du combat · `M` · sans modèle IA — **codé (Opus, [ADR 0114](../adr/0114-notes-du-monde-d-office-et-ligne-du-tour.md))**, reste la vérification en jeu

**Constaté le 25 novembre** : le bandeau « Changements dans le monde » compte toute la séance ; on ne sait pas ce que ce tour a changé. Chaque note de l'IA attend un clic. L'heure ne se lit que dans l'en-tête, et un tour de combat ne dit pas qu'il dure 6 secondes.

**Décidé par l'auteur le 26 novembre**, sur esquisses : l'option A (une ligne par tour, le reste dans un onglet du Monde), l'heure à chaque tour, le temps du combat selon les règles 2024, et les notes acceptées par défaut, corrigeables après coup.

- `summarizeTurns` (`src/core/rules/turnSummary.ts`, pur) relit le journal : l'heure de chaque tour vient des relevés `undo_before.scene`, celle du dernier de la scène actuelle (lue par `/fil`). Les lignes `rule_application` et `world_update` d'un tour passent dans sa ligne (`withTurnSummaries`, `turnFil.ts`).
- `proposeWorldNote` ajoute le paragraphe d'office (identifiant = celui de la proposition), écrit une ligne `world_update` ; repli en attente si l'écriture échoue. `correctAppliedNote` et `removeAppliedNote` (`aiProposals.ts`), routes `POST /api/ai-proposals/[id]/correct` et `/remove`. L'annulation du tour retire le paragraphe.
- Onglet « Changements » (`OngletChangements.tsx`) dans la colonne Monde et la feuille du bas du téléphone ; le bandeau `ConsequencesDrawer` disparaît, « Annuler ce tour » (`AnnulerTour.tsx`) s'accroche au dernier tour du fil.
- `endCombat` avance l'horloge de `minutesDeCombat(round)` (6 s par round) et oublie `activeCombatId`.

**Critères d'acceptation**
- [x] Tests du noyau : heure par tour, dernier tour fermé par l'heure de la scène, combat, phrase de durée non répétée, 6 s par round.
- [x] Tests de câblage : note ajoutée d'office (identifiant partagé, ligne du tour), repli en attente.
- [ ] Rejoué : « je vais me coucher » montre « +8 h · 06:08, jour 2 » et la puce du repos ; une note de l'IA apparaît dans le wiki, se corrige et se retire depuis l'onglet ; « Annuler ce tour » la retire aussi.
- [ ] Rejoué : un combat de 12 rounds terminé fait avancer l'horloge de 2 minutes.

### ☑ V3.2-28 — Les présents suivent la pièce · `S` · sans modèle IA — **codé (Opus)**, reste la vérification en jeu

**Constaté le 26 novembre** : entrer dans sa chambre de l'auberge laissait le volet Monde inchangé, et l'IA recevait toujours l'aubergiste et les clients du hall comme « présents ». Les présents étaient une seule liste pour tout le lieu ; la pièce (V3.2-19) ne changeait que le bandeau.

- Chaque présent et chaque esquisse garde sa pièce (`room` : un nom, `null` pour l'espace principal, absente pour « suit le personnage », état des scènes écrites avant). Champ facultatif de l'état de scène, sans changer `__v`. Module pur `src/core/rules/scenePresence.ts`.
- Changer de pièce (`applyRoomAfterNarration`) emmène le personnage et ceux que la narration nomme dans `room_with` ; les autres restent où ils sont. Une personne ou une esquisse qui entre arrive dans la pièce du personnage. Changer de lieu oublie les pièces.
- Le volet Monde, le panneau de scène, les cibles d'une action et les déclencheurs ne voient que la pièce du personnage. Le panneau dit « qui est avec moi » : il ne fait pas sortir ceux d'une autre pièce, et nommer l'un d'eux le fait venir.
- L'IA reçoit les présents de la pièce, puis ceux d'ailleurs dans le lieu dans une balise à part (`ailleurs-dans-le-lieu`), avec la consigne de ne pas les faire agir à côté du personnage ; seul, la consigne de n'y faire apparaître personne.

**Critères d'acceptation**
- [x] Tests du noyau : entrer seul, entrer accompagné (esquisses comprises), ressortir, arrivée dans la pièce, changement de lieu, contexte de l'IA.
- [x] Tests de câblage : le panneau ne fait pas sortir l'absent d'une autre pièce, le fait venir quand on le nomme.
- [ ] Rejoué : entrer dans sa chambre vide le volet Monde ; en ressortir rend le hall.

### ☑ V3.2-41 — Les PNJ restent dans leur rôle, les prix se disent, la pluie reste dehors · `S` · sans modèle IA pour le cœur — **codé (Opus)**, reste la vérification en jeu

**Constaté le 26 novembre** (au Fanal, Gué-aux-Corbeaux) : Petit Wil, qui n'est pas employé, propose de servir la soupe ; à « c'est combien ? », Mabelle répond « l'ardoise dit le prix » sans prix ; en regardant l'ardoise, les prix sont « illisibles, le charbon a dégouliné sous la pluie », alors qu'on est dans la salle.

**Causes** : le modèle ne recevait des PNJ réels que leur nom, leur attitude et leurs pronoms, jamais qui ils sont ; il devinait. La consigne sur l'argent disait « cite seulement les prix de la carte et de l'ardoise » même quand le lieu n'a pas de carte, et « ardoise » désignait la dette du personnage : la seule issue était d'esquiver. La météo arrivait sur la ligne du lieu sans dire qu'elle est celle du dehors.

**Ce qui change** (`src/core/ai/turnContext.ts`, `src/server/services/turnContext.ts`) :
- chaque PNJ réel présent porte le premier paragraphe de sa page que la personne qui joue peut lire (240 caractères au plus), dans la balise `pnjs-presents` ; une consigne dit que seul le personnel du lieu sert, et qu'un PNJ sans description n'est pas du personnel ;
- avec une carte, le PNJ dit le prix à voix haute, sans renvoyer à un tableau ; sans carte, une autre consigne : aucun prix cité ni affiché, ni illisible ; la dette devient `dettes-du-personnage` ;
- la météo devient « dehors : … », avec la consigne qu'à l'intérieur elle ne se perçoit que par les fenêtres, le toit ou la porte.

Coût : une lecture groupée de plus par tour narré (les blocs `text` des présents).

**Critères d'acceptation**
- [x] Tests du noyau : description dans la balise, consigne de rôle, deux consignes d'argent, météo du dehors.
- [ ] Rejoué : au Fanal, Petit Wil ne sert plus ; « c'est combien ? » donne un prix de la carte (ou, sans carte, aucun prix inventé) ; la pluie ne touche plus l'ardoise de la salle.

