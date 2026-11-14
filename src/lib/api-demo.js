import { precoFinal } from './precos.js'
import { calcularFrete } from './entrega.js'
import { buscarCep } from './cep.js'
import { rotaKm } from './geoapify.js'
import { encontrarRespostaPronta } from './respostas-prontas.js'

/**
 * MODO DEMONSTRAÇÃO — roda sem Supabase, guardando tudo no localStorage do navegador.
 * Serve para ver a loja funcionando antes de criar o projeto no Supabase.
 * Imita as regras do banco (supabase/migrations/0001_schema.sql): estoque, cupom, taxa, status.
 * Login do painel na demonstração: qualquer e-mail com a senha "demo".
 */

const CHAVE = 'diamond-demo-v3' // v3: cores do mesmo modelo
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('diamond-demo') : null
const ouvintes = new Set()

function foto(cor1, cor2, simbolo) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cor1}"/><stop offset="1" stop-color="${cor2}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="230" font-size="120" text-anchor="middle" fill="#fff" fill-opacity=".85" font-family="Georgia">${simbolo}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function seed() {
  const categorias = [
    ['Anéis', 'aneis'], ['Brincos', 'brincos'], ['Argolas', 'argolas'], ['Colares', 'colares'],
    ['Correntes', 'correntes'], ['Pulseiras', 'pulseiras'], ['Braceletes', 'braceletes'],
    ['Conjuntos e Kits', 'conjuntos'], ['Piranhas', 'piranhas'], ['Relógios', 'relogios'],
  ].map(([nome, slug], i) => ({ id: i + 1, nome, slug, ordem: i + 1, ativo: true }))

  const p = (id, nome, categoria_id, material, preco, preco_promocional, estoque, destaque, simbolo, cores) => ({
    id, nome, slug: nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'),
    descricao: `${nome} em ${material.toLowerCase()}. Peça delicada, ótima para o dia a dia e para presentear. Acompanha embalagem para presente.`,
    categoria_id, material, preco, preco_promocional, estoque, ativo: true, destaque, ordem: id,
    grupo_cor: null, cor_nome: '', cor_hex: '',
    created_at: new Date().toISOString(),
  })

  const produtos = [
    p(1, 'Anel Solitário Ponto de Luz', 1, 'Folheado a ouro 18K', 39.9, 29.9, 8, true, '◇', ['#e8d5a3', '#c9a227']),
    p(2, 'Brinco Argola Cravejada', 3, 'Prata 925', 49.9, null, 5, true, '○', ['#f5f5f5', '#bdbdbd']),
    p(3, 'Colar Coração Vazado', 4, 'Folheado a ouro 18K', 55.9, 44.9, 3, true, '♡', ['#fce4ec', '#c9a227']),
    p(4, 'Pulseira Riviera', 6, 'Aço inox', 34.9, null, 12, false, '∞', ['#fff3e0', '#ad1457']),
    p(5, 'Corrente Veneziana 45cm', 5, 'Aço inox', 29.9, null, 0, false, '⌇', ['#eeeeee', '#9e9e9e']),
    p(6, 'Kit Trio de Brincos', 8, 'Folheado a ouro 18K', 45.9, 39.9, null, true, '✦', ['#faf3e2', '#880e4f']),
    p(7, 'Piranha Pérola', 9, 'Acetato', 19.9, null, 20, false, '❀', ['#fce4ec', '#f48fb1']),
    p(8, 'Bracelete Liso', 7, 'Folheado a ouro 18K', 42.9, null, 6, false, '◯', ['#e8d5a3', '#880e4f']),
    p(9, 'Colar Coração Vazado Prata', 4, 'Prata 925', 52.9, null, 4, false, '♡', ['#f5f5f5', '#9e9e9e']),
  ]
  // exemplo de cores do mesmo modelo: o colar coração no dourado e na prata
  Object.assign(produtos[2], { grupo_cor: 'demo-coracao', cor_nome: 'Dourado', cor_hex: '#d4af37' })
  Object.assign(produtos[8], { grupo_cor: 'demo-coracao', cor_nome: 'Prata', cor_hex: '#c4c7cc' })
  const cores = [['#e8d5a3', '#c9a227', '◇'], ['#f5f5f5', '#bdbdbd', '○'], ['#fce4ec', '#c9a227', '♡'], ['#fff3e0', '#ad1457', '∞'],
    ['#eeeeee', '#9e9e9e', '⌇'], ['#faf3e2', '#880e4f', '✦'], ['#fce4ec', '#f48fb1', '❀'], ['#e8d5a3', '#880e4f', '◯'], ['#f5f5f5', '#9e9e9e', '♡']]
  const produto_imagens = produtos.map((prod, i) => ({ id: i + 1, produto_id: prod.id, url: foto(...cores[i]), path: null, ordem: 0 }))

  return {
    seq: { geral: 100, pedido: 1000 },
    config_loja: {
      id: 1, nome: 'Diiamond Acessórios', slogan: 'Semijoias, prata e aço inox', whatsapp: '61999999999',
      instagram: 'diiamondacessorios', chave_pix: 'loja@exemplo.com', pix_nome: 'Diiamond Acessorios',
      pix_cidade: 'Brasilia', endereco_retirada: 'Combinar pelo WhatsApp', horario: 'Seg a sáb, 9h às 19h',
      banner_ativo: true, banner_texto: 'Frete grátis na retirada · Use o cupom BEMVINDA e ganhe 10% OFF',
      aberta: true, pedido_minimo: 0, url_loja: '', infinitepay_handle: 'demo', mostrar_ultimas: true,
      entrega_modo: 'bairros', origem_cep: '', origem_lat: null, origem_lng: null,
      entrega_raio_km: 2, entrega_taxa_base: 3, entrega_valor_km: 1, entrega_max_km: 10, entrega_fator_rota: 1.3,
    },
    categorias,
    produtos,
    produto_imagens,
    bairros_entrega: [
      { id: 1, nome: 'Centro', taxa: 5, ativo: true, ordem: 1 },
      { id: 2, nome: 'Bairro Norte', taxa: 8, ativo: true, ordem: 2 },
      { id: 3, nome: 'Bairro Sul', taxa: 10, ativo: true, ordem: 3 },
    ],
    cupons: [{ id: 1, codigo: 'BEMVINDA', tipo: 'percentual', valor: 10, minimo: 0, validade: null, usos_max: null, usos_por_cliente: null, usos: 0, ativo: true }],
    pedidos: [],
    pedido_itens: [],
    ia_config: {
      id: 1, ativo: false, modelo: 'gemini-flash-latest', nome_atendente: 'Diiamond', nome_dona: '',
      tom: 'Simpática, próxima e animada. Mensagens curtas, com emojis com moderação (💖✨). Chama a cliente de "linda" ou "amiga".',
      regras: '', msg_transferencia: 'Vou chamar a dona da loja pra te responder direitinho, tá? Ela já te chama! 💖',
      pausa_horas: 12, horario_inicio: null, horario_fim: null, modo_teste: true, usernames_teste: [],
    },
    ia_respostas: [
      { id: 1, pergunta: 'Vocês entregam? Qual o valor da entrega?', resposta: 'Entregamos sim, linda! 💖 A taxa depende do bairro e aparece certinho no carrinho do site. Também dá pra retirar sem custo!', automatica: true, palavras_chave: ['entreg*', 'frete', 'delivery'], mensagem_exata: false, ativo: true },
      { id: 2, pergunta: 'Oi / bom dia', resposta: 'Oii, tudo bem? 💖 Seja bem-vinda à Diiamond! Me conta o que você procura ✨', automatica: true, palavras_chave: ['oi', 'oii*', 'ola', 'bom dia', 'boa tarde', 'boa noite'], mensagem_exata: true, ativo: true },
      { id: 3, pergunta: 'As peças escurecem?', resposta: 'Nossas peças de aço inox e prata 925 não escurecem! ✨ As folheadas a ouro 18K duram bastante se evitar perfume, água e produtos químicos.', automatica: false, palavras_chave: [], mensagem_exata: false, ativo: true },
    ],
    ia_exemplos: [
      { id: 1, cliente: 'oi, tem esse colar ainda?', resposta: 'Oii amiga, tudo bem? 💖 Tem sim! Corre lá no site que tá com estoque, é só clicar no link da bio ✨', origem: 'manual', ativo: true },
    ],
    ig_conversas: [],
    ig_mensagens: [],
  }
}

