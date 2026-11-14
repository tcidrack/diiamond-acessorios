-- Cartão online pelo Checkout Integrado da InfinitePay.
-- O link é criado pela function infinitepay-link; quem confirma o pagamento é a function
-- infinitepay-webhook (sempre conferindo na API da InfinitePay, o webhook não tem assinatura).

alter table pedidos drop constraint if exists pedidos_forma_pagamento_check;
alter table pedidos add constraint pedidos_forma_pagamento_check
  check (forma_pagamento in ('pix', 'dinheiro', 'cartao', 'cartao_online'));

alter table pedidos add column if not exists pagamento_link text;
alter table pedidos add column if not exists pagamento_slug text;
alter table pedidos add column if not exists pagamento_nsu text;
alter table pedidos add column if not exists pagamento_parcelas int;
alter table pedidos add column if not exists pagamento_recibo text;
alter table pedidos add column if not exists pago_em timestamptz;

-- InfiniteTag da loja (sem o $). Vazio = opção "Cartão online" escondida no checkout.
alter table config_loja add column if not exists infinitepay_handle text default '';

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
    v_cupom := validar_cupom(p->>'cupom', v_subtotal);
    if not (v_cupom->>'ok')::boolean then raise exception '%', v_cupom->>'erro'; end if;
    v_desconto := (v_cupom->>'desconto')::numeric;
    update cupons set usos = usos + 1 where codigo = v_cupom->>'codigo';
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

-- O cliente não precisa ver o NSU da transação
create or replace function consultar_pedido(p_codigo text, p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pedido', to_jsonb(pd) - 'id' - 'token' - 'comprovante_path' - 'pagamento_nsu' || jsonb_build_object('tem_comprovante', pd.comprovante_path is not null),
    'itens', coalesce((select jsonb_agg(to_jsonb(i) - 'id' - 'pedido_id' order by i.id) from pedido_itens i where i.pedido_id = pd.id), '[]'::jsonb)
  )
  from pedidos pd where pd.codigo = p_codigo and pd.token = p_token;
$$;
