-- ORVUNO: Spieler koennen bei Zeitverkuerzungen eine frei gewaehlte Coin-Menge einsetzen.
-- Preis bleibt unveraendert: 1 Coin je angefangene 5 Minuten tatsaechlich verkuerzter Restzeit.
-- Bestehende Aufrufer ohne p_max_coins bleiben kompatibel.

DROP FUNCTION IF EXISTS public.shorten_company_timed_action(bigint,text,text,integer,integer);
DROP FUNCTION IF EXISTS public.shorten_company_timed_action(bigint,text,text,integer);

CREATE FUNCTION public.shorten_company_timed_action(
  p_company_id bigint,
  p_action_kind text,
  p_action_id text,
  p_hours integer DEFAULT 1,
  p_max_coins integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id bigint;
  v_game_state jsonb;
  v_building_state jsonb;
  v_doc jsonb;
  v_paths jsonb;
  v_spec jsonb;
  v_source text;
  v_path text[];
  v_nested text[];
  v_list jsonb;
  v_parent jsonb;
  v_item jsonb;
  v_nested_item jsonb;
  v_index bigint;
  v_target_path text[];
  v_end_keys text[];
  v_end_key text;
  v_value jsonb;
  v_ms bigint;
  v_end_ms bigint;
  v_now_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  v_requested_ms bigint;
  v_remaining_ms bigint;
  v_reduction_ms bigint;
  v_cost integer;
  v_balance bigint;
  v_new_balance bigint;
  v_new_end_ms bigint;
  v_status text;
BEGIN
  v_user_id := private.require_active_game_user_id();

  IF p_company_id IS NULL OR p_action_id IS NULL OR btrim(p_action_id) = '' THEN
    RAISE EXCEPTION 'Ungueltiger Vorgang';
  END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 87600 THEN
    RAISE EXCEPTION 'Ungueltige Zeitverkuerzung';
  END IF;
  IF p_max_coins IS NOT NULL AND (p_max_coins < 1 OR p_max_coins > 1000000) THEN
    RAISE EXCEPTION 'Ungueltiges Coin-Limit';
  END IF;

  v_paths := CASE p_action_kind
    WHEN 'production' THEN '[{"source":"game","path":["productionJobs"]},{"source":"game","path":["productionQueue"]},{"source":"game","path":["operationalSupplyState","productionQueue"]}]'::jsonb
    WHEN 'delivery' THEN '[{"source":"game","path":["operationalSupplyState","orders"]},{"source":"game","path":["supplierOrders"]},{"source":"game","path":["marketDeliveries"]},{"source":"game","path":["constructionSite","deliveries"]}]'::jsonb
    WHEN 'construction' THEN '[{"source":"game","path":["constructionSite","jobs"]}]'::jsonb
    WHEN 'land' THEN '[{"source":"game","path":["constructionSite","jobs"]}]'::jsonb
    WHEN 'warehouse_expansion' THEN '[{"source":"game","path":["warehouseExpansion","jobs"]}]'::jsonb
    WHEN 'machine_upgrade' THEN '[{"source":"game","path":["machineUpgradeJobs"]},{"source":"building","path":["equipment"]}]'::jsonb
    WHEN 'business_upgrade' THEN '[{"source":"game","path":["upgradeJobs"]}]'::jsonb
    WHEN 'equipment' THEN '[{"source":"building","path":["equipment"]}]'::jsonb
    WHEN 'maintenance' THEN '[{"source":"building","path":["equipment"],"nested":["maintenanceJob"]},{"source":"game","path":["productionMachines"],"nested":["maintenanceJob"]},{"source":"game","path":["machines"],"nested":["maintenanceJob"]},{"source":"game","path":["workforceState","machines"],"nested":["maintenanceJob"]},{"source":"game","path":["workforceOperationsState","machines"],"nested":["maintenanceJob"]}]'::jsonb
    WHEN 'crew_arrival' THEN '[{"source":"game","path":["warehouseExpansion","crewBookings"]}]'::jsonb
    ELSE NULL
  END;
  IF v_paths IS NULL THEN
    RAISE EXCEPTION 'Dieser Vorgang kann nicht mit Coins beschleunigt werden';
  END IF;

  SELECT coalesce(game_state, '{}'::jsonb), coalesce(building_state, '{}'::jsonb)
    INTO v_game_state, v_building_state
  FROM public.companies
  WHERE id = p_company_id AND user_id = v_user_id AND closed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Betrieb nicht gefunden oder keine Berechtigung'; END IF;

  FOR v_spec IN SELECT value FROM jsonb_array_elements(v_paths)
  LOOP
    v_source := v_spec->>'source';
    SELECT array_agg(value ORDER BY ordinality) INTO v_path
    FROM jsonb_array_elements_text(v_spec->'path') WITH ORDINALITY;
    IF v_spec ? 'nested' THEN
      SELECT array_agg(value ORDER BY ordinality) INTO v_nested
      FROM jsonb_array_elements_text(v_spec->'nested') WITH ORDINALITY;
    ELSE
      v_nested := ARRAY[]::text[];
    END IF;

    v_doc := CASE WHEN v_source = 'building' THEN v_building_state ELSE v_game_state END;
    v_list := v_doc #> v_path;
    IF jsonb_typeof(v_list) <> 'array' THEN CONTINUE; END IF;

    FOR v_parent, v_index IN
      SELECT value, ordinality - 1 FROM jsonb_array_elements(v_list) WITH ORDINALITY
    LOOP
      v_nested_item := CASE WHEN cardinality(v_nested) > 0 THEN v_parent #> v_nested ELSE NULL END;
      IF coalesce(v_parent->>'id', v_parent->>'instanceId', '') = p_action_id
         OR coalesce(v_nested_item->>'id', v_nested_item->>'instanceId', '') = p_action_id THEN
        v_target_path := v_path || (v_index::text) || v_nested;
        v_item := v_doc #> v_target_path;
        EXIT;
      END IF;
    END LOOP;
    EXIT WHEN v_target_path IS NOT NULL;
  END LOOP;

  IF v_target_path IS NULL OR v_item IS NULL THEN RAISE EXCEPTION 'Vorgang nicht gefunden'; END IF;

  v_status := lower(coalesce(v_item->>'status', ''));
  IF v_status IN ('finished','completed','cancelled','admin_cancelled','delivered','received','stored','sold','closed') THEN
    RAISE EXCEPTION 'Vorgang ist bereits beendet';
  END IF;

  IF p_action_kind = 'equipment' OR (p_action_kind = 'machine_upgrade' AND v_source = 'building') THEN
    IF lower(coalesce(v_item->>'status','')) = 'upgrading' THEN
      v_end_keys := ARRAY['upgradeFinishAt','finishAt','busyUntil','installationFinishAt'];
    ELSE
      v_end_keys := ARRAY['installationFinishAt','finishAt','busyUntil','upgradeFinishAt'];
    END IF;
  ELSIF p_action_kind = 'maintenance' THEN
    v_end_keys := ARRAY['completeAt','finishAt','endsAt'];
  ELSIF p_action_kind = 'crew_arrival' THEN
    v_end_keys := ARRAY['availableAt','arrivalAt','arrivesAt','eta'];
  ELSE
    v_end_keys := ARRAY['finishAt','completeAt','arrivalAt','arrivalTime','arriveAt','arrivesAt','deliveryAt','trafficEta','eta','endsAt','expectedAt','readyAt','availableAt','installationFinishAt','upgradeFinishAt','busyUntil'];
  END IF;

  FOREACH v_end_key IN ARRAY v_end_keys
  LOOP
    v_ms := private.orvuno_jsonb_time_ms(v_item->v_end_key);
    IF v_ms IS NOT NULL AND v_ms > 0 THEN
      v_end_ms := v_ms;
      EXIT;
    END IF;
  END LOOP;

  IF v_end_ms IS NULL THEN RAISE EXCEPTION 'Vorgang besitzt keine gueltige Endzeit'; END IF;
  v_remaining_ms := greatest(0, v_end_ms - v_now_ms);
  IF v_remaining_ms <= 0 THEN RAISE EXCEPTION 'Vorgang ist bereits beendet'; END IF;

  v_requested_ms := p_hours::bigint * 3600000;
  IF p_max_coins IS NOT NULL THEN
    v_requested_ms := least(v_requested_ms, p_max_coins::bigint * 300000);
  END IF;
  v_reduction_ms := least(v_requested_ms, v_remaining_ms);
  IF v_reduction_ms <= 0 THEN RAISE EXCEPTION 'Ungueltige Zeitverkuerzung'; END IF;

  -- Verbindliche ORVUNO-Regel: 1 Coin je angefangene 5 Minuten der wirklich verkuerzten Zeit.
  v_cost := greatest(1, ceil(v_reduction_ms::numeric / 300000)::integer);
  IF p_max_coins IS NOT NULL AND v_cost > p_max_coins THEN
    RAISE EXCEPTION 'Coin-Limit ueberschritten';
  END IF;

  SELECT balance INTO v_balance
  FROM public.coin_wallets
  WHERE user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coin-Wallet nicht gefunden'; END IF;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'Nicht genug Coins'; END IF;
  v_new_balance := v_balance - v_cost;

  -- Alle noch in der Zukunft liegenden Endzeitfelder desselben Vorgangs gemeinsam verschieben.
  FOREACH v_end_key IN ARRAY v_end_keys
  LOOP
    v_value := v_item->v_end_key;
    v_ms := private.orvuno_jsonb_time_ms(v_value);
    IF v_ms IS NULL OR v_ms <= v_now_ms THEN CONTINUE; END IF;
    v_new_end_ms := greatest(v_now_ms, v_ms - v_reduction_ms);
    IF jsonb_typeof(v_value) = 'number' THEN
      v_doc := jsonb_set(v_doc, v_target_path || v_end_key, to_jsonb(v_new_end_ms), false);
    ELSIF (v_value #>> '{}') ~ '^[0-9]+$' THEN
      v_doc := jsonb_set(v_doc, v_target_path || v_end_key, to_jsonb(v_new_end_ms::text), false);
    ELSE
      v_doc := jsonb_set(v_doc, v_target_path || v_end_key,
        to_jsonb(to_char(to_timestamp(v_new_end_ms / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), false);
    END IF;
  END LOOP;

  UPDATE public.coin_wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.coin_transactions(user_id, amount, balance_after, transaction_type, reference_type, reference_id, note)
  VALUES(
    v_user_id,
    -v_cost,
    v_new_balance,
    'time_reduction',
    p_action_kind,
    p_action_id,
    format('%s Coin(s) fuer %s Minuten Zeitverkuerzung (frei gewaehlt; 1 Coin je angefangene 5 Minuten)', v_cost, ceil(v_reduction_ms / 60000.0))
  );

  IF v_source = 'building' THEN
    v_building_state := v_doc;
    UPDATE public.companies SET building_state = v_building_state, saved_at = now() WHERE id = p_company_id;
  ELSE
    v_game_state := v_doc;
    UPDATE public.companies SET game_state = v_game_state, saved_at = now() WHERE id = p_company_id;
  END IF;

  v_item := v_doc #> v_target_path;
  v_new_end_ms := NULL;
  FOREACH v_end_key IN ARRAY v_end_keys
  LOOP
    v_new_end_ms := private.orvuno_jsonb_time_ms(v_item->v_end_key);
    EXIT WHEN v_new_end_ms IS NOT NULL AND v_new_end_ms > 0;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'costCoins', v_cost,
    'requestedCoinBudget', p_max_coins,
    'reducedMs', v_reduction_ms,
    'reducedMinutes', ceil(v_reduction_ms / 60000.0),
    'priceUnitMinutes', 5,
    'coinsPerUnit', 1,
    'newEndMs', v_new_end_ms,
    'newBalance', v_new_balance,
    'kind', p_action_kind,
    'actionId', p_action_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.shorten_company_timed_action(bigint,text,text,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shorten_company_timed_action(bigint,text,text,integer,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.shorten_company_timed_action(bigint,text,text,integer,integer) TO authenticated, service_role;
