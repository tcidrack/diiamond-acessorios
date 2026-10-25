-- Cliente confirma no site que já fez o Pix (sem enviar arquivo de comprovante).
-- Reaproveita comprovante_enviado_em como "Pix informado em": o painel já toca o alerta quando ele muda.
create or replace function informar_pix_enviado(p_codigo text, p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update pedidos set comprovante_enviado_em = coalesce(comprovante_enviado_em, now()),
    status = case when status in ('novo', 'aguardando_pagamento') then 'pagamento_enviado' else status end
   where codigo = p_codigo and token = p_token and forma_pagamento = 'pix' and status <> 'cancelado';
  if not found then raise exception 'Pedido não encontrado.'; end if;
  return true;
end $$;

grant execute on function informar_pix_enviado(text, uuid) to anon, authenticated;
