# Diiamond Acessórios — Loja online

Loja virtual da @diiamondacessorios. O cliente pesquisa, monta o carrinho, escolhe entrega (taxa por bairro) ou retirada e paga com Pix (confirma no site que pagou), dinheiro ou cartão na maquininha. A dona recebe o pedido no painel com alerta sonoro e pelo WhatsApp. Um assistente de IA responde o Direct do Instagram no estilo da dona.

- **Loja:** `/` · produto `/produto/:slug` · `/checkout` · acompanhamento `/pedido/:codigo?t=…`
- **Painel:** `/admin` (pedidos, produtos, categorias, entrega, cupons, configurações, Direct, Assistente IA)

## Ver funcionando agora (modo demonstração)

Sem configurar nada, o site abre em **modo demonstração**: produtos de exemplo, tudo salvo só no navegador.

```bash
npm install
npm run dev
```

Abra http://localhost:5173 (loja) e http://localhost:5173/admin (painel: qualquer e-mail, senha `demo`).

## Colocar no ar de verdade

### 1. Supabase (banco, login, fotos)
1. Crie um projeto novo em https://supabase.com (plano grátis serve).
2. **SQL Editor** → cole todo o arquivo `supabase/migrations/0001_schema.sql` → **Run**.
3. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up** (só a dona entra no painel).
4. **Authentication → Users → Add user**: crie os logins do painel (ex.: e-mail da loja e e-mail da dona, com senha forte).
5. **SQL Editor** → libere esses usuários como admin:
   ```sql
   insert into admins (user_id)
   select id from auth.users where email in ('EMAIL_DA_LOJA', 'EMAIL_DA_DONA')
   on conflict do nothing;
   ```
   Rode também `0002_ia_modo_teste.sql`, `0003_gemini_respostas_prontas.sql` e `0004_pix_informado.sql`.
6. **Project Settings → API**: copie a *Project URL* e a chave *anon public*.

### 2. Site (Vercel)
1. Suba esta pasta para um repositório no GitHub e importe em https://vercel.com.
2. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chave anon
3. Deploy. Para rodar local com o banco de verdade, copie `.env.example` para `.env` e preencha.

Publicação automática: o projeto da Vercel está ligado a este repositório. Todo `git push` na branch `main` publica o site em https://diiamond-acessorios.vercel.app; outras branches geram um link de prévia.

### 3. Primeiro acesso ao painel
Entre em `/admin` e, em **Configurações**, preencha WhatsApp, chave Pix (nome e cidade do recebedor), local de retirada e o **endereço do site** (a IA usa para mandar links). Depois cadastre os **bairros** em Entrega e os **produtos**.

Cada login pode trocar a própria senha em **Configurações → Senha de acesso**.

Dica: no celular, abra o painel no navegador e use "Adicionar à tela inicial". Toque em **🔔 Ativar alertas** para ouvir o som a cada pedido novo (o painel precisa ficar aberto).

### 4. Assistente IA no Direct
Guia completo em [`docs/instagram-setup.md`](docs/instagram-setup.md). As telas **Direct** e **Assistente IA** ficam escondidas no painel até você adicionar `VITE_IA_ATIVA=true` nas variáveis da Vercel e publicar de novo.

## Como funciona por dentro

| Parte | Onde |
|---|---|
| Tabelas, segurança (RLS), regras de pedido/estoque/cupom | `supabase/migrations/0001_schema.sql` |
| Criação do pedido (recalcula preços no servidor, baixa estoque, trava concorrência) | função SQL `criar_pedido` |
| Pix informado | a cliente toca em "Já fiz o Pix" (função SQL `informar_pix_enviado`) e o painel avisa com som |
| Pix copia e cola / QR | `src/lib/pix.js` (padrão BR Code do Banco Central) |
| Acesso a dados (Supabase ou demonstração) | `src/lib/api.js`, `api-supabase.js`, `api-demo.js` |
| IA (Google Gemini) + respostas prontas | `supabase/functions/_shared/agente.ts`, `respostas-prontas.js` |
| Webhook do Instagram | `supabase/functions/instagram-webhook` |

Cancelar um pedido no painel devolve as peças ao estoque automaticamente.

## Pontos de atenção
- **Pedidos Pix sem pagamento** seguram o estoque até a dona cancelar. Confira a aba "Aguardando Pix" de vez em quando.
- **Confirme o Pix no app do banco** antes de marcar como pago: "Já fiz o Pix" é só um aviso da cliente.
- O alerta sonoro só toca com o painel aberto. O aviso garantido é a mensagem que o cliente manda no WhatsApp ao finalizar.
