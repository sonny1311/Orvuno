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


create or replace function orvuno_api.jsonb_time_ms(p_value jsonb)
returns bigint
language plpgsql
set search_path = ''
as $$
declare v_text text;
begin
  if p_value is null or p_value='null'::jsonb then return null; end if;
  v_text:=case when jsonb_typeof(p_value)='string' then p_value #>> '{}' else p_value::text end;
  if v_text is null or btrim(v_text)='' then return null; end if;
  begin
    return v_text::numeric::bigint;
  exception when others then
    begin
      return floor(extract(epoch from v_text::timestamptz)*1000)::bigint;
    exception when others then
      return null;
    end;
  end;
end;
$$;

create or replace function orvuno_api.exchange_coins_for_company_money_v2(
  p_user_id bigint,
  p_tier text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint; v_cost bigint; v_credit numeric; v_balance bigint;
  v_money numeric; v_revision bigint; v_company_id bigint;
  v_existing public.economy_transactions; v_coin_tx_id bigint; v_ledger_id bigint;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);

  if p_request_id is null or length(trim(p_request_id))<8 or length(p_request_id)>160 then
    raise exception 'Ungueltige Vorgangs-ID';
  end if;

  case p_tier
    when 'money_65000' then v_cost:=200; v_credit:=65000;
    when 'money_200000' then v_cost:=525; v_credit:=200000;
    when 'money_450000' then v_cost:=1150; v_credit:=450000;
    when 'money_1000000' then v_cost:=2400; v_credit:=1000000;
    when 'money_2800000' then v_cost:=6500; v_credit:=2800000;
    when 'money_7500000' then v_cost:=15000; v_credit:=7500000;
    else raise exception 'Unbekanntes Firmengeld-Paket';
  end case;

  perform pg_advisory_xact_lock(v_user_id);

  select * into v_existing
  from public.economy_transactions
  where user_id=v_user_id and idempotency_key=p_request_id
  for update;

  if found then
    if v_existing.operation<>'company_money_exchange' or v_existing.reference_id<>p_tier then
      raise exception 'Vorgangs-ID wurde bereits anders verwendet';
    end if;
    return jsonb_build_object(
      'success',v_existing.status='completed',
      'tier',p_tier,
      'coinsSpent',abs(v_existing.coin_delta),
      'moneyCredited',v_existing.money_delta,
      'coins',v_existing.coins_after,
      'money',v_existing.money_after,
      'moneyRevision',coalesce((v_existing.metadata->>'moneyRevision')::bigint,0),
      'transactionId',v_existing.id,
      'requestId',p_request_id,
      'replayed',true,
      'error',v_existing.error
    );
  end if;

  insert into public.coin_wallets(user_id,balance,updated_at)
  values(v_user_id,0,now())
  on conflict(user_id) do nothing;

  select balance into v_balance
  from public.coin_wallets
  where user_id=v_user_id
  for update;

  select id,coalesce(money,0),coalesce(money_revision,0)
  into v_company_id,v_money,v_revision
  from public.companies
  where user_id=v_user_id and closed_at is null
  order by money_revision desc,is_primary desc,id
  limit 1
  for update;

  if not found then raise exception 'Noch kein aktiver Betrieb vorhanden'; end if;

  if v_balance<v_cost then
    insert into public.economy_transactions(
      user_id,company_id,operation,reference_type,reference_id,idempotency_key,
      coin_delta,money_delta,coins_before,coins_after,money_before,money_after,
      status,error,completed_at
    )
    values(
      v_user_id,v_company_id,'company_money_exchange','monetization_tier',p_tier,p_request_id,
      0,0,v_balance,v_balance,v_money,v_money,'failed','Nicht genügend Coins',now()
    )
    returning id into v_ledger_id;

    return jsonb_build_object(
      'success',false,'tier',p_tier,'coins',v_balance,'money',v_money,
      'moneyRevision',v_revision,'transactionId',v_ledger_id,
      'requestId',p_request_id,'replayed',false,'error','Nicht genügend Coins'
    );
  end if;

  update public.coin_wallets
  set balance=balance-v_cost,updated_at=now()
  where user_id=v_user_id
  returning balance into v_balance;

  insert into public.coin_transactions(
    user_id,amount,balance_after,transaction_type,reference_type,reference_id,note
  )
  values(
    v_user_id,-v_cost,v_balance,'company_money_exchange','monetization_tier',
    p_tier,'Coins gegen Firmengeld getauscht'
  )
  returning id into v_coin_tx_id;

  v_money:=v_money+v_credit;
  v_revision:=v_revision+1;

  update public.companies
  set money=v_money,
      money_revision=v_revision,
      game_state=jsonb_set(
        jsonb_set(coalesce(game_state,'{}'::jsonb),'{money}',to_jsonb(v_money),true),
        '{moneyRevision}',to_jsonb(v_revision),true
      ),
      saved_at=now()
  where user_id=v_user_id and closed_at is null;

  insert into public.economy_transactions(
    user_id,company_id,operation,reference_type,reference_id,idempotency_key,
    source_coin_transaction_id,coin_delta,money_delta,coins_before,coins_after,
    money_before,money_after,status,metadata,completed_at
  )
  values(
    v_user_id,v_company_id,'company_money_exchange','monetization_tier',p_tier,p_request_id,
    v_coin_tx_id,-v_cost,v_credit,v_balance+v_cost,v_balance,v_money-v_credit,v_money,
    'completed',jsonb_build_object('moneyRevision',v_revision),now()
  )
  returning id into v_ledger_id;

  return jsonb_build_object(
    'success',true,'tier',p_tier,'coinsSpent',v_cost,'moneyCredited',v_credit,
    'coins',v_balance,'money',v_money,'moneyRevision',v_revision,
    'transactionId',v_ledger_id,'requestId',p_request_id,'replayed',false
  );
