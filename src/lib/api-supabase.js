import { supabase } from './supabase.js'

/**
 * Acesso a dados de verdade (Supabase). A interface é a mesma de api-demo.js:
 * as telas só conhecem `api` (src/lib/api.js) e não sabem qual dos dois está rodando.
 */

const PRODUTO_SELECT = '*, categoria:categorias(id, nome, slug), imagens:produto_imagens(id, url, path, ordem)'

function ok({ data, error }) {
  if (error) throw new Error(traduzirErro(error))
  return data
}

function traduzirErro(error) {
  const msg = error?.message || String(error)
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão. Verifique a internet e tente de novo.'
  return msg
}

function ordenarImagens(produto) {
  return { ...produto, imagens: [...(produto.imagens || [])].sort((a, b) => a.ordem - b.ordem || a.id - b.id) }
}

function extensao(file) {
  const porTipo = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
  return porTipo[file.type] || file.name?.split('.').pop() || 'bin'
}

export const apiSupabase = {
  demo: false,

  // ---------------- vitrine ----------------
  async getConfig() {
    return ok(await supabase.from('config_loja').select('*').eq('id', 1).single())
  },

  async listCategorias({ todas = false } = {}) {
    let q = supabase.from('categorias').select('*').order('ordem').order('nome')
    if (!todas) q = q.eq('ativo', true)
    return ok(await q)
  },

  async listProdutos({ todos = false } = {}) {
    let q = supabase.from('produtos').select(PRODUTO_SELECT).order('ordem').order('id', { ascending: false })
    if (!todos) q = q.eq('ativo', true)
    return ok(await q).map(ordenarImagens)
  },

  async getProduto(slugOuId) {
    const coluna = /^\d+$/.test(String(slugOuId)) ? 'id' : 'slug'
    const data = ok(await supabase.from('produtos').select(PRODUTO_SELECT).eq(coluna, slugOuId).maybeSingle())
    return data ? ordenarImagens(data) : null
  },

  async listBairros({ todos = false } = {}) {
    let q = supabase.from('bairros_entrega').select('*').order('ordem').order('nome')
    if (!todos) q = q.eq('ativo', true)
    return ok(await q)
  },

  async validarCupom(codigo, subtotal) {
    return ok(await supabase.rpc('validar_cupom', { p_codigo: codigo, p_subtotal: subtotal }))
  },

  async criarPedido(payload) {
    return ok(await supabase.rpc('criar_pedido', { p: payload }))
  },

  async consultarPedido(codigo, token) {
    return ok(await supabase.rpc('consultar_pedido', { p_codigo: codigo, p_token: token }))
  },

  async informarPixEnviado(codigo, token) {
    return ok(await supabase.rpc('informar_pix_enviado', { p_codigo: codigo, p_token: token }))
  },

  // ---------------- autenticação ----------------
  async login(email, senha) {
    ok(await supabase.auth.signInWithPassword({ email, password: senha }))
    if (!(await this.souAdmin())) {
      await supabase.auth.signOut()
      throw new Error('Este usuário não tem acesso ao painel.')
    }
  },

  async logout() {
    await supabase.auth.signOut()
  },

  async getUsuario() {
    const { data } = await supabase.auth.getSession()
    return data.session?.user ?? null
  },

  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => cb(sessao?.user ?? null))
    return () => data.subscription.unsubscribe()
  },

  async souAdmin() {
    const { data } = await supabase.rpc('is_admin')
    return data === true
  },

  // ---------------- painel: genérico ----------------
  async listar(tabela, { ordem = 'id', asc = true } = {}) {
    return ok(await supabase.from(tabela).select('*').order(ordem, { ascending: asc }))
  },

  async salvar(tabela, registro) {
    const { id, ...campos } = registro
    if (id) return ok(await supabase.from(tabela).update(campos).eq('id', id).select().single())
    return ok(await supabase.from(tabela).insert(campos).select().single())
  },

  async excluir(tabela, id) {
    ok(await supabase.from(tabela).delete().eq('id', id))
  },

  async salvarConfig(campos) {
    return ok(await supabase.from('config_loja').update(campos).eq('id', 1).select().single())
  },

  // ---------------- painel: produtos ----------------
  async salvarProduto(produto) {
    const { categoria, imagens, ...campos } = produto
    return this.salvar('produtos', campos)
  },

  async reordenar(tabela, ids) {
    await Promise.all(ids.map((id, i) => supabase.from(tabela).update({ ordem: i + 1 }).eq('id', id)))
  },

  async uploadImagemProduto(produtoId, file, ordem = 0) {
    const path = `produto-${produtoId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extensao(file)}`
    ok(await supabase.storage.from('produtos').upload(path, file, { contentType: file.type, cacheControl: '31536000' }))
    const { data } = supabase.storage.from('produtos').getPublicUrl(path)
    return ok(await supabase.from('produto_imagens').insert({ produto_id: produtoId, url: data.publicUrl, path, ordem }).select().single())
  },

  async excluirImagem(imagem) {
    if (imagem.path) await supabase.storage.from('produtos').remove([imagem.path])
    ok(await supabase.from('produto_imagens').delete().eq('id', imagem.id))
  },

  async excluirProduto(produto) {
    const paths = (produto.imagens || []).map((i) => i.path).filter(Boolean)
    if (paths.length) await supabase.storage.from('produtos').remove(paths)
    ok(await supabase.from('produtos').delete().eq('id', produto.id))
  },

  // ---------------- painel: pedidos ----------------
  async listPedidos({ desde } = {}) {
    let q = supabase.from('pedidos').select('*, itens:pedido_itens(*)').order('created_at', { ascending: false }).limit(300)
    if (desde) q = q.gte('created_at', desde)
    return ok(await q)
  },

  async getPedido(id) {
    return ok(await supabase.from('pedidos').select('*, itens:pedido_itens(*)').eq('id', id).single())
  },

  async atualizarPedido(id, campos) {
    return ok(await supabase.from('pedidos').update(campos).eq('id', id).select('*, itens:pedido_itens(*)').single())
  },

  async urlComprovante(path) {
    const data = ok(await supabase.storage.from('comprovantes').createSignedUrl(path, 60 * 10))
    return data.signedUrl
  },

  /** Chama `cb(evento)` a cada INSERT/UPDATE em pedidos. Retorna a função de cancelar. */
  assinar(tabela, cb) {
    const canal = supabase
      .channel(`rt-${tabela}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (payload) =>
        cb({ tipo: payload.eventType, novo: payload.new, antigo: payload.old }),
      )
      .subscribe()
    return () => supabase.removeChannel(canal)
  },

  // ---------------- IA ----------------
  async getIaConfig() {
    return ok(await supabase.from('ia_config').select('*').eq('id', 1).single())
  },

  async salvarIaConfig(campos) {
    return ok(await supabase.from('ia_config').update(campos).eq('id', 1).select().single())
  },

  async listMensagens(conversaId) {
    return ok(await supabase.from('ig_mensagens').select('*').eq('conversa_id', conversaId).order('created_at'))
  },

  async funcao(nome, body) {
    const { data, error } = await supabase.functions.invoke(nome, { body })
    if (error) {
      let detalhe = error.message
      try { detalhe = (await error.context.json()).erro || detalhe } catch { /* resposta sem JSON */ }
      throw new Error(detalhe)
    }
    return data
  },

  /** Simulador do painel: mesma lógica do webhook, sem enviar nada ao Instagram. */
  async simularIa(mensagens) {
    return this.funcao('ia-responder', { mensagens })
  },

  async enviarMensagemDona(conversaId, texto) {
    return this.funcao('instagram-enviar', { conversa_id: conversaId, texto })
  },

  async importarHistorico() {
    return this.funcao('ia-importar-historico', {})
  },
}
