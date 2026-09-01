-- Retour utilisateur (1 sept.) : "l'application est parfois lente... dans
-- les jetés de dés" — `dice_rolls` n'a jamais eu d'index sur
-- (campaign_id, created_at), contrairement a chaque autre table journalisee
-- par campagne (campaign_encounters, session_events, campaign_chat_messages,
-- ai_usage_log). Chaque ouverture du volet de jets (`listDiceRollsForCampaign`,
-- filtre + tri sur ces deux colonnes) forcait donc un parcours sequentiel
-- complet de la table, de plus en plus couteux a mesure qu'une campagne
-- accumule des jets.

create index dice_rolls_campaign_created_idx on dice_rolls (campaign_id, created_at desc);