end;
$$;

create or replace function orvuno_api.shorten_company_timed_action(
  p_user_id bigint,
  p_company_id bigint,
  p_action_kind text,
  p_action_id text,
  p_hours integer default 1,
  p_max_coins integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint; v_game_state jsonb; v_building_state jsonb; v_doc jsonb;
  v_paths jsonb; v_spec jsonb; v_source text; v_path text[]; v_nested text[];
  v_list jsonb; v_parent jsonb; v_item jsonb; v_nested_item jsonb; v_index bigint;
  v_target_path text[]; v_end_keys text[]; v_end_key text; v_value jsonb;
  v_ms bigint; v_end_ms bigint;
  v_now_ms bigint:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  v_requested_ms bigint; v_remaining_ms bigint; v_reduction_ms bigint;
  v_cost integer; v_balance bigint; v_new_balance bigint; v_new_end_ms bigint; v_status text;
begin
  v_user_id:=orvuno_api.require_active_user(p_user_id);

  if p_company_id is null or p_action_id is null or btrim(p_action_id)='' then
    raise exception 'Ungueltiger Vorgang';
  end if;
  if p_hours is null or p_hours<1 or p_hours>87600 then
    raise exception 'Ungueltige Zeitverkuerzung';
  end if;
  if p_max_coins is not null and (p_max_coins<1 or p_max_coins>1000000) then
    raise exception 'Ungueltiges Coin-Limit';
  end if;

  v_paths:=case p_action_kind
    when 'production' then '[{"source":"game","path":["productionJobs"]},{"source":"game","path":["productionQueue"]},{"source":"game","path":["operationalSupplyState","productionQueue"]}]'::jsonb
    when 'delivery' then '[{"source":"game","path":["operationalSupplyState","orders"]},{"source":"game","path":["supplierOrders"]},{"source":"game","path":["marketDeliveries"]},{"source":"game","path":["constructionSite","deliveries"]}]'::jsonb
    when 'construction' then '[{"source":"game","path":["constructionSite","jobs"]}]'::jsonb
    when 'land' then '[{"source":"game","path":["constructionSite","jobs"]}]'::jsonb
    when 'warehouse_expansion' then '[{"source":"game","path":["warehouseExpansion","jobs"]}]'::jsonb
    when 'machine_upgrade' then '[{"source":"game","path":["machineUpgradeJobs"]},{"source":"building","path":["equipment"]}]'::jsonb
    when 'business_upgrade' then '[{"source":"game","path":["upgradeJobs"]}]'::jsonb
    when 'equipment' then '[{"source":"building","path":["equipment"]}]'::jsonb
    when 'maintenance' then '[{"source":"building","path":["equipment"],"nested":["maintenanceJob"]},{"source":"game","path":["productionMachines"],"nested":["maintenanceJob"]},{"source":"game","path":["machines"],"nested":["maintenanceJob"]},{"source":"game","path":["workforceState","machines"],"nested":["maintenanceJob"]},{"source":"game","path":["workforceOperationsState","machines"],"nested":["maintenanceJob"]}]'::jsonb
    when 'crew_arrival' then '[{"source":"game","path":["warehouseExpansion","crewBookings"]}]'::jsonb
    else null
  end;

  if v_paths is null then raise exception 'Dieser Vorgang kann nicht mit Coins beschleunigt werden'; end if;

  select coalesce(game_state,'{}'::jsonb),coalesce(building_state,'{}'::jsonb)
  into v_game_state,v_building_state
  from public.companies
  where id=p_company_id and user_id=v_user_id and closed_at is null
  for update;

  if not found then raise exception 'Betrieb nicht gefunden oder keine Berechtigung'; end if;

  for v_spec in select value from jsonb_array_elements(v_paths)
  loop
    v_source:=v_spec->>'source';
    select array_agg(value order by ordinality) into v_path
    from jsonb_array_elements_text(v_spec->'path') with ordinality;

    if v_spec ? 'nested' then
      select array_agg(value order by ordinality) into v_nested
      from jsonb_array_elements_text(v_spec->'nested') with ordinality;
    else
      v_nested:=array[]::text[];
    end if;

    v_doc:=case when v_source='building' then v_building_state else v_game_state end;
    v_list:=v_doc #> v_path;
    if jsonb_typeof(v_list)<>'array' then continue; end if;

    for v_parent,v_index in
      select value,ordinality-1 from jsonb_array_elements(v_list) with ordinality
    loop
      v_nested_item:=case when cardinality(v_nested)>0 then v_parent #> v_nested else null end;

      if coalesce(v_parent->>'id',v_parent->>'instanceId','')=p_action_id
         or coalesce(v_nested_item->>'id',v_nested_item->>'instanceId','')=p_action_id then
        v_target_path:=v_path||(v_index::text)||v_nested;
        v_item:=v_doc #> v_target_path;
        exit;
      end if;
    end loop;

    exit when v_target_path is not null;
  end loop;

  if v_target_path is null or v_item is null then raise exception 'Vorgang nicht gefunden'; end if;

  v_status:=lower(coalesce(v_item->>'status',''));
  if v_status in ('finished','completed','cancelled','admin_cancelled','delivered','received','stored','sold','closed') then
    raise exception 'Vorgang ist bereits beendet';
  end if;

  if p_action_kind='equipment' or (p_action_kind='machine_upgrade' and v_source='building') then
    if lower(coalesce(v_item->>'status',''))='upgrading' then
      v_end_keys:=array['upgradeFinishAt','finishAt','busyUntil','installationFinishAt'];
    else
      v_end_keys:=array['installationFinishAt','finishAt','busyUntil','upgradeFinishAt'];
    end if;
  elsif p_action_kind='maintenance' then
    v_end_keys:=array['completeAt','finishAt','endsAt'];
  elsif p_action_kind='crew_arrival' then
    v_end_keys:=array['availableAt','arrivalAt','arrivesAt','eta'];
  else
    v_end_keys:=array[
      'finishAt','completeAt','arrivalAt','arrivalTime','arriveAt','arrivesAt',
      'deliveryAt','trafficEta','eta','endsAt','expectedAt','readyAt','availableAt',
      'installationFinishAt','upgradeFinishAt','busyUntil'
    ];
  end if;

  foreach v_end_key in array v_end_keys
  loop
    v_ms:=orvuno_api.jsonb_time_ms(v_item->v_end_key);
    if v_ms is not null and v_ms>0 then v_end_ms:=v_ms; exit; end if;
  end loop;

  if v_end_ms is null then raise exception 'Vorgang besitzt keine gueltige Endzeit'; end if;

  v_remaining_ms:=greatest(0,v_end_ms-v_now_ms);
  if v_remaining_ms<=0 then raise exception 'Vorgang ist bereits beendet'; end if;

  v_requested_ms:=p_hours::bigint*3600000;
  if p_max_coins is not null then
    v_requested_ms:=least(v_requested_ms,p_max_coins::bigint*300000);
  end if;

  v_reduction_ms:=least(v_requested_ms,v_remaining_ms);
  if v_reduction_ms<=0 then raise exception 'Ungueltige Zeitverkuerzung'; end if;

  v_cost:=greatest(1,ceil(v_reduction_ms::numeric/300000)::integer);
  if p_max_coins is not null and v_cost>p_max_coins then raise exception 'Coin-Limit ueberschritten'; end if;

  select balance into v_balance
  from public.coin_wallets
  where user_id=v_user_id
  for update;

  if not found then raise exception 'Coin-Wallet nicht gefunden'; end if;
  if v_balance<v_cost then raise exception 'Nicht genug Coins'; end if;

  v_new_balance:=v_balance-v_cost;

  foreach v_end_key in array v_end_keys
  loop
    v_value:=v_item->v_end_key;
    v_ms:=orvuno_api.jsonb_time_ms(v_value);
    if v_ms is null or v_ms<=v_now_ms then continue; end if;

    v_new_end_ms:=greatest(v_now_ms,v_ms-v_reduction_ms);

    if jsonb_typeof(v_value)='number' then
      v_doc:=jsonb_set(v_doc,v_target_path||v_end_key,to_jsonb(v_new_end_ms),false);
    elsif (v_value #>> '{}') ~ '^[0-9]+
grant usage on schema orvuno_api to orvuno_app;

revoke all on all functions in schema orvuno_api from public;
grant execute on all functions in schema orvuno_api to orvuno_app;
 then
      v_doc:=jsonb_set(v_doc,v_target_path||v_end_key,to_jsonb(v_new_end_ms::text),false);
    else
      v_doc:=jsonb_set(
        v_doc,v_target_path||v_end_key,
        to_jsonb(to_char(to_timestamp(v_new_end_ms/1000.0) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
        false
      );
    end if;
  end loop;

  update public.coin_wallets
  set balance=v_new_balance,updated_at=now()
  where user_id=v_user_id;

  insert into public.coin_transactions(
    user_id,amount,balance_after,transaction_type,reference_type,reference_id,note
  )
  values(
    v_user_id,-v_cost,v_new_balance,'time_reduction',p_action_kind,p_action_id,
    format('%s Coin(s) fuer %s Minuten Zeitverkuerzung (frei gewaehlt; 1 Coin je angefangene 5 Minuten)',
      v_cost,ceil(v_reduction_ms/60000.0))
  );

  if v_source='building' then
    v_building_state:=v_doc;
    update public.companies set building_state=v_building_state,saved_at=now() where id=p_company_id;
  else
    v_game_state:=v_doc;
    update public.companies set game_state=v_game_state,saved_at=now() where id=p_company_id;
  end if;

  v_item:=v_doc #> v_target_path;
  v_new_end_ms:=null;

  foreach v_end_key in array v_end_keys
  loop
    v_new_end_ms:=orvuno_api.jsonb_time_ms(v_item->v_end_key);
    exit when v_new_end_ms is not null and v_new_end_ms>0;
  end loop;

  return jsonb_build_object(
    'success',true,
    'costCoins',v_cost,
    'requestedCoinBudget',p_max_coins,
    'reducedMs',v_reduction_ms,
    'reducedMinutes',ceil(v_reduction_ms/60000.0),
    'priceUnitMinutes',5,
    'coinsPerUnit',1,
    'newEndMs',v_new_end_ms,
    'newBalance',v_new_balance,
    'kind',p_action_kind,
    'actionId',p_action_id
  );
end;
$$;

revoke all on schema orvuno_api from public;
grant usage on schema orvuno_api to orvuno_app;

revoke all on all functions in schema orvuno_api from public;
grant execute on all functions in schema orvuno_api to orvuno_app;
