-- Entrega: acima da faixa da taxa mínima, cobra só os km que PASSARAM da faixa.
-- Ex.: mínima R$ 3,00 até 3 km e R$ 1,00/km → 4 km = 3 + 1 = R$ 4,00 (antes cobrava 3 + 4 = R$ 7,00).

create or replace function calcular_entrega(p_cep text, p_lat double precision default null, p_lng double precision default null,
                                            p_km_rota numeric default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg config_loja;
  v_cep text := regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');
  v_reta numeric;
  v_km numeric;
  v_taxa numeric;
  v_pela_rua boolean := false;
begin
  select * into cfg from config_loja where id = 1;
  if cfg.origem_lat is null or cfg.origem_lng is null then
    return jsonb_build_object('ok', false, 'erro', 'A loja ainda não configurou o ponto de saída das entregas.'); end if;
  -- CEP opcional: a cliente digita só o endereço; o cálculo é pelo ponto (lat/lng) do endereço

  -- sem localização do CEP: o pedido segue e a loja combina o frete
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then
    return jsonb_build_object('ok', true, 'km', null, 'taxa', 0, 'a_combinar', true, 'sem_local', true);
  end if;

  -- Haversine (km, linha reta)
  v_reta := 2 * 6371 * asin(sqrt(
    power(sin(radians(p_lat - cfg.origem_lat) / 2), 2) +
    cos(radians(cfg.origem_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - cfg.origem_lng) / 2), 2)));

  -- km pelas ruas (mandado pelo celular) só vale se for plausível
  if p_km_rota is not null and p_km_rota >= v_reta * 0.95 and p_km_rota <= v_reta * 2.5 + 0.5 then
    v_km := round(p_km_rota, 1);
    v_pela_rua := true;
  else
    v_km := round(v_reta * cfg.entrega_fator_rota, 1);
  end if;

  if v_km > cfg.entrega_max_km then
    return jsonb_build_object('ok', true, 'km', v_km, 'taxa', 0, 'a_combinar', true, 'pela_rua', v_pela_rua);
  end if;
  -- entrega grátis perto da loja (até X km, ajustável no painel; 0 = desligado)
  if coalesce(cfg.entrega_gratis_km, 0) > 0 and v_km <= cfg.entrega_gratis_km then
    return jsonb_build_object('ok', true, 'km', v_km, 'taxa', 0, 'a_combinar', false, 'pela_rua', v_pela_rua, 'gratis_km', true);
  end if;
  v_taxa := case when v_km <= cfg.entrega_raio_km then cfg.entrega_taxa_base
                 else cfg.entrega_taxa_base + cfg.entrega_valor_km * ceil(v_km - cfg.entrega_raio_km) end;  -- só o km que passou da faixa
  return jsonb_build_object('ok', true, 'km', v_km, 'taxa', v_taxa, 'a_combinar', false, 'pela_rua', v_pela_rua);
end $$;

grant execute on function calcular_entrega(text, double precision, double precision, numeric) to anon, authenticated;