function carregar() {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo) return JSON.parse(salvo)
  } catch { /* sem localStorage: segue com dados novos */ }
  const db = seed()
  gravar(db)
  return db
}

function gravar(db) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db))
  } catch {
    throw new Error('O armazenamento do navegador encheu (fotos muito grandes para o modo demonstração).')
  }
}

function proximoId(db, chave = 'geral') {
  db.seq[chave] += 1
  return db.seq[chave]
}

function emitir(tabela, tipo, novo, antigo = null) {
  const evento = { tabela, tipo, novo, antigo }
  ouvintes.forEach((fn) => fn(evento))
  canal?.postMessage(evento)
}
canal?.addEventListener('message', (e) => ouvintes.forEach((fn) => fn(e.data)))

const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms))
const copia = (v) => JSON.parse(JSON.stringify(v))

function montarProduto(db, prod) {
  return {
    ...prod,
    categoria: db.categorias.find((c) => c.id === prod.categoria_id) || null,
    imagens: db.produto_imagens.filter((i) => i.produto_id === prod.id).sort((a, b) => a.ordem - b.ordem || a.id - b.id),
  }
}

function montarPedido(db, pedido) {
  return { ...pedido, itens: db.pedido_itens.filter((i) => i.pedido_id === pedido.id) }
}

