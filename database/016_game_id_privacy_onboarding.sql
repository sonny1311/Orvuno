-- ORVUNO game-ID onboarding: new players do not use account registration/AGB acceptance.
-- Privacy acknowledgement remains mandatory and is stored in privacy_accepted_at.

ALTER TABLE public.users
  ALTER COLUMN terms_accepted_at DROP NOT NULL;

COMMENT ON COLUMN public.users.terms_accepted_at IS
  'Timestamp of explicit AGB acceptance when that flow is used. NULL for passwordless game-ID onboarding without a separate AGB checkbox.';
