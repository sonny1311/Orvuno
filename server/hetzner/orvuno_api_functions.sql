-- ORVUNO Hetzner local API functions.
-- Auth is verified by the Node API; every mutating function still re-checks
-- the resolved local user id and account status.

create schema if not exists orvuno_api;

create or replace function orvuno_api.require_active_user(p_user_id bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_status text;
begin
  select status into v_status
  from public.users
  where id=p_user_id and deleted_at is null
  limit 1;

  if v_status is null then
    raise exception 'Kein verknuepfter Spielaccount';
  end if;
  if v_status <> 'active' then
    raise exception 'Account ist nicht zum Spielen freigegeben';
  end if;
  return p_user_id;
end;
$$;

create or replace function orvuno_api.save_player_business_state(
  p_user_id bigint,
  p_company_id bigint,
  p_state jsonb
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint; v_company public.companies; v_canonical public.companies;
  v_incoming_money numeric; v_money numeric; v_incoming_revision bigint; v_revision bigint; v_next_revision bigint;
  v_existing_state jsonb; v_property jsonb;
begin
  v_user_id := orvuno_api.require_active_user(p_user_id);
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'Ungueltiger Spielstand'; end if;
  if octet_length(p_state::text) > 5242880 then raise exception 'Spielstand ist zu gross'; end if;

  perform pg_advisory_xact_lock(v_user_id);

  select * into v_company
  from public.companies
  where id=p_company_id and user_id=v_user_id and closed_at is null
  for update;
  if not found then raise exception 'Betrieb nicht gefunden'; end if;

  select * into v_canonical
  from public.companies
  where user_id=v_user_id and closed_at is null
  order by money_revision desc,is_primary desc,id
  limit 1
  for update;

  v_revision := coalesce(v_canonical.money_revision,0);
  v_money := coalesce(v_canonical.money,0);

  begin v_incoming_money := (p_state->>'money')::numeric; exception when others then v_incoming_money := null; end;
  begin v_incoming_revision := (p_state->>'moneyRevision')::bigint; exception when others then v_incoming_revision := null; end;

  if v_incoming_revision = v_revision and v_incoming_money is not null then
    if v_incoming_money < -1000000000000 or v_incoming_money > 1000000000000 then
      raise exception 'Ungueltiger Kontostand';
    end if;
    if v_incoming_money is distinct from v_money then
      v_money:=v_incoming_money;
      v_next_revision:=v_revision+1;
    else
      v_next_revision:=v_revision;
    end if;
  else
    v_next_revision:=v_revision;
  end if;

  v_existing_state := coalesce(v_company.game_state,'{}'::jsonb);
  v_property := case when jsonb_typeof(v_existing_state->'property')='object' then v_existing_state->'property' else null end;

  p_state := jsonb_set(jsonb_set(p_state,'{money}',to_jsonb(v_money),true),'{moneyRevision}',to_jsonb(v_next_revision),true);
  if v_property is not null then
    p_state:=jsonb_set(p_state,'{property}',v_property,true);
  else
    p_state:=p_state-'property';
  end if;

  update public.companies
  set game_state=p_state,money=v_money,money_revision=v_next_revision,saved_at=now()
  where id=p_company_id and user_id=v_user_id and closed_at is null
  returning * into v_company;

  update public.companies
  set money=v_money,
      money_revision=v_next_revision,
      game_state=jsonb_set(
        jsonb_set(coalesce(game_state,'{}'::jsonb),'{money}',to_jsonb(v_money),true),
        '{moneyRevision}',to_jsonb(v_next_revision),true
      ),
      saved_at=now()
  where user_id=v_user_id and closed_at is null and id<>p_company_id;

  select * into v_company from public.companies where id=p_company_id;
  return v_company;
end;
$$;

create or replace function orvuno_api.save_player_game_state(
  p_user_id bigint,
  p_state jsonb
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint; v_company public.companies; v_canonical public.companies;
  v_incoming_money numeric; v_money numeric; v_incoming_revision bigint; v_revision bigint; v_next_revision bigint;
  v_existing_state jsonb; v_property jsonb;
begin
  v_user_id := orvuno_api.require_active_user(p_user_id);
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'Ungueltiger Spielstand'; end if;
  if octet_length(p_state::text) > 5242880 then raise exception 'Spielstand ist zu gross'; end if;

  perform pg_advisory_xact_lock(v_user_id);

  select * into v_company
  from public.companies
  where user_id=v_user_id and is_primary=true and closed_at is null
  order by id
  limit 1
  for update;
  if not found then raise exception 'Noch kein Hauptbetrieb vorhanden'; end if;

  select * into v_canonical
  from public.companies
  where user_id=v_user_id and closed_at is null
  order by money_revision desc,is_primary desc,id
  limit 1
  for update;

  v_revision := coalesce(v_canonical.money_revision,0);
  v_money := coalesce(v_canonical.money,0);

  begin v_incoming_money := (p_state->>'money')::numeric; exception when others then v_incoming_money := null; end;
  begin v_incoming_revision := (p_state->>'moneyRevision')::bigint; exception when others then v_incoming_revision := null; end;

  if v_incoming_revision = v_revision and v_incoming_money is not null then
    if v_incoming_money < -1000000000000 or v_incoming_money > 1000000000000 then
      raise exception 'Ungueltiger Kontostand';
    end if;
    if v_incoming_money is distinct from v_money then
      v_money:=v_incoming_money;
      v_next_revision:=v_revision+1;
    else
      v_next_revision:=v_revision;
    end if;
  else
    v_next_revision:=v_revision;
  end if;

  v_existing_state := coalesce(v_company.game_state,'{}'::jsonb);
  v_property := case when jsonb_typeof(v_existing_state->'property')='object' then v_existing_state->'property' else null end;

  p_state := jsonb_set(jsonb_set(p_state,'{money}',to_jsonb(v_money),true),'{moneyRevision}',to_jsonb(v_next_revision),true);
  if v_property is not null then
    p_state:=jsonb_set(p_state,'{property}',v_property,true);
  else
    p_state:=p_state-'property';
  end if;

  update public.companies
  set game_state=p_state,money=v_money,money_revision=v_next_revision,saved_at=now()
  where id=v_company.id
  returning * into v_company;

  update public.companies
  set money=v_money,
      money_revision=v_next_revision,
      game_state=jsonb_set(
        jsonb_set(coalesce(game_state,'{}'::jsonb),'{money}',to_jsonb(v_money),true),
        '{moneyRevision}',to_jsonb(v_next_revision),true
      ),
      saved_at=now()
  where user_id=v_user_id and is_primary=false and closed_at is null;

  select * into v_company from public.companies where id=v_company.id;
  return v_company;
end;
$$;

create or replace function orvuno_api.set_tutorial_state(
  p_user_id bigint,
  p_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id bigint; v_seen timestamptz; v_completed timestamptz;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);

  update public.users
  set tutorial_seen_at=coalesce(tutorial_seen_at,now()),
      tutorial_completed_at=case when coalesce(p_completed,false) then coalesce(tutorial_completed_at,now()) else tutorial_completed_at end
  where id=v_user_id
  returning tutorial_seen_at,tutorial_completed_at into v_seen,v_completed;

  return jsonb_build_object(
    'success',true,
    'tutorialSeenAt',v_seen,
    'tutorialCompletedAt',v_completed
  );
end;
$$;

create or replace function orvuno_api.ensure_player_company(
  p_user_id bigint,
  p_name text default null,
  p_industry text default null,
  p_company_type text default null
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id bigint; v_company public.companies;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);

  select * into v_company
  from public.companies
  where user_id=v_user_id and slot_no=1
  limit 1;

  if found then return v_company; end if;

  insert into public.companies(
    user_id,name,industry,company_type,money,slot_no,
    setup_phase,is_primary,building_state,game_state
  )
  values(
    v_user_id,
    coalesce(nullif(btrim(p_name),''),'Meine Firma'),
    nullif(btrim(p_industry),''),
    nullif(btrim(p_company_type),''),
    250000,1,'empty_building',true,
    '{"kind":"starter_shell","rooms":[],"equipment":[],"ready":false}'::jsonb,
    '{"money":250000,"moneyRevision":0}'::jsonb
  )
  returning * into v_company;

  return v_company;
end;
$$;

create or replace function orvuno_api.create_player_business(
  p_user_id bigint,
  p_name text,
  p_industry text,
  p_company_type text,
  p_slot_no smallint
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id bigint; v_company public.companies;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);

  if p_slot_no is distinct from 1::smallint then
    raise exception 'Der erste Betrieb muss Betriebsplatz 1 verwenden';
  end if;

  if exists(
    select 1 from public.companies
    where user_id=v_user_id and closed_at is null
  ) then
    raise exception 'Weitere Betriebe müssen über die bezahlte Expansion angelegt werden';
  end if;

  insert into public.companies(
    user_id,name,industry,company_type,money,slot_no,
    setup_phase,is_primary,building_state,game_state
  )
  values(
    v_user_id,
    coalesce(nullif(btrim(p_name),''),'Mein Betrieb'),
    nullif(btrim(p_industry),''),
    nullif(btrim(p_company_type),''),
    250000,1,'empty_building',true,
    '{"kind":"starter_shell","rooms":[],"equipment":[],"ready":false}'::jsonb,
    '{"money":250000,"moneyRevision":0}'::jsonb
  )
  returning * into v_company;

  return v_company;
end;
$$;

create or replace function orvuno_api.create_player_business_paid(
  p_user_id bigint,
  p_name text,
  p_industry text,
  p_company_type text,
  p_slot_no smallint,
  p_source_company_id bigint,
  p_location_class text,
  p_property_mode text,
  p_size_level integer
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint; v_company public.companies; v_source_state jsonb; v_money numeric;
  v_location text; v_mode text; v_size integer; v_purchase_base numeric; v_rent_base numeric;
  v_upfront numeric; v_monthly numeric; v_now_ms bigint; v_finance jsonb; v_cost_ledger jsonb; v_new_state jsonb;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);
  perform pg_advisory_xact_lock(v_user_id);

  if p_slot_no<2 then
    raise exception 'Zusatzbetriebe müssen Betriebsplatz 2 oder höher verwenden';
  end if;

  if not exists(
    select 1 from public.companies
    where user_id=v_user_id and is_primary=true and closed_at is null
  ) then
    raise exception 'Zuerst muss ein Hauptbetrieb bestehen';
  end if;

  if exists(
    select 1 from public.companies
    where user_id=v_user_id and slot_no=p_slot_no and closed_at is null
  ) then
    raise exception 'Dieser Betriebsplatz ist bereits belegt';
  end if;

  v_location:=coalesce(nullif(btrim(p_location_class),''),'smallTown');
  v_mode:=lower(coalesce(nullif(btrim(p_property_mode),''),'rent'));
  v_size:=greatest(1,coalesce(p_size_level,1));

  if v_mode not in ('rent','buy') then raise exception 'Unbekannte Immobilienart'; end if;

  case v_location
    when 'rural' then v_purchase_base:=65000; v_rent_base:=650;
    when 'smallTown' then v_purchase_base:=105000; v_rent_base:=1050;
    when 'city' then v_purchase_base:=185000; v_rent_base:=1850;
    when 'metro' then v_purchase_base:=330000; v_rent_base:=3300;
    else raise exception 'Unbekannte Standortklasse';
  end case;

  if v_mode='buy' then
    v_upfront:=round(v_purchase_base*power(1.55,v_size-1));
    v_monthly:=0;
  else
    v_upfront:=round(v_rent_base*3*power(1.35,v_size-1));
    v_monthly:=round(v_rent_base*power(1.35,v_size-1));
  end if;

  select coalesce(game_state,'{}'::jsonb),coalesce(money,0)
  into v_source_state,v_money
  from public.companies
  where id=p_source_company_id and user_id=v_user_id and closed_at is null
  for update;

  if not found then raise exception 'Quellbetrieb nicht gefunden'; end if;

  if v_money<v_upfront then
    if v_mode='buy' then
      raise exception 'Nicht genug Spielgeld für den Immobilienkauf: benötigt %',v_upfront;
    else
      raise exception 'Nicht genug Spielgeld für die Miet-Startkosten: benötigt %',v_upfront;
    end if;
  end if;

  v_money:=v_money-v_upfront;
  v_now_ms:=(extract(epoch from clock_timestamp())*1000)::bigint;

  v_finance:=case when jsonb_typeof(v_source_state->'financialLog')='array' then v_source_state->'financialLog' else '[]'::jsonb end;
  v_cost_ledger:=case when jsonb_typeof(v_source_state->'costLedger')='array' then v_source_state->'costLedger' else '[]'::jsonb end;

  v_source_state:=jsonb_set(v_source_state,'{money}',to_jsonb(v_money),true);
  v_source_state:=jsonb_set(
    v_source_state,'{financialLog}',
    v_finance||jsonb_build_array(jsonb_build_object(
      'type','business_property','amount',-v_upfront,'time',v_now_ms,
      'slotNo',p_slot_no,'locationClass',v_location,
      'propertyMode',v_mode,'monthlyRent',v_monthly
    )),true
  );
  v_source_state:=jsonb_set(
    v_source_state,'{costLedger}',
    v_cost_ledger||jsonb_build_array(jsonb_build_object(
      'type','investment',
      'category',case when v_mode='buy' then 'property_purchase' else 'property_rental_entry' end,
      'amount',v_upfront,'time',v_now_ms,'slotNo',p_slot_no,'locationClass',v_location
    )),true
  );

  update public.companies
  set money=v_money,
      game_state=jsonb_set(coalesce(game_state,'{}'::jsonb),'{money}',to_jsonb(v_money),true),
      saved_at=now()
  where user_id=v_user_id and closed_at is null;

  update public.companies
  set game_state=v_source_state
  where id=p_source_company_id and user_id=v_user_id;

  v_new_state:=jsonb_build_object(
    'money',v_money,
    'property',jsonb_build_object(
      'locationClass',v_location,
      'mode',v_mode,
      'sizeLevel',v_size,
      'upfrontPaid',v_upfront,
      'purchaseValue',case when v_mode='buy' then v_upfront else 0 end,
      'monthlyRent',v_monthly,
      'startedAt',v_now_ms,
      'lastRentChargedAt',v_now_ms
    )
  );

  insert into public.companies(
    user_id,name,industry,company_type,money,slot_no,
    setup_phase,is_primary,building_state,game_state
  )
  values(
    v_user_id,
    coalesce(nullif(btrim(p_name),''),'Neuer Betrieb'),
    nullif(btrim(p_industry),''),
    nullif(btrim(p_company_type),''),
    v_money,p_slot_no,'empty_building',false,
    '{"kind":"starter_shell","rooms":[],"equipment":[],"ready":false}'::jsonb,
    v_new_state
  )
  returning * into v_company;

  return v_company;
end;
$$;

create or replace function orvuno_api.update_player_business_setup(
  p_user_id bigint,
  p_company_id bigint,
  p_setup_phase text,
  p_building_state jsonb
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id bigint; v_company public.companies;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);

  if p_setup_phase not in ('empty_building','furnishing','ready','operating') then
    raise exception 'Ungueltige Gruendungsphase';
  end if;

  update public.companies
  set setup_phase=p_setup_phase,
      building_state=coalesce(p_building_state,building_state),
      saved_at=now()
  where id=p_company_id and user_id=v_user_id
  returning * into v_company;

  if not found then raise exception 'Betrieb nicht gefunden'; end if;
  return v_company;
end;
$$;

create or replace function orvuno_api.process_player_business_finances(
  p_user_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint; v_primary public.companies; v_company public.companies; v_state jsonb; v_property jsonb;
  v_money numeric; v_mode text; v_monthly numeric; v_started bigint; v_last bigint; v_now bigint;
  v_period_ms bigint:=2592000000; v_due integer; v_charge numeric; v_purchase numeric; v_sale numeric; v_remainder numeric;
  v_primary_state jsonb; v_primary_money numeric; v_events jsonb:='[]'::jsonb; v_finance jsonb; v_cost_ledger jsonb;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);
  perform pg_advisory_xact_lock(v_user_id);
  v_now:=(extract(epoch from clock_timestamp())*1000)::bigint;

  select * into v_primary
  from public.companies
  where user_id=v_user_id and is_primary=true and closed_at is null
  order by id limit 1
  for update;

  for v_company in
    select * from public.companies
    where user_id=v_user_id and is_primary=false and closed_at is null
    order by id
    for update
  loop
    v_state:=coalesce(v_company.game_state,'{}'::jsonb);
    v_property:=case when jsonb_typeof(v_state->'property')='object' then v_state->'property' else '{}'::jsonb end;
    v_money:=coalesce(v_company.money,0);
    v_mode:=lower(coalesce(v_property->>'mode','rent'));

    begin v_monthly:=coalesce((v_property->>'monthlyRent')::numeric,0); exception when others then v_monthly:=0; end;
    begin v_started:=coalesce((v_property->>'startedAt')::bigint,(extract(epoch from v_company.founded_at)*1000)::bigint,v_now); exception when others then v_started:=v_now; end;
    begin v_last:=coalesce((v_property->>'lastRentChargedAt')::bigint,v_started); exception when others then v_last:=v_started; end;

    if v_mode='rent' and v_monthly>0 and v_now>v_last then
      v_due:=floor((v_now-v_last)::numeric/v_period_ms)::integer;
      if v_due>0 then
        v_charge:=v_monthly*v_due;
        v_money:=v_money-v_charge;
        v_last:=v_last+(v_due::bigint*v_period_ms);
        v_property:=jsonb_set(v_property,'{lastRentChargedAt}',to_jsonb(v_last),true);
        v_property:=jsonb_set(v_property,'{lastRentCharge}',to_jsonb(v_charge),true);
        v_property:=jsonb_set(v_property,'{lastRentPeriods}',to_jsonb(v_due),true);
        v_state:=jsonb_set(v_state,'{property}',v_property,true);
        v_finance:=case when jsonb_typeof(v_state->'financialLog')='array' then v_state->'financialLog' else '[]'::jsonb end;
        v_cost_ledger:=case when jsonb_typeof(v_state->'costLedger')='array' then v_state->'costLedger' else '[]'::jsonb end;
        v_state:=jsonb_set(v_state,'{financialLog}',v_finance||jsonb_build_array(jsonb_build_object('type','property_rent','amount',-v_charge,'time',v_now,'months',v_due)),true);
        v_state:=jsonb_set(v_state,'{costLedger}',v_cost_ledger||jsonb_build_array(jsonb_build_object('type','operating','category','property_rent','amount',v_charge,'time',v_now,'months',v_due)),true);
      end if;
    end if;

    v_state:=jsonb_set(v_state,'{money}',to_jsonb(v_money),true);
    update public.companies set money=v_money,game_state=v_state,saved_at=now() where id=v_company.id;

    if v_money<0 then
      if v_mode='buy' then
        begin v_purchase:=coalesce((v_property->>'purchaseValue')::numeric,(v_property->>'upfrontPaid')::numeric,0); exception when others then v_purchase:=0; end;
        v_sale:=round(v_purchase*0.75);
        v_remainder:=greatest(0,v_money+v_sale);

        if v_primary.id is not null and v_remainder>0 then
          v_primary_state:=coalesce(v_primary.game_state,'{}'::jsonb);
          v_primary_money:=coalesce(v_primary.money,0)+v_remainder;
          v_primary_state:=jsonb_set(v_primary_state,'{money}',to_jsonb(v_primary_money),true);
          v_finance:=case when jsonb_typeof(v_primary_state->'financialLog')='array' then v_primary_state->'financialLog' else '[]'::jsonb end;
          v_primary_state:=jsonb_set(v_primary_state,'{financialLog}',v_finance||jsonb_build_array(jsonb_build_object('type','forced_property_sale_transfer','amount',v_remainder,'time',v_now,'fromCompanyId',v_company.id)),true);
          update public.companies set money=v_primary_money,game_state=v_primary_state,saved_at=now() where id=v_primary.id;
          v_primary.money:=v_primary_money;
          v_primary.game_state:=v_primary_state;
        end if;

        v_property:=jsonb_set(v_property,'{forcedSaleValue}',to_jsonb(v_sale),true);
        v_property:=jsonb_set(v_property,'{forcedSaleRate}',to_jsonb(0.75),true);
        v_property:=jsonb_set(v_property,'{forcedSaleAt}',to_jsonb(v_now),true);
        v_state:=jsonb_set(v_state,'{property}',v_property,true);
        v_state:=jsonb_set(v_state,'{money}',to_jsonb(0),true);
        v_state:=jsonb_set(v_state,'{businessStatus}',to_jsonb('closed'::text),true);

        update public.companies
        set money=0,game_state=v_state,closed_at=now(),closure_reason='forced_property_sale',saved_at=now()
        where id=v_company.id;

        v_events:=v_events||jsonb_build_array(jsonb_build_object(
          'type','forced_sale','companyId',v_company.id,'companyName',v_company.name,
          'saleValue',v_sale,'transferToPrimary',v_remainder,'rate',0.75
        ));
      else
        v_state:=jsonb_set(v_state,'{money}',to_jsonb(0),true);
        v_state:=jsonb_set(v_state,'{businessStatus}',to_jsonb('closed'::text),true);

        update public.companies
        set money=0,game_state=v_state,closed_at=now(),closure_reason='rent_insolvency',saved_at=now()
        where id=v_company.id;

        v_events:=v_events||jsonb_build_array(jsonb_build_object(
          'type','rent_closed','companyId',v_company.id,'companyName',v_company.name,'monthlyRent',v_monthly
        ));
      end if;
    end if;
  end loop;

  return jsonb_build_object('events',v_events,'processedAt',v_now);
end;
$$;

create or replace function orvuno_api.take_expansion_loan(
  p_user_id bigint,
  p_company_id bigint,
  p_amount numeric,
  p_term_months integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user bigint; v_id bigint; v_annual_rate numeric:=0.06;
  v_monthly_rate numeric; v_factor numeric; v_payment numeric; v_outstanding numeric;
begin
  v_user:=orvuno_api.require_active_user(p_user_id);
  perform pg_advisory_xact_lock(v_user);

  if not exists(
    select 1 from public.companies
    where id=p_company_id and user_id=v_user and closed_at is null
    for update
  ) then
    raise exception 'Betrieb nicht gefunden';
  end if;

  if p_amount<5000 or p_amount>5000000 then
    raise exception 'Kreditbetrag muss zwischen 5.000 und 5.000.000 liegen';
  end if;
  if p_term_months<12 or p_term_months>120 then
    raise exception 'Kreditlaufzeit muss zwischen 12 und 120 Monaten liegen';
  end if;

  select coalesce(sum(remaining_principal),0)
  into v_outstanding
  from public.business_expansion_loans
  where user_id=v_user and status='active';

  if v_outstanding+p_amount>5000000 then
    raise exception 'Maximales offenes Kreditvolumen von 5.000.000 überschritten';
  end if;

  v_monthly_rate:=v_annual_rate/12;
  v_factor:=power(1+v_monthly_rate,p_term_months);
  v_payment:=round((p_amount*v_monthly_rate*v_factor/(v_factor-1))::numeric,2);
  if v_payment<=0 then raise exception 'Ungueltige Finanzierung'; end if;

  insert into public.business_expansion_loans(
    user_id,company_id,principal,annual_rate,term_months,
    remaining_principal,monthly_payment
  )
  values(v_user,p_company_id,p_amount,v_annual_rate,p_term_months,p_amount,v_payment)
  returning id into v_id;

  update public.companies
  set money=coalesce(money,0)+p_amount,
      debt=coalesce(debt,0)+p_amount,
      game_state=jsonb_set(coalesce(game_state,'{}'::jsonb),'{money}',to_jsonb(coalesce(money,0)+p_amount),true),
      saved_at=now()
  where user_id=v_user and closed_at is null;

  return jsonb_build_object(
    'loan_id',v_id,
    'amount',p_amount,
    'annual_rate',v_annual_rate,
    'term_months',p_term_months,
    'monthly_payment',v_payment
  );
end;
$$;

create or replace function orvuno_api.cancel_coin_sell_order(
  p_user_id bigint,
  p_order_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id bigint; v_remaining bigint; v_balance bigint;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);
  perform pg_advisory_xact_lock(v_user_id);

  select remaining_amount into v_remaining
  from public.coin_market_orders
  where id=p_order_id and seller_user_id=v_user_id and status='open'
  for update;

  if not found then raise exception 'Offene Verkaufsorder nicht gefunden'; end if;

  update public.coin_market_orders
  set status='cancelled',closed_at=now()
  where id=p_order_id;

  update public.coin_wallets
  set balance=balance+v_remaining,updated_at=now()
  where user_id=v_user_id
  returning balance into v_balance;

  insert into public.coin_transactions(
    user_id,amount,balance_after,transaction_type,
    reference_type,reference_id,note
  )
  values(
    v_user_id,v_remaining,v_balance,'market_escrow_refund',
    'coin_market_order',p_order_id::text,'Nicht verkaufte Coins zurueckgebucht'
  );

  return v_balance;
end;
$$;

revoke all on schema orvuno_api from public;
grant usage on schema orvuno_api to orvuno_app;

revoke all on all functions in schema orvuno_api from public;
grant execute on all functions in schema orvuno_api to orvuno_app;
