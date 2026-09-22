-- ORVUNO Hetzner payment fulfillment functions.
-- Local PostgreSQL version of the former Supabase RPC fulfillment layer.

create or replace function public.fulfill_amazon_purchase(
  p_user_id bigint,
  p_receipt_id text,
  p_sku text,
  p_status text default 'paid'
) returns jsonb
language plpgsql
security invoker
as $function$
declare
  v_product public.store_products;
  v_balance bigint;
  v_until timestamptz;
  v_purchase_id bigint;
begin
  if p_user_id is null or p_user_id<=0 then raise exception 'Invalid user'; end if;
  if coalesce(p_receipt_id,'')='' then raise exception 'Missing receipt id'; end if;
  if coalesce(p_sku,'')='' then raise exception 'Missing sku'; end if;

  select * into v_product
  from public.store_products
  where sku=p_sku and active=true
  for share;
  if not found then raise exception 'Unknown product'; end if;
  if v_product.kind not in ('coins','premium') then raise exception 'Unsupported product kind'; end if;

  insert into public.payment_purchases(user_id,provider,provider_transaction_id,sku,amount_eur,currency,status)
  values(p_user_id,'amazon',p_receipt_id,p_sku,v_product.price_eur,'EUR',coalesce(nullif(p_status,''),'paid'))
  on conflict(provider,provider_transaction_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    return jsonb_build_object('success',true,'duplicate',true,'provider','amazon','receiptId',p_receipt_id,'sku',p_sku);
  end if;

  if v_product.kind='coins' then
    insert into public.coin_wallets(user_id,balance,updated_at)
    values(p_user_id,v_product.coin_amount,now())
    on conflict(user_id) do update
      set balance=public.coin_wallets.balance+excluded.balance,updated_at=now()
    returning balance into v_balance;

    insert into public.coin_transactions(user_id,amount,balance_after,transaction_type,reference_type,reference_id,note)
    values(p_user_id,v_product.coin_amount,v_balance,'purchase','amazon_receipt',p_receipt_id,'Amazon-IAP-Coinpaket '||p_sku);

    return jsonb_build_object('success',true,'kind','coins','coins',v_product.coin_amount,'balance',v_balance,'provider','amazon','receiptId',p_receipt_id,'sku',p_sku);
  end if;

  update public.users
  set premium_plan=v_product.premium_plan,
      premium_until=(greatest(coalesce(premium_until,now()),now()) + make_interval(days=>v_product.duration_days)),
      premium_auto_renew=false
  where id=p_user_id
  returning premium_until into v_until;

  return jsonb_build_object('success',true,'kind','premium','plan',v_product.premium_plan,'premiumUntil',v_until,'provider','amazon','receiptId',p_receipt_id,'sku',p_sku);
end;
$function$;

create or replace function public.fulfill_braintree_purchase(
  p_user_id bigint,
  p_provider_transaction_id text,
  p_sku text,
  p_amount_eur numeric,
  p_currency text,
  p_status text
) returns jsonb
language plpgsql
security invoker
as $function$
declare
  v_product public.store_products;
  v_balance bigint;
  v_until timestamptz;
  v_purchase_id bigint;
begin
  if coalesce(p_provider_transaction_id,'')='' then raise exception 'Missing transaction id'; end if;
  if p_currency <> 'EUR' then raise exception 'Invalid currency'; end if;
  if p_status not in ('submitted_for_settlement','settling','settled') then raise exception 'Payment not eligible for fulfillment'; end if;

  select * into v_product
  from public.store_products
  where sku=p_sku and active=true
  for share;
  if not found then raise exception 'Unknown product'; end if;
  if round(p_amount_eur,2) <> v_product.price_eur then raise exception 'Amount mismatch'; end if;

  insert into public.payment_purchases(user_id,provider,provider_transaction_id,sku,amount_eur,currency,status)
  values(p_user_id,'braintree',p_provider_transaction_id,p_sku,round(p_amount_eur,2),p_currency,p_status)
  on conflict(provider,provider_transaction_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    return jsonb_build_object('success',true,'duplicate',true,'transactionId',p_provider_transaction_id);
  end if;

  if v_product.kind='coins' then
    insert into public.coin_wallets(user_id,balance,updated_at)
    values(p_user_id,v_product.coin_amount,now())
    on conflict(user_id) do update
      set balance=public.coin_wallets.balance+excluded.balance,updated_at=now()
    returning balance into v_balance;

    insert into public.coin_transactions(user_id,amount,balance_after,transaction_type,reference_type,reference_id,note)
    values(p_user_id,v_product.coin_amount,v_balance,'purchase','braintree_transaction',p_provider_transaction_id,'Echtgeld-Coinpaket '||p_sku);

    return jsonb_build_object('success',true,'kind','coins','coins',v_product.coin_amount,'balance',v_balance,'transactionId',p_provider_transaction_id);
  end if;

  update public.users
  set premium_plan=v_product.premium_plan,
      premium_until=(greatest(coalesce(premium_until,now()),now()) + make_interval(days=>v_product.duration_days)),
      premium_auto_renew=false
  where id=p_user_id
  returning premium_until into v_until;

  return jsonb_build_object('success',true,'kind','premium','plan',v_product.premium_plan,'premiumUntil',v_until,'transactionId',p_provider_transaction_id);
end;
$function$;

create or replace function public.fulfill_google_play_purchase(
  p_user_id bigint,
  p_provider_transaction_id text,
  p_sku text,
  p_status text default 'purchased'
) returns jsonb
language plpgsql
security invoker
as $function$
declare
  v_product public.store_products;
  v_balance bigint;
  v_until timestamptz;
  v_purchase_id bigint;
  v_status text := lower(coalesce(p_status,''));
begin
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

create or replace function public.fulfill_stripe_checkout_intent(
  p_user_id bigint,
  p_provider_session_id text,
  p_provider_transaction_id text,
  p_amount_eur numeric,
  p_currency text,
  p_status text
) returns jsonb
language plpgsql
security invoker
as $function$
declare
  v_intent public.payment_checkout_intents;
  v_balance bigint;
  v_until timestamptz;
  v_purchase_id bigint;
  v_status text := lower(coalesce(p_status,''));
begin
  if p_user_id is null or p_user_id <= 0 then raise exception 'Invalid user'; end if;
  if coalesce(p_provider_session_id,'')='' then raise exception 'Missing checkout session id'; end if;
  if coalesce(p_provider_transaction_id,'')='' then raise exception 'Missing transaction id'; end if;
  if upper(coalesce(p_currency,'')) <> 'EUR' then raise exception 'Invalid currency'; end if;
  if v_status not in ('paid','succeeded') then raise exception 'Payment not eligible for fulfillment'; end if;

  select * into v_intent
  from public.payment_checkout_intents
  where provider='stripe'
    and provider_session_id=p_provider_session_id
    and user_id=p_user_id
  for update;
  if not found then raise exception 'Unknown Stripe checkout intent'; end if;

  if round(p_amount_eur,2) <> round(v_intent.amount_eur,2) then raise exception 'Amount mismatch'; end if;
  if upper(v_intent.currency) <> 'EUR' then raise exception 'Intent currency mismatch'; end if;
  if v_intent.kind='coins' and coalesce(v_intent.coin_amount,0) <= 0 then raise exception 'Invalid coin entitlement snapshot'; end if;
  if v_intent.kind='premium' and (coalesce(v_intent.premium_plan,'')='' or coalesce(v_intent.duration_days,0) <= 0) then
    raise exception 'Invalid premium entitlement snapshot';
  end if;

  insert into public.payment_purchases(user_id,provider,provider_transaction_id,sku,amount_eur,currency,status)
  values(p_user_id,'stripe',p_provider_transaction_id,v_intent.sku,round(v_intent.amount_eur,2),'EUR',v_status)
  on conflict(provider,provider_transaction_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    update public.payment_checkout_intents
    set fulfilled_at=coalesce(fulfilled_at,now())
    where id=v_intent.id;
    return jsonb_build_object('success',true,'duplicate',true,'transactionId',p_provider_transaction_id,'provider','stripe','sessionId',p_provider_session_id);
  end if;

  if v_intent.kind='coins' then
    insert into public.coin_wallets(user_id,balance,updated_at)
    values(p_user_id,v_intent.coin_amount,now())
    on conflict(user_id) do update
      set balance=public.coin_wallets.balance+excluded.balance,updated_at=now()
    returning balance into v_balance;

    insert into public.coin_transactions(user_id,amount,balance_after,transaction_type,reference_type,reference_id,note)
    values(p_user_id,v_intent.coin_amount,v_balance,'purchase','stripe_transaction',p_provider_transaction_id,'Echtgeld-Coinpaket '||v_intent.sku);

    update public.payment_checkout_intents set fulfilled_at=now() where id=v_intent.id;
    return jsonb_build_object('success',true,'kind','coins','coins',v_intent.coin_amount,'balance',v_balance,'transactionId',p_provider_transaction_id,'provider','stripe','sessionId',p_provider_session_id);
  end if;

  update public.users
  set premium_plan=v_intent.premium_plan,
      premium_until=(greatest(coalesce(premium_until,now()),now()) + make_interval(days=>v_intent.duration_days)),
      premium_auto_renew=false
  where id=p_user_id
  returning premium_until into v_until;

  update public.payment_checkout_intents set fulfilled_at=now() where id=v_intent.id;
  return jsonb_build_object('success',true,'kind','premium','plan',v_intent.premium_plan,'premiumUntil',v_until,'transactionId',p_provider_transaction_id,'provider','stripe','sessionId',p_provider_session_id);
end;
$function$;
