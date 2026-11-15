-- Checkout sem CEP: a cliente digita rua, número e bairro; a entrega é calculada pelo ponto exato do endereço.
-- Quando o mapa não conhece o número da casa, usa a rua/bairro e o pedido fica marcado como distância aproximada.

alter table pedidos add column if not exists entrega_aproximada boolean not null default false;

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
                 else cfg.entrega_taxa_base + cfg.entrega_valor_km * ceil(v_km) end;
  return jsonb_build_object('ok', true, 'km', v_km, 'taxa', v_taxa, 'a_combinar', false, 'pela_rua', v_pela_rua);
end $$;

grant execute on function calcular_entrega(text, double precision, double precision, numeric) to anon, authenticated;

create or replace function criar_pedido(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg config_loja;
  item jsonb;
  prod produtos;
  v_qtd int;
  v_preco numeric;
  v_subtotal numeric := 0;
  v_desconto numeric := 0;
  v_taxa numeric := 0;
  v_total numeric;
  v_bairro bairros_entrega;
  v_bairro_nome text;
  v_cep text := regexp_replace(coalesce(p->>'cep', ''), '\D', '', 'g');
  v_km numeric;
  v_combinar boolean := false;
  v_frete jsonb;
  v_cupom jsonb;
  v_pedido pedidos;
  v_nome text := trim(coalesce(p->>'cliente_nome', ''));
  v_tel text := regexp_replace(coalesce(p->>'cliente_telefone', ''), '\D', '', 'g');
  v_tipo text := p->>'tipo_entrega';
  v_pag text := p->>'forma_pagamento';
  v_troco numeric;
  v_itens jsonb := '[]'::jsonb;
  v_img text;
begin
  select * into cfg from config_loja where id = 1;
  if not cfg.aberta then raise exception 'A loja está fechada para pedidos no momento.'; end if;

  if length(v_nome) < 2 or length(v_nome) > 80 then raise exception 'Informe seu nome.'; end if;
  if length(v_tel) < 10 or length(v_tel) > 13 then raise exception 'Informe um WhatsApp válido com DDD.'; end if;
  if v_tipo not in ('entrega', 'retirada') then raise exception 'Escolha entrega ou retirada.'; end if;
  if v_pag not in ('pix', 'dinheiro', 'cartao', 'cartao_online')
     or (v_pag = 'cartao_online' and coalesce(cfg.infinitepay_handle, '') = '') then raise exception 'Escolha a forma de pagamento.'; end if;

  if jsonb_typeof(p->'itens') <> 'array' or jsonb_array_length(p->'itens') = 0 then
    raise exception 'Seu carrinho está vazio.'; end if;
  if jsonb_array_length(p->'itens') > 60 then raise exception 'Carrinho grande demais.'; end if;

  -- trava as linhas dos produtos para o estoque não ficar negativo em pedidos simultâneos
  for item in select * from jsonb_array_elements(p->'itens') loop
    v_qtd := (item->>'quantidade')::int;
    if v_qtd is null or v_qtd < 1 or v_qtd > 50 then raise exception 'Quantidade inválida.'; end if;

    select * into prod from produtos where id = (item->>'produto_id')::bigint and ativo for update;
    if not found then raise exception 'Um produto do carrinho não está mais disponível.'; end if;
    if prod.estoque is not null and prod.estoque < v_qtd then
      raise exception 'Estoque insuficiente de "%" (restam %).', prod.nome, prod.estoque; end if;

    v_preco := case when prod.preco_promocional is not null and prod.preco_promocional < prod.preco
                    then prod.preco_promocional else prod.preco end;
    v_subtotal := v_subtotal + v_preco * v_qtd;
    select url into v_img from produto_imagens where produto_id = prod.id order by ordem, id limit 1;
    v_itens := v_itens || jsonb_build_object('produto_id', prod.id, 'nome', prod.nome, 'imagem_url', v_img,
      'preco_unitario', v_preco, 'quantidade', v_qtd, 'subtotal', v_preco * v_qtd);

    if prod.estoque is not null then
      update produtos set estoque = estoque - v_qtd where id = prod.id;
    end if;
  end loop;

  if v_subtotal < cfg.pedido_minimo then
    raise exception 'O pedido mínimo é de R$ %.', replace(to_char(cfg.pedido_minimo, 'FM999990.00'), '.', ','); end if;

  if nullif(trim(coalesce(p->>'cupom', '')), '') is not null then
    -- trava o cupom: dois pedidos ao mesmo tempo não passam do limite
    perform 1 from cupons where upper(codigo) = upper(trim(p->>'cupom')) for update;
    v_cupom := validar_cupom(p->>'cupom', v_subtotal, v_tel);
    if not (v_cupom->>'ok')::boolean then raise exception '%', v_cupom->>'erro'; end if;
    v_desconto := (v_cupom->>'desconto')::numeric;
  end if;

  if v_tipo = 'entrega' then
    if length(trim(coalesce(p->>'endereco', ''))) < 5 then raise exception 'Informe o endereço de entrega.'; end if;
    if coalesce(cfg.entrega_modo, 'bairros') = 'distancia' then
      -- a taxa é recalculada aqui no banco; o navegador só manda o CEP e a localização dele
      v_frete := calcular_entrega(v_cep, (nullif(p->>'lat', ''))::double precision, (nullif(p->>'lng', ''))::double precision,
                                  (nullif(p->>'km_rota', ''))::numeric);
      if not (v_frete->>'ok')::boolean then raise exception '%', v_frete->>'erro'; end if;
      v_km := (v_frete->>'km')::numeric;
      v_combinar := (v_frete->>'a_combinar')::boolean;
      v_taxa := (v_frete->>'taxa')::numeric;
      v_bairro_nome := left(coalesce(nullif(trim(p->>'bairro'), ''), v_frete->>'bairro', ''), 80);
    else
      select * into v_bairro from bairros_entrega where id = (p->>'bairro_id')::bigint and ativo;
      if not found then raise exception 'Escolha um bairro de entrega.'; end if;
      v_taxa := v_bairro.taxa;
      v_bairro_nome := v_bairro.nome;
    end if;
  end if;

  -- entrega grátis a partir de um valor (subtotal já com desconto); frete a combinar continua a combinar
  if v_tipo = 'entrega' and coalesce(cfg.entrega_gratis_acima, 0) > 0
     and not coalesce(v_combinar, false) and v_subtotal - v_desconto >= cfg.entrega_gratis_acima then
    v_taxa := 0;
  end if;

  v_total := v_subtotal - v_desconto + v_taxa;

  if v_pag = 'dinheiro' and nullif(p->>'troco_para', '') is not null then
    v_troco := (p->>'troco_para')::numeric;
    if v_troco < v_total then raise exception 'O valor para troco precisa ser maior que o total.'; end if;
  end if;

  insert into pedidos (cliente_nome, cliente_telefone, tipo_entrega, bairro_id, bairro_nome, endereco,
    complemento, referencia, observacao, forma_pagamento, troco_para, subtotal, desconto, taxa_entrega,
    total, cupom_codigo, status, cep, distancia_km, entrega_a_combinar, entrega_aproximada)
  values (v_nome, v_tel, v_tipo, v_bairro.id, v_bairro_nome,
    case when v_tipo = 'entrega' then left(trim(p->>'endereco'), 300) end,
    left(trim(coalesce(p->>'complemento', '')), 120), left(trim(coalesce(p->>'referencia', '')), 160),
    left(trim(coalesce(p->>'observacao', '')), 500), v_pag, v_troco, v_subtotal, v_desconto, v_taxa,
    v_total, v_cupom->>'codigo',
    case when v_pag in ('pix', 'cartao_online') then 'aguardando_pagamento' else 'novo' end,
    case when v_tipo = 'entrega' and v_cep <> '' then v_cep end, v_km, v_combinar,
    v_tipo = 'entrega' and v_km is not null and coalesce((nullif(p->>'aproximado', ''))::boolean, false))
  returning * into v_pedido;

  insert into pedido_itens (pedido_id, produto_id, nome, imagem_url, preco_unitario, quantidade, subtotal)
  select v_pedido.id, (i->>'produto_id')::bigint, i->>'nome', i->>'imagem_url',
         (i->>'preco_unitario')::numeric, (i->>'quantidade')::int, (i->>'subtotal')::numeric
    from jsonb_array_elements(v_itens) i;

  return jsonb_build_object('codigo', v_pedido.codigo, 'token', v_pedido.token, 'total', v_pedido.total);
end $$;

grant execute on function criar_pedido(jsonb) to anon, authenticated;
