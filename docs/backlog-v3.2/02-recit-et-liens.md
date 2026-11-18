# V3.2 — Le récit : sa personne, ses liens

*Partie du backlog V3.2. L'index et la feuille de route : [`docs/BACKLOG_V3.2.md`](../BACKLOG_V3.2.md).*

---

### ☐ V3.2-5 — Le récit s'adresse au joueur : tu, ou vous · `S` · **avec modèle IA** — **prêt (Opus)**

**Constaté le 18 novembre** : « Itus Flo se dirige résolument vers le comptoir », « Thora ouvre la porte ». Le modèle raconte le personnage **à la troisième personne**, comme un roman lu par-dessus l'épaule. L'auteur veut qu'on s'adresse à lui : « tu pousses la porte », ou « vous poussez la porte » — **au choix, dans les réglages de la partie**.

**Où ça se joue.** La consigne système de `src/server/ai/soloNarration.ts` dit aujourd'hui « raconter ce tour en deux à quatre phrases » sans fixer la personne ; le modèle choisit la troisième par habitude de corpus. Il faut l'imposer, et la rappeler dans le contexte du tour (`buildSoloTurnContext`), parce qu'un modèle local oublie vite une consigne lointaine.

**Un réglage de la partie**, pas une constante : `campaigns.table_settings` porte déjà des réglages de campagne (une colonne `jsonb`, aucune migration). Trois valeurs : `tu` (défaut), `vous`, `il` (le récit d'aujourd'hui, pour qui l'aime). Le réglage voyage jusqu'à la consigne, et nulle part ailleurs : le moteur n'en sait rien.

**Attention aux PNJ** : seul le personnage du joueur change de personne. Les autres restent à la troisième — « tu pousses la porte, Mabelle lève les yeux ».

**Critères d'acceptation**
- [ ] Le réglage existe dans les paramètres de la partie, et son défaut est « tu ».
- [ ] Trois tours d'affilée gardent la personne choisie (vérifié avec le fournisseur local).
- [ ] Les PNJ restent à la troisième personne.
- [ ] `ai_usage_log` inchangé ; aucun appel de plus.

---

### ☐ V3.2-6 — Les fiches citées par le récit deviennent des liens · `L` · **avec modèle IA** — **à concevoir (Opus, ADR)**

**Demandé le 18 novembre** : « dans le texte de l'IA, les liens se font automatiquement vers les fiches wiki, à l'image du wiki ». Avec cette réserve, que l'auteur pose lui-même : « si c'est automatique il faudrait vraiment renforcer la méthode de lien pour la rendre la plus efficace possible ».

**C'est le ticket le plus risqué des huit, et la réserve est la bonne question.** Trois manières de lier, trois pièges :

1. **Le modèle pose les liens.** Refusé en l'état : il invente des identifiants, et une référence inventée est exactement ce que la chaîne `ai_proposals` existe pour arrêter (règle absolue 9). S'il devait le faire, ce serait en ne citant **que** des identifiants fournis dans son contexte — ce que le prompt lui impose déjà pour les PNJ — et toute référence hors liste serait retirée du texte avant affichage.
2. **Le serveur lie après coup, par correspondance de noms.** Le plus sûr, et le plus bête : un index des noms et alias connus du monde, appliqué au texte rendu. Pièges réels : les homonymes, les noms courants (« la Halte », « le Fanal »), les déclinaisons et élisions (« du Fanal », « l'Ourse »), et **l'audience** — lier vers une fiche que le joueur n'a pas découverte la lui révèle (règle absolue 5, et c'est précisément ce que `listPlayerVisibleEntityIds` protège ailleurs).
3. **Rien d'automatique** : le fil ne lie que ce que le moteur a réellement posé (les présents de la scène, la cible d'une attaque, l'esquisse ancrée). Moins riche, zéro faux lien.

**Ce que l'ADR doit trancher** : laquelle des trois, ou laquelle en premier ; comment un lien respecte la découverte (jamais de lien vers l'inconnu, jamais d'infobulle qui en dit trop) ; ce qu'on fait d'un nom ambigu (ne pas lier plutôt que mal lier) ; et si le texte stocké garde ses liens ou si la liaison se refait à l'affichage — ce dernier point décide de tout le reste, puisqu'un texte figé avec ses liens vieillit mal quand les fiches changent.

**Avis** : commencer par le 3, qui est gratuit et sans faux positif, et ne passer au 2 qu'avec un index de noms construit depuis les **entités visibles du joueur**, pas depuis le monde entier.

**Critères d'acceptation (de la conception)**
- [ ] ADR écrit : méthode retenue, audience, ambiguïté, texte stocké ou lié à l'affichage.
- [ ] Tickets prêts découpés et ajoutés à l'index.