function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Não consegui ler o arquivo.'))
    r.readAsDataURL(file)
  })
}

// mesmo WhatsApp com ou sem o 55 conta como a mesma pessoa (igual a tel_cliente no banco)
function telCliente(t) {
  const d = String(t || '').replace(/\D/g, '')
  return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d
}

function validarCupomDb(db, codigo, subtotal, telefone) {
  const c = db.cupons.find((x) => x.ativo && x.codigo.toUpperCase() === String(codigo).trim().toUpperCase())
  if (!c) return { ok: false, erro: 'Cupom inválido' }
  if (c.validade && c.validade < new Date().toISOString().slice(0, 10)) return { ok: false, erro: 'Cupom expirado' }
  // usos = pedidos não cancelados com o cupom: cancelar devolve o uso
  const usados = db.pedidos.filter((pd) => pd.cupom_codigo === c.codigo && pd.status !== 'cancelado')
  if (c.usos_max && usados.length >= c.usos_max) return { ok: false, erro: 'Cupom esgotado' }
  const tel = telCliente(telefone)
  if (c.usos_por_cliente && tel.length >= 10 && usados.filter((pd) => telCliente(pd.cliente_telefone) === tel).length >= c.usos_por_cliente) {
    return { ok: false, erro: c.usos_por_cliente === 1 ? 'Você já usou este cupom' : `Você já usou este cupom ${c.usos_por_cliente} vezes` }
  }
  if (subtotal < c.minimo) return { ok: false, erro: `Compra mínima de R$ ${Number(c.minimo).toFixed(2).replace('.', ',')} para este cupom` }
  const desconto = c.tipo === 'percentual' ? Math.round(subtotal * c.valor) / 100 : Number(c.valor)
  return { ok: true, codigo: c.codigo, tipo: c.tipo, valor: c.valor, desconto: Math.min(desconto, subtotal) }
}

let usuarioDemo = (() => {
  try { return JSON.parse(sessionStorage.getItem('diamond-demo-user')) } catch { return null }
})()
const authOuvintes = new Set()

