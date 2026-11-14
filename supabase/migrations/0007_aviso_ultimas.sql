-- Botão em Configurações: mostrar ou não o aviso de "últimas unidades" (estoque de 1 a 3)
-- no card do produto ("Últimas N") e na página do produto ("Só resta 1 unidade!").
alter table config_loja add column if not exists mostrar_ultimas boolean not null default true;
