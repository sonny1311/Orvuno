-- Server-side Coin time reduction for all beneficial timed operations.
-- Rule: 1 Coin per started hour, max. 10 hours per purchase.
-- Deployed to the legacy Orvuno Supabase project as migration secure_coin_time_reduction.

-- The canonical function is already deployed in Supabase. This repository migration
-- is intentionally kept as a deployment marker; future schema exports should retain
-- public.shorten_company_timed_action(bigint,text,text,integer).
