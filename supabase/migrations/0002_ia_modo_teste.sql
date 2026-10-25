-- Modo teste do Assistente IA: quando ligado, o bot só responde os @ da lista.
-- Rode no SQL Editor do Supabase (pode rodar mais de uma vez).
alter table ia_config add column if not exists modo_teste boolean not null default true;
alter table ia_config add column if not exists usernames_teste text[] not null default '{}';
