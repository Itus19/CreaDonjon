-- V3-A4 — L'etat de scene, persiste.
--
-- Trou n° 1 de l'ADR 0009 : pendant le spike de viabilite du solo, « le
-- contexte ne suit aucun deplacement de scene, les PNJ "presents" restent
-- une liste figee toute la session ». Un PNJ continuait de commenter apres
-- que le joueur avait quitte la taverne. Rien ne tenait qui est la, ni
-- quelle heure il est.
--
-- UNE TABLE, PAS UN JSONB SUR `campaigns` (recommandation du ticket V3-A4,
-- suivie) : la scene change a CHAQUE tour. La mettre sur `campaigns` en
-- ferait une table chaude, reecrite sans cesse, alors qu'elle porte le nom
-- du monde, le ruleset et les reglages — des donnees froides lues partout.
-- L'historique, lui, n'est pas ici : c'est deja le role de `session_events`,
-- et `scene.recentEvents` n'en garde que les cinq derniers identifiants.
--
-- UNE LIGNE PAR CAMPAGNE (`primary key (campaign_id)`) : c'est la scene
-- COURANTE, pas une collection. « Reprendre une partie trois semaines plus
-- tard restitue la scene exacte » ne demande rien de plus, et une cle
-- primaire dit cette unicite mieux qu'une contrainte ajoutee apres coup.

create table scene_states (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  -- Forme complete validee par `zSceneState` (src/core/rules/scene.ts) a la
  -- lecture comme a l'ecriture. Pas de colonnes eclatees : aucune requete
  -- ne filtre sur l'heure de jeu ou sur l'eclairage, et les eclater
  -- obligerait a une migration a chaque champ ajoute au moteur.
  state       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

alter table scene_states enable row level security;

-- Meme portee que le reste d'une campagne : ses membres la lisent, ses
-- administrateurs de monde l'ecrivent. Aucune regle parallele — un joueur
-- qui voit la campagne voit la scene ou se trouve son personnage.
create policy scene_states_select on scene_states
  for select using (app.is_campaign_member(campaign_id));

create policy scene_states_write on scene_states
  for all using (app.is_world_admin(app.campaign_world_id(campaign_id)))
  with check (app.is_world_admin(app.campaign_world_id(campaign_id)));

comment on table scene_states is
  'V3-A4 — scene courante d''une campagne (lieu, presents, heure, eclairage, combat). Tenue par le moteur, jamais ecrite depuis une sortie de modele sans passer par ai_proposals.';
