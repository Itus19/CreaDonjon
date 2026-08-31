-- V2-M11 (Lot M) : volet de lancer de dés — visibilite par jet ("le MJ peut
-- cacher un jet") et temps reel (retour utilisateur, jamais utilise dans ce
-- projet jusqu'ici).
--
-- `dice_rolls_select` laissait jusqu'ici n'importe quel membre de la
-- campagne lire TOUS les jets, y compris ceux qu'un futur "jet secret" du MJ
-- devrait cacher aux joueurs — resserre donc la lecture en meme temps que la
-- colonne est ajoutee, jamais l'un sans l'autre. `dice_rolls_write` accepte
-- toujours l'ecriture par un simple membre (un joueur enregistre ses propres
-- jets), mais refuse desormais qu'un non-MJ marque une ligne `gm`.

alter table dice_rolls
  add column visibility_level text not null default 'public'
    check (visibility_level in ('public', 'gm'));

comment on column dice_rolls.visibility_level is '''public'' visible a tout membre de la campagne, ''gm'' visible au seul MJ (proprietaire/editeur du monde ou MJ humain) — jamais un joueur, meme l''auteur du jet.';

drop policy dice_rolls_select on dice_rolls;
create policy dice_rolls_select on dice_rolls for select
  using (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and (visibility_level = 'public' or app.is_world_admin(app.campaign_world_id(campaign_id)))
  );

drop policy dice_rolls_write on dice_rolls;
create policy dice_rolls_write on dice_rolls for all
  using (app.is_world_member(app.campaign_world_id(campaign_id)))
  with check (
    app.is_world_member(app.campaign_world_id(campaign_id))
    and (visibility_level = 'public' or app.is_world_admin(app.campaign_world_id(campaign_id)))
  );

-- Temps reel (retour utilisateur : "un jet doit apparaitre en direct chez
-- les autres joueurs"). La RLS ci-dessus s'applique deja aux changements
-- diffuses par Postgres Changes (verifie par le fournisseur) : un jet `gm`
-- ne sera jamais pousse vers un abonnement ouvert par un simple joueur,
-- meme mecanisme que pour une lecture REST classique.
alter publication supabase_realtime add table dice_rolls;
