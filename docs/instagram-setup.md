# Conectar o Assistente IA ao Direct do Instagram

O assistente lê cada DM (texto ou **áudio**) e responde pela API oficial da Meta. Primeiro tenta uma **resposta pronta** por palavra-chave (sem gastar IA); se nenhuma servir, usa o **Google Gemini** (plano gratuito) com o catálogo, as respostas e os exemplos que a dona ensinou. Quando não sabe, ou o assunto é reclamação/troca/desconto, ele avisa a cliente que a dona vai responder e marca a conversa em **Painel → Direct**.

> Faça antes os passos do `README.md` (Supabase + site no ar).

## 1. Chave do Google Gemini (grátis)
1. Entre em https://aistudio.google.com com uma conta Google e clique em **Get API key → Create API key**.
2. Não precisa cadastrar cartão: o plano gratuito tem limite de mensagens por minuto e por dia (sobra para uma loja). Se estourar, o bot passa a conversa para a dona até o limite voltar.
3. O modelo padrão é o **Gemini Flash** (sempre o mais novo). Dá para trocar em *Assistente IA → Configuração*.
4. Atenção: no plano gratuito o Google pode usar as conversas para melhorar os produtos dele.

## 2. App na Meta
Pré-requisito: @diiamondacessorios como conta **Profissional** (já é) e a dona como administradora.

1. Em https://developers.facebook.com → **Meus apps → Criar app** → tipo **Empresa (Business)**.
2. Adicione o produto **Instagram** → **API com login do Instagram**.
3. Em **Gerar tokens de acesso**, conecte a conta @diiamondacessorios e copie o **token** (de longa duração).
4. Anote o **ID da conta do Instagram** (aparece ao lado da conta conectada). É o `IG_USER_ID`.
5. Em **Configurações do app → Básico**, copie a **Chave secreta do app**. É o `IG_APP_SECRET`.

> Se preferir conectar pela Página do Facebook (Messenger API para Instagram), use `IG_API_BASE=https://graph.facebook.com/v23.0`, `IG_ACCOUNT_ID=<id da Página>` e o token da Página.

## 3. Publicar as funções no Supabase
Instale a CLI (https://supabase.com/docs/guides/cli) e, nesta pasta:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF

supabase secrets set GEMINI_API_KEY=...        # chave do passo 1
supabase secrets set IG_ACCESS_TOKEN=...       # token do passo 2.3
supabase secrets set IG_USER_ID=...            # id da conta do passo 2.4
supabase secrets set IG_APP_SECRET=...         # chave secreta do passo 2.5
supabase secrets set IG_VERIFY_TOKEN=uma-frase-secreta-qualquer

supabase functions deploy ia-responder
supabase functions deploy instagram-enviar
supabase functions deploy ia-importar-historico
supabase functions deploy instagram-webhook --no-verify-jwt
```

Agora o **simulador** do painel (*Assistente IA → Testar o bot*) já usa a IA de verdade, mesmo antes de ligar o Instagram.

## 4. Webhook
1. No app da Meta → **Instagram → Configurar webhooks**:
   - **URL de callback:** `https://SEU_PROJECT_REF.supabase.co/functions/v1/instagram-webhook`
   - **Token de verificação:** o mesmo `IG_VERIFY_TOKEN`
2. Clique em **Verificar e salvar** e assine o campo **messages**.
3. Ative as mensagens para o app na conta (botão no mesmo painel, se aparecer).

## 5. Ensinar e testar
1. *Assistente IA → Meu jeito de responder → Importar minhas respostas antigas do Direct*: traz conversas passadas. Elas chegam desligadas; ligue só as que têm o jeito da dona.
2. Em **Respostas prontas**, cadastre as perguntas mais comuns. Marque **Enviar automático (sem IA)** e as palavras-chave (ex.: `entreg*, frete`) para o bot responder na hora sem usar a IA; para “oi”/“bom dia” ligue “só se a mensagem for exatamente isso”. Preencha também as **Regras** (o que nunca fazer) em Configuração.
3. Teste no simulador (dá para gravar um áudio pelo 🎤). Se uma resposta não ficou boa, toque em **corrigir**: a correção vira exemplo.
4. Em *Configuração*, deixe o **Modo teste** ligado e coloque os @ que podem receber resposta (ex.: sua conta pessoal). Os outros clientes não recebem resposta do bot, mas as mensagens aparecem no Direct do painel.
5. Ligue o interruptor no topo. Quando estiver satisfeita, desligue o modo teste para o bot atender todo mundo.

> Banco criado antes dessas funções existirem? Rode no SQL Editor `supabase/migrations/0002_ia_modo_teste.sql` e `0003_gemini_respostas_prontas.sql`.

## Modo desenvolvimento x clientes reais
Enquanto o app está em **modo desenvolvimento**, a Meta só entrega mensagens de contas com função no app (adicione a sua em *Funções do app → Testadores do Instagram*). Para atender **todas as clientes**:
1. Faça a **Verificação da empresa** (Business Verification).
2. Peça **Acesso avançado** à permissão `instagram_business_manage_messages` no **App Review**, com um vídeo curto mostrando o painel respondendo.
3. Coloque o app em modo **Ao vivo**.

A análise da Meta costuma levar alguns dias.

## Como o bot se comporta
- Espera cerca de 6 segundos antes de responder, para juntar mensagens seguidas da cliente.
- Se a dona responder uma conversa (pelo painel ou pelo app do Instagram), o bot fica quieto nela pelo tempo de **pausa** configurado (padrão 12h).
- Fora do horário configurado, não responde.
- A Meta só permite responder até **24h** depois da última mensagem da cliente.
- Se a cliente citar um código de pedido (ex.: DM1023), o bot vê o status do pedido para responder.
- Áudios: o Gemini ouve, responde e o painel mostra o que a cliente falou (🎤 transcrição). Áudio que não abrir (muito grande ou erro) vai para a dona.
