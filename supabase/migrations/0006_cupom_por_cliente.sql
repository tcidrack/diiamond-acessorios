-- Cupons: limite total (usos_max) + limite por cliente (usos_por_cliente).
-- Os usos passam a ser contados nos pedidos NÃO cancelados: cancelar um pedido devolve o cupom
-- para a loja e para a cliente; reativar o pedido gasta de novo. A cliente é identificada pelo WhatsApp.
-- A coluna cupons.usos deixa de ser usada.

alter table cupons add column if not exists usos_por_cliente int;
alter table cupons drop constraint if exists cupons_usos_por_cliente_check;
alter table cupons add constraint cupons_usos_por_cliente_check check (usos_por_cliente is null or usos_por_cliente > 0);

-- Mesmo WhatsApp com ou sem o 55 do Brasil conta como a mesma pessoa
create or replace function tel_cliente(p text)
returns text language sql immutable set search_path = public as $$
  select case when length(d) >= 12 and left(d, 2) = '55' then substr(d, 3) else d end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create index if not exists idx_pedidos_cupom on pedidos (cupom_codigo, tel_cliente(cliente_telefone))
  where cupom_codigo is not null and status <> 'cancelado';

drop function if exists validar_cupom(text, numeric);

-- Pré-visualiza o cupom no carrinho sem gastá-lo. Com telefone, confere também o limite por cliente.
create or replace function validar_cupom(p_codigo text, p_subtotal numeric, p_telefone text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c cupons;
  v_desc numeric;
  v_usados int;
  v_tel text := tel_cliente(p_telefone);
begin
  select * into c from cupons where upper(codigo) = upper(trim(p_codigo)) and ativo;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Cupom inválido'); end if;
  if c.validade is not null and c.validade < current_date then
    return jsonb_build_object('ok', false, 'erro', 'Cupom expirado'); end if;

  if c.usos_max is not null then
    select count(*) into v_usados from pedidos where cupom_codigo = c.codigo and status <> 'cancelado';
    if v_usados >= c.usos_max then return jsonb_build_object('ok', false, 'erro', 'Cupom esgotado'); end if;
  end if;

  if c.usos_por_cliente is not null and length(v_tel) >= 10 then
    select count(*) into v_usados from pedidos
     where cupom_codigo = c.codigo and status <> 'cancelado' and tel_cliente(cliente_telefone) = v_tel;
    if v_usados >= c.usos_por_cliente then
      return jsonb_build_object('ok', false, 'erro', case when c.usos_por_cliente = 1
        then 'Você já usou este cupom'
        else 'Você já usou este cupom ' || c.usos_por_cliente || ' vezes' end);
    end if;
  end if;

  if p_subtotal < c.minimo then
    return jsonb_build_object('ok', false, 'erro', 'Compra mínima de R$ ' || replace(to_char(c.minimo, 'FM999990.00'), '.', ',') || ' para este cupom'); end if;
  v_desc := case when c.tipo = 'percentual' then round(p_subtotal * c.valor / 100, 2) else c.valor end;
  return jsonb_build_object('ok', true, 'codigo', c.codigo, 'tipo', c.tipo, 'valor', c.valor,
    'desconto', least(v_desc, p_subtotal));
end $$;

grant execute on function validar_cupom(text, numeric, text) to anon, authenticated;

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
    select * into v_bairro from bairros_entrega where id = (p->>'bairro_id')::bigint and ativo;
    if not found then raise exception 'Escolha um bairro de entrega.'; end if;
    if length(trim(coalesce(p->>'endereco', ''))) < 5 then raise exception 'Informe o endereço de entrega.'; end if;
    v_taxa := v_bairro.taxa;
  end if;

  v_total := v_subtotal - v_desconto + v_taxa;

  if v_pag = 'dinheiro' and nullif(p->>'troco_para', '') is not null then
    v_troco := (p->>'troco_para')::numeric;
    if v_troco < v_total then raise exception 'O valor para troco precisa ser maior que o total.'; end if;
  end if;

  insert into pedidos (cliente_nome, cliente_telefone, tipo_entrega, bairro_id, bairro_nome, endereco,
    complemento, referencia, observacao, forma_pagamento, troco_para, subtotal, desconto, taxa_entrega,
    total, cupom_codigo, status)
  values (v_nome, v_tel, v_tipo, v_bairro.id, v_bairro.nome,
    case when v_tipo = 'entrega' then left(trim(p->>'endereco'), 300) end,
    left(trim(coalesce(p->>'complemento', '')), 120), left(trim(coalesce(p->>'referencia', '')), 160),
    left(trim(coalesce(p->>'observacao', '')), 500), v_pag, v_troco, v_subtotal, v_desconto, v_taxa,
    v_total, v_cupom->>'codigo',
    case when v_pag in ('pix', 'cartao_online') then 'aguardando_pagamento' else 'novo' end)
  returning * into v_pedido;

  insert into pedido_itens (pedido_id, produto_id, nome, imagem_url, preco_unitario, quantidade, subtotal)
  select v_pedido.id, (i->>'produto_id')::bigint, i->>'nome', i->>'imagem_url',
         (i->>'preco_unitario')::numeric, (i->>'quantidade')::int, (i->>'subtotal')::numeric
    from jsonb_array_elements(v_itens) i;

  return jsonb_build_object('codigo', v_pedido.codigo, 'token', v_pedido.token, 'total', v_pedido.total);
end $$;
