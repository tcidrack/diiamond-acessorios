import { ApiError, GoogleGenAI, type Content, type Part } from 'npm:@google/genai@2.28.0'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { encontrarRespostaPronta } from './respostas-prontas.js'

/**
 * O "cérebro" do atendimento no Direct. Usado pelo webhook do Instagram e pelo
 * simulador do painel (ia-responder) — os dois respondem exatamente igual.
 *
 * Ordem: 1) resposta pronta por palavra-chave (sem IA)  2) Google Gemini  3) se falhar, passa para a dona.
 */

export interface AudioCliente {
  url?: string // Instagram: URL temporária do arquivo
  data?: string // simulador: base64 já pronto
  mimeType?: string
}

export interface MensagemConversa {
  autor: 'cliente' | 'bot' | 'dona'
  texto: string
  audio?: AudioCliente | null // só para áudios ainda não transcritos
}

export interface Decisao {
  acao: 'responder' | 'passar_para_dona'
  resposta: string
  motivo: string
  origem: 'pronta' | 'ia' | 'erro'
  transcricao?: string
}

const SAIDA_SCHEMA = {
  type: 'object',
  properties: {
    acao: { type: 'string', enum: ['responder', 'passar_para_dona'] },
    resposta: { type: 'string', description: 'Texto exato enviado à cliente.' },
    motivo: { type: 'string', description: 'Frase curta explicando a decisão (só a dona vê).' },
    transcricao: { type: 'string', description: 'Se a cliente mandou áudio: o que ela falou, transcrito. Senão, vazio.' },
  },
  required: ['acao', 'resposta', 'motivo'],
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024

let gemini: GoogleGenAI | null = null
function cliente() {
  // GEMINI_API_KEY fica nos secrets do Supabase (Edge Functions > Secrets)
  gemini ??= new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY') || '' })
  return gemini
}

const brl = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`

async function montarContexto(db: SupabaseClient) {
  const [cfg, ia, respostas, exemplos, produtos, bairros] = await Promise.all([
    db.from('config_loja').select('*').eq('id', 1).single(),
    db.from('ia_config').select('*').eq('id', 1).single(),
    db.from('ia_respostas').select('pergunta, resposta, automatica, palavras_chave, mensagem_exata, ativo').eq('ativo', true).order('id'),
    db.from('ia_exemplos').select('cliente, resposta').eq('ativo', true).order('id', { ascending: false }).limit(60),
    db.from('produtos').select('nome, slug, material, preco, preco_promocional, estoque, descricao, categoria:categorias(nome)').eq('ativo', true).order('ordem').limit(400),
    db.from('bairros_entrega').select('nome, taxa').eq('ativo', true).order('ordem'),
  ])
  return {
    loja: cfg.data,
    ia: ia.data,
    respostas: respostas.data || [],
    exemplos: exemplos.data || [],
    produtos: produtos.data || [],
    bairros: bairros.data || [],
  }
}

type Contexto = Awaited<ReturnType<typeof montarContexto>>

function promptSistema({ loja, ia, respostas, exemplos, produtos, bairros }: Contexto): string {
  const site = (loja?.url_loja || '').replace(/\/$/, '')
  const catalogo = produtos.map((p: any) => {
    const promo = p.preco_promocional !== null && Number(p.preco_promocional) < Number(p.preco)
    const preco = promo ? `${brl(p.preco_promocional)} (de ${brl(p.preco)}, em promoção)` : brl(p.preco)
    const estoque = p.estoque === null ? 'disponível' : p.estoque > 0 ? `${p.estoque} em estoque` : 'ESGOTADO'
    const link = site ? ` | link: ${site}/produto/${p.slug}` : ''
    const desc = p.descricao ? ` | ${String(p.descricao).replace(/\s+/g, ' ').slice(0, 160)}` : ''
    return `- ${p.nome} | ${p.categoria?.nome || 'sem categoria'} | ${p.material || ''} | ${preco} | ${estoque}${link}${desc}`
  }).join('\n')

  const entrega = bairros.length
    ? bairros.map((b: any) => `- ${b.nome}: ${Number(b.taxa) > 0 ? brl(b.taxa) : 'grátis'}`).join('\n')
    : 'Sem entrega cadastrada no momento: só retirada.'

  return `Você atende o Direct do Instagram da loja ${loja?.nome || 'Diiamond Acessórios'} (@${loja?.instagram || ''}), uma loja de semijoias e acessórios. Você fala em nome da loja${ia?.nome_atendente ? `, como "${ia.nome_atendente}"` : ''}. Quem lê é cliente pelo celular.

# Jeito de escrever
${ia?.tom || 'Simpática, próxima e objetiva.'}
Escreva como a dona escreve nos exemplos abaixo: mesmo tamanho de mensagem, mesmas expressões, mesmo uso de emoji. Mensagens curtas (1 a 3 frases), em português do Brasil, sem markdown, sem listas longas.

# O que você pode fazer sozinha
- Tirar dúvidas sobre produtos, preços, promoções, estoque, materiais, entrega, retirada e formas de pagamento, usando SÓ as informações abaixo.
- Mandar o link do produto (ou do site) para a cliente comprar. Todo pedido é feito pelo site: lá ela escolhe as peças, entrega ou retirada e paga.
- Sugerir peças parecidas quando algo estiver esgotado.

# Quando passar para a dona (acao = "passar_para_dona")
- Reclamação, defeito, troca, devolução, atraso, problema com pedido ou pagamento.
- Pedido de desconto, condição especial, encomenda, peça que não está no catálogo, atacado ou parceria.
- A cliente pede para falar com a dona/uma pessoa, ou está irritada.
- Qualquer coisa que você não consiga responder com certeza a partir das informações abaixo. Nunca invente preço, prazo, estoque, política ou informação que não esteja aqui.
Nesses casos, em "resposta" escreva uma mensagem curta e acolhedora avisando que a dona vai responder (no estilo dela). Modelo: "${ia?.msg_transferencia || ''}"

# Saída
- acao: "responder" ou "passar_para_dona".
- resposta: o texto exato que será enviado à cliente.
- motivo: uma frase curta explicando a decisão (só a dona vê).
- transcricao: se a cliente mandou áudio, escreva o que ela falou. Se não der para entender o áudio, passe para a dona.
Se a mensagem da cliente for só um emoji, figurinha, "ok", "obrigada" ou algo que não pede resposta, responda de forma curtinha e simpática.

${ia?.regras ? `# Regras da dona (siga sempre)\n${ia.regras}\n\n` : ''}# Informações da loja
- Site: ${site || '(link da bio)'}
- WhatsApp: ${loja?.whatsapp || 'não informado'}
- Horário: ${loja?.horario || 'não informado'}
- Retirada: ${loja?.endereco_retirada || 'combinar com a loja'}
- Pagamento: Pix (pelo site; a cliente confirma no site que pagou), dinheiro ou cartão na maquininha na entrega/retirada.
- Pedido mínimo: ${Number(loja?.pedido_minimo) > 0 ? brl(loja.pedido_minimo) : 'não tem'}
- Loja ${loja?.aberta === false ? 'FECHADA para pedidos no momento' : 'aberta para pedidos'}

# Taxas de entrega por bairro
${entrega}

# Respostas padrão ensinadas pela dona (use quando a pergunta for parecida, adaptando ao contexto)
${respostas.length ? respostas.map((r: any) => `Pergunta: ${r.pergunta}\nResposta: ${r.resposta}`).join('\n\n') : '(nenhuma ainda)'}

# Exemplos de como a dona responde (imite o estilo)
${exemplos.length ? exemplos.map((e: any) => `Cliente: ${e.cliente}\nDona: ${e.resposta}`).join('\n\n') : '(nenhum ainda)'}

# Catálogo atual (${produtos.length} produtos ativos)
${catalogo || '(catálogo vazio)'}`
}

/** Se a cliente citar um código de pedido (DM1234), anexa o status para a IA. */
async function infoPedidos(db: SupabaseClient, texto: string): Promise<string> {
  const codigos = [...new Set((texto.toUpperCase().match(/\bDM\s?\d{3,6}\b/g) || []).map((c) => c.replace(/\s/g, '')))].slice(0, 3)
  if (!codigos.length) return ''
  const { data } = await db.from('pedidos').select('codigo, status, tipo_entrega, created_at').in('codigo', codigos)
  if (!data?.length) return `\n\n[Info do sistema: nenhum pedido encontrado com o código ${codigos.join(', ')}.]`
  return '\n\n[Info do sistema, não mostrar literalmente: ' + data.map((p: any) => `pedido ${p.codigo} está com status "${p.status}" (${p.tipo_entrega})`).join('; ') + ']'
}

async function baixarAudio(audio: AudioCliente): Promise<Part> {
  if (audio.data) {
    if (audio.data.length > MAX_AUDIO_BYTES * 1.4) throw new Error('áudio grande demais')
    return { inlineData: { data: audio.data, mimeType: audio.mimeType || 'audio/mp4' } }
  }
  if (!audio.url) throw new Error('áudio sem endereço')
  const resp = await fetch(audio.url)
  if (!resp.ok) throw new Error(`não consegui baixar o áudio (${resp.status})`)
  const bytes = new Uint8Array(await resp.arrayBuffer())
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error('áudio grande demais')
  const tipo = (resp.headers.get('content-type') || '').split(';')[0]
  return { inlineData: { data: encodeBase64(bytes), mimeType: tipo.startsWith('audio/') || tipo.startsWith('video/') ? tipo : 'audio/mp4' } }
}

/** Histórico no formato do Gemini: cliente = user, loja = model. Áudios ainda não transcritos vão como arquivo. */
async function montarConversa(historico: MensagemConversa[]): Promise<Content[]> {
  const conteudo: Content[] = []
  for (const m of historico) {
    const role = m.autor === 'cliente' ? 'user' : 'model'
    const partes: Part[] = []
    if (m.audio) {
      partes.push({ text: '[a cliente mandou este áudio:]' })
      partes.push(await baixarAudio(m.audio))
    } else {
      partes.push({ text: (m.texto || '').trim() || '[anexo/figurinha]' })
    }
    const ultima = conteudo[conteudo.length - 1]
    if (ultima && ultima.role === role) ultima.parts!.push(...partes)
    else conteudo.push({ role, parts: partes })
  }
  while (conteudo.length && conteudo[0].role !== 'user') conteudo.shift()
  return conteudo
}

/** Mensagens da cliente desde a última resposta da loja. */
function mensagensNovas(historico: MensagemConversa[]): MensagemConversa[] {
  const novas: MensagemConversa[] = []
  for (let i = historico.length - 1; i >= 0 && historico[i].autor === 'cliente'; i--) novas.unshift(historico[i])
  return novas
}

export async function decidirResposta(db: SupabaseClient, historico: MensagemConversa[]): Promise<Decisao> {
  const contexto = await montarContexto(db)
  const transferir = (motivo: string, origem: Decisao['origem'] = 'erro'): Decisao => ({
    acao: 'passar_para_dona',
    resposta: contexto.ia?.msg_transferencia || 'Já vou chamar a dona pra te responder! 💖',
    motivo,
    origem,
  })

  const recentes = historico.slice(-24)
  const novas = mensagensNovas(recentes)
  if (!novas.length) return transferir('Não há mensagem nova da cliente para responder.')
  const temAudio = novas.some((m) => m.audio)

  // 1) resposta pronta: não gasta IA (áudio sempre vai para a IA, não há texto para comparar)
  if (!temAudio) {
    const pronta = encontrarRespostaPronta(novas.map((m) => m.texto).join(' '), contexto.respostas)
    if (pronta) return { acao: 'responder', resposta: pronta.resposta, motivo: `Resposta pronta: "${pronta.pergunta}"`, origem: 'pronta' }
  }

  // 2) Gemini
  let conversa: Content[]
  try {
    conversa = await montarConversa(recentes)
  } catch (e) {
    return {
      ...transferir(`Não consegui abrir o áudio: ${e instanceof Error ? e.message : e}`),
      resposta: 'Recebi seu áudio! 💖 Já vou chamar a dona pra te responder direitinho.',
    }
  }
  if (!conversa.length || conversa[conversa.length - 1].role !== 'user') return transferir('Não há mensagem nova da cliente para responder.')
  const info = await infoPedidos(db, novas.map((m) => m.texto).join(' '))
  if (info) conversa[conversa.length - 1].parts!.push({ text: info.trim() })

  try {
    const resposta = await cliente().models.generateContent({
      model: contexto.ia?.modelo || 'gemini-flash-latest',
      contents: conversa,
      config: {
        systemInstruction: promptSistema(contexto),
        responseMimeType: 'application/json',
        responseJsonSchema: SAIDA_SCHEMA,
        temperature: 0.6,
        maxOutputTokens: 1500,
      },
    })
    const saida = JSON.parse(resposta.text || '{}')
    if (!['responder', 'passar_para_dona'].includes(saida.acao) || !String(saida.resposta || '').trim()) {
      return transferir('A IA não devolveu uma resposta válida.')
    }
    return {
      acao: saida.acao,
      resposta: String(saida.resposta).trim(),
      motivo: String(saida.motivo || ''),
      origem: 'ia',
      transcricao: temAudio && saida.transcricao ? String(saida.transcricao).trim() : undefined,
    }
  } catch (e) {
    console.error('Erro no Gemini:', e)
    if (e instanceof ApiError && e.status === 429) {
      return transferir('Limite gratuito do Gemini atingido por agora (muitas mensagens seguidas). Volta sozinho em alguns minutos.')
    }
    if (e instanceof ApiError && (e.status === 400 || e.status === 403)) {
      return transferir(`O Gemini recusou a chamada (${e.status}): confira a GEMINI_API_KEY e o modelo escolhido. ${e.message}`)
    }
    return transferir(`Erro ao consultar a IA: ${e instanceof Error ? e.message : String(e)}`)
  }
}
