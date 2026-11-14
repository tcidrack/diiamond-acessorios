-- Cores do mesmo modelo: cada cor continua sendo um produto (preço, estoque e fotos próprios).
-- Produtos com o mesmo grupo_cor aparecem como bolinhas de cor no card e na página uns dos outros.
alter table produtos add column if not exists grupo_cor uuid;
alter table produtos add column if not exists cor_nome text default '';
alter table produtos add column if not exists cor_hex text default '';
create index if not exists idx_produtos_grupo_cor on produtos (grupo_cor) where grupo_cor is not null;