export const apiDemo = {
  demo: true,

  async resetarDemo() {
    gravar(seed())
  },

  // ---------------- vitrine ----------------
  async getConfig() {
    await espera(60)
    return copia(carregar().config_loja)
  },

  async listCategorias({ todas = false } = {}) {
    const db = carregar()
    return copia(db.categorias.filter((c) => todas || c.ativo).sort((a, b) => a.ordem - b.ordem))
  },

  async listProdutos({ todos = false } = {}) {
    await espera()
    const db = carregar()
    return copia(db.produtos.filter((p) => todos || p.ativo).sort((a, b) => a.ordem - b.ordem || b.id - a.id).map((p) => montarProduto(db, p)))
  },

  async getProduto(slugOuId) {
    const db = carregar()
    const prod = db.produtos.find((p) => String(p.id) === String(slugOuId) || p.slug === slugOuId)
    return prod ? copia(montarProduto(db, prod)) : null
  },

  async listBairros({ todos = false } = {}) {
    const db = carregar()
    return copia(db.bairros_entrega.filter((b) => todos || b.ativo).sort((a, b) => a.ordem - b.ordem))
  },

  async validarCupom(codigo, subtotal, telefone) {
    await espera()
    return validarCupomDb(carregar(), codigo, subtotal, telefone)
  },

  // Demonstração: consulta o CEP direto do navegador e guarda no localStorage
  async cotarEntrega(cep) {
    if (String(cep || '').replace(/\D/g, '').length !== 8) return { ok: false, erro: 'Informe um CEP válido.' }
    const end = await buscarCep(cep)
    if (!end) return { ok: false, erro: 'Não encontramos esse CEP. Confira e tente de novo.' }
    const cfg = carregar().config_loja
    const kmRota = end.lat != null && cfg.origem_lat != null ? await rotaKm({ lat: cfg.origem_lat, lng: cfg.origem_lng }, end) : null
    return { ...end, km_rota: kmRota, ...calcularFrete(cfg, end.lat, end.lng, kmRota) }
  },

  async criarPedido(p) {
    await espera(400)
    const db = carregar()
    const cfg = db.config_loja
    const nome = String(p.cliente_nome || '').trim()
    const tel = String(p.cliente_telefone || '').replace(/\D/g, '')
    if (!cfg.aberta) throw new Error('A loja está fechada para pedidos no momento.')
    if (nome.length < 2) throw new Error('Informe seu nome.')
    if (tel.length < 10 || tel.length > 13) throw new Error('Informe um WhatsApp válido com DDD.')
    if (!['entrega', 'retirada'].includes(p.tipo_entrega)) throw new Error('Escolha entrega ou retirada.')
    if (!['pix', 'dinheiro', 'cartao', 'cartao_online'].includes(p.forma_pagamento)) throw new Error('Escolha a forma de pagamento.')
    if (!p.itens?.length) throw new Error('Seu carrinho está vazio.')

    let subtotal = 0
    const itens = []
    for (const it of p.itens) {
      const prod = db.produtos.find((x) => x.id === it.produto_id && x.ativo)
      if (!prod) throw new Error('Um produto do carrinho não está mais disponível.')
      if (prod.estoque !== null && prod.estoque < it.quantidade) throw new Error(`Estoque insuficiente de "${prod.nome}" (restam ${prod.estoque}).`)
      const preco = precoFinal(prod)
      subtotal += preco * it.quantidade
      const img = db.produto_imagens.filter((i) => i.produto_id === prod.id).sort((a, b) => a.ordem - b.ordem)[0]
      itens.push({ produto_id: prod.id, nome: prod.nome, imagem_url: img?.url || null, preco_unitario: preco, quantidade: it.quantidade, subtotal: preco * it.quantidade })
    }
    if (subtotal < cfg.pedido_minimo) throw new Error(`O pedido mínimo é de R$ ${Number(cfg.pedido_minimo).toFixed(2).replace('.', ',')}.`)

    let desconto = 0
    let cupom = null
    if (p.cupom?.trim()) {
      const r = validarCupomDb(db, p.cupom, subtotal, tel)
      if (!r.ok) throw new Error(r.erro)
      desconto = r.desconto
      cupom = r.codigo
    }

    let taxa = 0
    let bairro = null
    let bairroNome = null
    let frete = null
    const cep = String(p.cep || '').replace(/\D/g, '')
    if (p.tipo_entrega === 'entrega') {
      if (String(p.endereco || '').trim().length < 5) throw new Error('Informe o endereço de entrega.')
      if (cfg.entrega_modo === 'distancia') {
        if (cep.length !== 8) throw new Error('Informe um CEP válido.')
        const lat = p.lat == null || p.lat === '' ? null : Number(p.lat)
        const lng = p.lng == null || p.lng === '' ? null : Number(p.lng)
        frete = calcularFrete(cfg, lat, lng, p.km_rota ?? null)
        if (!frete.ok) throw new Error(frete.erro)
        taxa = frete.taxa
        bairroNome = String(p.bairro || '').trim()
      } else {
        bairro = db.bairros_entrega.find((b) => b.id === Number(p.bairro_id) && b.ativo)
        if (!bairro) throw new Error('Escolha um bairro de entrega.')
        taxa = Number(bairro.taxa)
        bairroNome = bairro.nome
      }
    }
    const total = Math.round((subtotal - desconto + taxa) * 100) / 100
    let troco = null
    if (p.forma_pagamento === 'dinheiro' && p.troco_para) {
      troco = Number(p.troco_para)
      if (troco < total) throw new Error('O valor para troco precisa ser maior que o total.')
    }

    // só mexe no estoque depois de validar tudo
    for (const it of itens) {
      const prod = db.produtos.find((x) => x.id === it.produto_id)
      if (prod.estoque !== null) prod.estoque -= it.quantidade
    }

    const id = proximoId(db)
    const pedido = {
      id, codigo: 'DM' + proximoId(db, 'pedido'), token: crypto.randomUUID(),
      cliente_nome: nome, cliente_telefone: tel, tipo_entrega: p.tipo_entrega,
      bairro_id: bairro?.id ?? null, bairro_nome: bairroNome,
      cep: frete ? cep : null, distancia_km: frete?.km ?? null, entrega_a_combinar: !!frete?.a_combinar,
      endereco: p.tipo_entrega === 'entrega' ? p.endereco : null, complemento: p.complemento || '',
      referencia: p.referencia || '', observacao: p.observacao || '', forma_pagamento: p.forma_pagamento,
      troco_para: troco, subtotal, desconto, taxa_entrega: taxa, total, cupom_codigo: cupom,
      status: ['pix', 'cartao_online'].includes(p.forma_pagamento) ? 'aguardando_pagamento' : 'novo',
      comprovante_path: null, comprovante_enviado_em: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    db.pedidos.push(pedido)
    itens.forEach((it) => db.pedido_itens.push({ id: proximoId(db), pedido_id: id, ...it }))
    gravar(db)
    emitir('pedidos', 'INSERT', pedido)
    return { codigo: pedido.codigo, token: pedido.token, total }
  },

  async consultarPedido(codigo, token) {
    await espera()
    const db = carregar()
    const pd = db.pedidos.find((x) => x.codigo === codigo && x.token === token)
    if (!pd) return null
    const { id, token: _t, comprovante_path, pagamento_nsu, ...resto } = pd
    return copia({
      pedido: { ...resto, tem_comprovante: !!comprovante_path },
      itens: db.pedido_itens.filter((i) => i.pedido_id === id).map(({ id: _i, pedido_id: _p, ...i }) => i),
    })
  },

  async informarPixEnviado(codigo, token) {
    await espera(300)
    const db = carregar()
    const pd = db.pedidos.find((x) => x.codigo === codigo && x.token === token && x.forma_pagamento === 'pix' && x.status !== 'cancelado')
    if (!pd) throw new Error('Pedido não encontrado.')
    const antigo = { ...pd }
    pd.comprovante_enviado_em ||= new Date().toISOString()
    if (['novo', 'aguardando_pagamento'].includes(pd.status)) pd.status = 'pagamento_enviado'
    gravar(db)
    emitir('pedidos', 'UPDATE', pd, antigo)
    return true
  },

  /** Demonstração: em vez da InfinitePay, o "link" volta direto para o pedido como se tivesse pago. */
  async gerarLinkCartao(codigo, token) {
    await espera(300)
    const db = carregar()
    const pd = db.pedidos.find((x) => x.codigo === codigo && x.token === token && x.forma_pagamento === 'cartao_online')
    if (!pd) throw new Error('Pedido não encontrado.')
    if (pd.pago_em) return { pago: true }
    return { url: `${window.location.origin}/pedido/${codigo}?t=${token}&order_nsu=${codigo}&slug=demo&transaction_nsu=demo&capture_method=credit_card` }
  },

  async verificarPagamentoCartao(codigo, token, retorno) {
    await espera(300)
    const db = carregar()
    const pd = db.pedidos.find((x) => x.codigo === codigo && x.token === token && x.forma_pagamento === 'cartao_online')
    if (!pd || pd.status === 'cancelado' || !retorno?.transaction_nsu) return { pago: !!pd?.pago_em }
    if (pd.pago_em) return { pago: true }
    const antigo = { ...pd }
    Object.assign(pd, { pago_em: new Date().toISOString(), pagamento_nsu: retorno.transaction_nsu, pagamento_slug: retorno.slug, pagamento_parcelas: 1 })
    if (['novo', 'aguardando_pagamento', 'pagamento_enviado'].includes(pd.status)) pd.status = 'confirmado'
    gravar(db)
    emitir('pedidos', 'UPDATE', pd, antigo)
    return { pago: true }
  },

  // ---------------- autenticação ----------------
  async login(email, senha) {
    await espera(300)
    if (senha !== 'demo') throw new Error('No modo demonstração a senha é "demo".')
    usuarioDemo = { id: 'demo', email }
    sessionStorage.setItem('diamond-demo-user', JSON.stringify(usuarioDemo))
    authOuvintes.forEach((fn) => fn(usuarioDemo))
  },

  async alterarSenha(senhaAtual) {
    await espera(300)
    if (senhaAtual !== 'demo') throw new Error('No modo demonstração a senha atual é "demo".')
  },

  async logout() {
    usuarioDemo = null
    sessionStorage.removeItem('diamond-demo-user')
    authOuvintes.forEach((fn) => fn(null))
  },

  async getUsuario() {
    return usuarioDemo
  },

  onAuthChange(cb) {
    authOuvintes.add(cb)
    return () => authOuvintes.delete(cb)
  },

  async souAdmin() {
    return !!usuarioDemo
  },

  // ---------------- painel: genérico ----------------
  async listar(tabela, { ordem = 'id', asc = true } = {}) {
    const lista = copia(carregar()[tabela] || [])
    return lista.sort((a, b) => (a[ordem] > b[ordem] ? 1 : a[ordem] < b[ordem] ? -1 : 0) * (asc ? 1 : -1))
  },

  async salvar(tabela, registro) {
    await espera()
    const db = carregar()
    let salvo
    let antigo = null
    if (registro.id) {
      const i = db[tabela].findIndex((r) => r.id === registro.id)
      antigo = { ...db[tabela][i] }
      db[tabela][i] = { ...db[tabela][i], ...registro, updated_at: new Date().toISOString() }
      salvo = db[tabela][i]
    } else {
      salvo = { ...registro, id: proximoId(db), created_at: new Date().toISOString() }
      db[tabela].push(salvo)
    }
    gravar(db)
    emitir(tabela, registro.id ? 'UPDATE' : 'INSERT', salvo, antigo)
    return copia(salvo)
  },

  async excluir(tabela, id) {
    const db = carregar()
    db[tabela] = db[tabela].filter((r) => r.id !== id)
    gravar(db)
  },

  async salvarConfig(campos) {
    const db = carregar()
    db.config_loja = { ...db.config_loja, ...campos }
    gravar(db)
    return copia(db.config_loja)
  },

  // ---------------- painel: produtos ----------------
  async salvarProduto(produto) {
    const { categoria, imagens, ...campos } = produto
    return this.salvar('produtos', campos)
  },

  async reordenar(tabela, ids) {
    const db = carregar()
    ids.forEach((id, i) => {
      const r = db[tabela].find((x) => x.id === id)
      if (r) r.ordem = i + 1
    })
    gravar(db)
  },

  async uploadImagemProduto(produtoId, file, ordem = 0) {
    const url = await lerArquivo(file)
    const db = carregar()
    const img = { id: proximoId(db), produto_id: produtoId, url, path: null, ordem }
    db.produto_imagens.push(img)
    gravar(db)
    return img
  },

  async excluirImagem(imagem) {
    await this.excluir('produto_imagens', imagem.id)
  },

  async excluirProduto(produto) {
    const db = carregar()
    db.produto_imagens = db.produto_imagens.filter((i) => i.produto_id !== produto.id)
    db.produtos = db.produtos.filter((p) => p.id !== produto.id)
    gravar(db)
  },

  // ---------------- painel: pedidos ----------------
  async listPedidos({ desde } = {}) {
    await espera()
    const db = carregar()
    return copia(db.pedidos.filter((p) => !desde || p.created_at >= desde).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((p) => montarPedido(db, p)))
  },

  async getPedido(id) {
    const db = carregar()
    return copia(montarPedido(db, db.pedidos.find((p) => p.id === Number(id))))
  },

  async atualizarPedido(id, campos) {
    const db = carregar()
    const pd = db.pedidos.find((p) => p.id === id)
    const antigo = { ...pd }
    const antes = pd.status
    Object.assign(pd, campos, { updated_at: new Date().toISOString() })
    // mesmo gatilho do banco: cancelar devolve o estoque
    if (campos.status && campos.status !== antes && (campos.status === 'cancelado' || antes === 'cancelado')) {
      const sinal = campos.status === 'cancelado' ? 1 : -1
      db.pedido_itens.filter((i) => i.pedido_id === id).forEach((i) => {
        const prod = db.produtos.find((x) => x.id === i.produto_id)
        if (prod && prod.estoque !== null) prod.estoque = Math.max(0, prod.estoque + sinal * i.quantidade)
      })
    }
    gravar(db)
    emitir('pedidos', 'UPDATE', pd, antigo)
    return copia(montarPedido(db, pd))
  },

  async urlComprovante(path) {
    return path
  },

  assinar(tabela, cb) {
    const fn = (e) => e.tabela === tabela && cb(e)
    ouvintes.add(fn)
    return () => ouvintes.delete(fn)
  },

  // ---------------- IA ----------------
  async getIaConfig() {
    return copia(carregar().ia_config)
  },

  async salvarIaConfig(campos) {
    const db = carregar()
    db.ia_config = { ...db.ia_config, ...campos }
    gravar(db)
    return copia(db.ia_config)
  },

  async listMensagens(conversaId) {
    return copia(carregar().ig_mensagens.filter((m) => m.conversa_id === conversaId))
  },

  /** Sem a IA de verdade: procura a resposta padrão com mais palavras em comum. */
  /** Sem a IA de verdade: respostas prontas funcionam igual ao servidor; o resto avisa que precisa do Gemini. */
  async simularIa(mensagens) {
    await espera(500)
    const db = carregar()
    const novas = []
    for (let i = mensagens.length - 1; i >= 0 && mensagens[i].autor === 'cliente'; i--) novas.unshift(mensagens[i])
    if (novas.some((m) => m.audio)) {
      return { acao: 'passar_para_dona', resposta: 'Recebi seu áudio! 💖 Já vou chamar a dona pra te responder direitinho.', motivo: 'Modo demonstração: entender áudio precisa do Gemini configurado (Supabase + GEMINI_API_KEY).', origem: 'erro' }
    }
    const pronta = encontrarRespostaPronta(novas.map((m) => m.texto).join(' '), db.ia_respostas)
    if (pronta) return { acao: 'responder', resposta: pronta.resposta, motivo: `Resposta pronta: "${pronta.pergunta}"`, origem: 'pronta' }
    return { acao: 'passar_para_dona', resposta: db.ia_config.msg_transferencia, motivo: 'Modo demonstração: nenhuma resposta pronta bateu. Com o Supabase e a GEMINI_API_KEY configurados, o Gemini responde aqui.', origem: 'erro' }
  },

  async enviarMensagemDona() {
    throw new Error('No modo demonstração o Instagram não está conectado.')
  },

  async importarHistorico() {
    throw new Error('No modo demonstração o Instagram não está conectado.')
  },
}
