-- ORVUNO Google Play Billing repair.
-- This file is intentionally committed only to the repair branch and must be applied
-- to a non-production Supabase branch before any production rollout.

ALTER TABLE public.payment_purchases
  DROP CONSTRAINT IF EXISTS payment_purchases_status_check;

ALTER TABLE public.payment_purchases
  ADD CONSTRAINT payment_purchases_status_check
  CHECK (status = ANY (ARRAY[
    'submitted_for_settlement'::text,
    'settling'::text,
    'settled'::text,
    'authorized'::text,
    'paid'::text,
    'succeeded'::text,
    'purchased'::text
  ]));

CREATE OR REPLACE FUNCTION public.fulfill_google_play_purchase(
  p_user_id bigint,
  p_provider_transaction_id text,
  p_sku text,
  p_status text DEFAULT 'purchased'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_product public.store_products;
  v_balance bigint;
  v_until timestamptz;
  v_purchase_id bigint;
  v_status text := lower(coalesce(p_status,''));
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_user_id is null or p_user_id <= 0 then raise exception 'Invalid user'; end if;
  if coalesce(p_provider_transaction_id,'')='' then raise exception 'Missing transaction id'; end if;
  if coalesce(p_sku,'')='' then raise exception 'Missing sku'; end if;
  if v_status <> 'purchased' then raise exception 'Payment not eligible for fulfillment'; end if;

  select * into v_product
  from public.store_products
  where sku=p_sku and active=true
  for share;
  if not found then raise exception 'Unknown product'; end if;
  if v_product.kind not in ('coins','premium') then raise exception 'Unsupported product kind'; end if;
  if v_product.kind='coins' and coalesce(v_product.coin_amount,0)<=0 then raise exception 'Invalid coin product'; end if;
  if v_product.kind='premium' and (coalesce(v_product.premium_plan,'')='' or coalesce(v_product.duration_days,0)<=0) then
    raise exception 'Invalid premium product';
  end if;

  insert into public.payment_purchases(user_id,provider,provider_transaction_id,sku,amount_eur,currency,status)
  values(p_user_id,'google_play',p_provider_transaction_id,p_sku,v_product.price_eur,'EUR',v_status)
  on conflict(provider,provider_transaction_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    return jsonb_build_object('success',true,'duplicate',true,'provider','google_play','transactionId',p_provider_transaction_id,'sku',p_sku);
  end if;

  if v_product.kind='coins' then
    insert into public.coin_wallets(user_id,balance,updated_at)
    values(p_user_id,v_product.coin_amount,now())
    on conflict(user_id) do update
      set balance=public.coin_wallets.balance+excluded.balance,updated_at=now()
    returning balance into v_balance;

    insert into public.coin_transactions(user_id,amount,balance_after,transaction_type,reference_type,reference_id,note)
    values(p_user_id,v_product.coin_amount,v_balance,'purchase','google_play_purchase',p_provider_transaction_id,'Google-Play-Coinpaket '||p_sku);

    return jsonb_build_object('success',true,'duplicate',false,'kind','coins','coins',v_product.coin_amount,'balance',v_balance,'provider','google_play','transactionId',p_provider_transaction_id,'sku',p_sku);
  end if;

  update public.users
  set premium_plan=v_product.premium_plan,
      premium_until=(greatest(coalesce(premium_until,now()),now()) + make_interval(days=>v_product.duration_days)),
      premium_auto_renew=false
  where id=p_user_id
  returning premium_until into v_until;
  if not found then raise exception 'Premium target user disappeared'; end if;

  return jsonb_build_object('success',true,'duplicate',false,'kind','premium','plan',v_product.premium_plan,'premiumUntil',v_until,'provider','google_play','transactionId',p_provider_transaction_id,'sku',p_sku);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.fulfill_google_play_purchase(bigint,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_google_play_purchase(bigint,text,text,text) TO service_role;
