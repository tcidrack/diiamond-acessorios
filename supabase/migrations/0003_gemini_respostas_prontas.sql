-- Respostas prontas (enviadas por palavra-chave, sem gastar IA) + troca da IA para o Google Gemini.
-- Rode no SQL Editor do Supabase (pode rodar mais de uma vez).
alter table ia_respostas add column if not exists automatica boolean not null default false;
alter table ia_respostas add column if not exists palavras_chave text[] not null default '{}';
alter table ia_respostas add column if not exists mensagem_exata boolean not null default false;

alter table ia_config alter column modelo set default 'gemini-flash-latest';
update ia_config set modelo = 'gemini-flash-latest' where modelo not like 'gemini%';
