import { useEffect, useRef, useState } from 'react'
import { Campo, Erro, Titulo, Toggle, Vazio, useAviso } from '../../components/admin/UI.jsx'
import { IconeLixo } from '../../components/Icones.jsx'
import { api } from '../../lib/api.js'

const ABAS = {
  testar: 'Testar o bot',
  respostas: 'Respostas prontas',
  exemplos: 'Meu jeito de responder',
  config: 'Configuração',
}

// todos gratuitos no plano free do Google AI Studio (com limite de mensagens por minuto/dia)
const MODELOS = [
  ['gemini-flash-latest', 'Gemini Flash (sempre o mais novo) — recomendado'],
  ['gemini-3.8-flash', 'Gemini 3.8 Flash — versão fixa'],
  ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite — mais leve e rápido'],
]

const TEXTO_AUDIO = '🎤 áudio'

export default function AssistenteIA() {
  const [aba, setAba] = useState('testar')
  const [cfg, setCfg] = useState(null)
  const [aviso, setAviso] = useAviso()

  useEffect(() => { api.getIaConfig().then(setCfg) }, [])

  const ligar = async (ativo) => {
    setCfg(await api.salvarIaConfig({ ativo }))
    setAviso(ativo ? 'Bot ligado no Direct' : 'Bot desligado')
  }

  return (
    <>
      {aviso}
      <Titulo acao={cfg && <Toggle ativo={cfg.ativo} onChange={ligar} rotulo={!cfg.ativo ? 'Desligado' : cfg.modo_teste ? `Teste: só ${cfg.usernames_teste?.length || 0} @` : 'Respondendo todo mundo'} />}>
        Assistente IA
      </Titulo>
      {cfg?.ativo && cfg.modo_teste && !cfg.usernames_teste?.length && (
        <p className="-mt-3 mb-4 rounded-xl bg-ambar-bg px-3 py-2 text-sm text-ambar">
          Modo teste ligado sem nenhum @ na lista: o bot não vai responder ninguém. Adicione os @ em Configuração.
        </p>
      )}
      <p className="-mt-3 mb-4 text-sm text-magenta/55">
        Ele responde o Direct do Instagram no seu estilo, com os preços e o estoque do site, entende áudios e te chama quando não souber. Primeiro tenta uma resposta pronta (sem gastar IA); se nenhuma servir, usa o Google Gemini (gratuito). Teste aqui antes de ligar.
      </p>

      <div className="sem-barra -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {Object.entries(ABAS).map(([k, r]) => (
          <button key={k} type="button" onClick={() => setAba(k)} className={`min-h-[40px] shrink-0 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap ${aba === k ? 'bg-magenta text-white' : 'bg-white text-magenta/70 ring-1 ring-blush'}`}>
            {r}
          </button>
        ))}
      </div>

      {aba === 'testar' && <Simulador />}
      {aba === 'respostas' && <Respostas />}
      {aba === 'exemplos' && <Exemplos />}
      {aba === 'config' && cfg && <Config cfg={cfg} onSalvo={(c) => { setCfg(c); setAviso('Configuração salva!') }} />}
    </>
  )
}

function Simulador() {
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState('')
  const fim = useRef(null)
  const gravador = useRef(null)
  const inputAudio = useRef(null)

  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [mensagens, pensando])

  const perguntar = async (novas) => {
    setMensagens(novas)
    setPensando(true)
    setErro('')
    try {
      // só o que o servidor precisa: o áudio vai uma vez, depois segue a transcrição
      const r = await api.simularIa(novas.map(({ autor, texto: t, audio }) => ({ autor, texto: t, audio })))
      const atualizadas = novas.map((m) =>
        m.audio && r.transcricao ? { ...m, texto: `🎤 ${r.transcricao}`, audio: null } : m,
      )
      setMensagens([...atualizadas, { autor: 'bot', texto: r.resposta, acao: r.acao, motivo: r.motivo, origem: r.origem }])
    } catch (err) {
      setErro(err.message)
    } finally {
      setPensando(false)
    }
  }

  const enviar = (e) => {
    e.preventDefault()
    if (!texto.trim() || pensando) return
    perguntar([...mensagens, { autor: 'cliente', texto: texto.trim() }])
    setTexto('')
  }

  const enviarAudio = async (blob) => {
    if (blob.size > 8 * 1024 * 1024) return setErro('Áudio grande demais para o teste (máx. 8 MB).')
    const data = await new Promise((resolve, reject) => {
      const leitor = new FileReader()
      leitor.onload = () => resolve(String(leitor.result).split(',')[1])
      leitor.onerror = () => reject(new Error('Não consegui ler o áudio.'))
      leitor.readAsDataURL(blob)
    })
    const mimeType = (blob.type || 'audio/webm').split(';')[0]
    perguntar([...mensagens, { autor: 'cliente', texto: TEXTO_AUDIO, audio: { data, mimeType }, audioUrl: URL.createObjectURL(blob) }])
  }

  const alternarGravacao = async () => {
    if (gravando) return gravador.current?.stop()
    setErro('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const pedacos = []
      rec.ondataavailable = (e) => e.data.size && pedacos.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setGravando(false)
        if (pedacos.length) enviarAudio(new Blob(pedacos, { type: rec.mimeType }))
      }
      gravador.current = rec
      rec.start()
      setGravando(true)
    } catch {
      setErro('Não consegui usar o microfone. Libere o acesso no navegador ou escolha um arquivo de áudio.')
    }
  }

  const salvarCorrecao = async (i, correcao) => {
    const pergunta = [...mensagens.slice(0, i)].reverse().find((m) => m.autor === 'cliente')?.texto
    if (!pergunta) return
    await api.salvar('ia_exemplos', { cliente: pergunta, resposta: correcao, origem: 'correcao', ativo: true })
    setMensagens((l) => l.map((m, j) => (j === i ? { ...m, texto: correcao, corrigido: true } : m)))
  }

  return (
    <div className="card flex h-[65dvh] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-blush px-4 py-2.5 text-sm">
        <span className="text-magenta/60">Finja ser uma cliente no Direct</span>
        {mensagens.length > 0 && <button type="button" onClick={() => setMensagens([])} className="text-xs text-magenta/50 underline">limpar</button>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-cream/50 p-4">
        {mensagens.length === 0 && (
          <div className="space-y-2 pt-6 text-center text-sm text-magenta/45">
            <p>Experimente perguntar (ou mande um áudio 🎤):</p>
            {['Oi, quanto custa o colar de coração?', 'Vocês entregam no Centro?', 'A peça que comprei escureceu 😢'].map((s) => (
              <button key={s} type="button" onClick={() => setTexto(s)} className="mx-auto block rounded-full bg-white px-3 py-1.5 text-magenta/70 ring-1 ring-blush hover:bg-blush/40">{s}</button>
            ))}
          </div>
        )}
        {mensagens.map((m, i) => <Balao key={i} m={m} onCorrigir={m.autor === 'bot' && !m.corrigido ? (c) => salvarCorrecao(i, c) : null} />)}
        {pensando && <p className="text-xs text-magenta/40">digitando…</p>}
        <div ref={fim} />
      </div>
      <Erro>{erro}</Erro>
      <form onSubmit={enviar} className="flex gap-2 border-t border-blush p-3">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={gravando ? 'Gravando… toque em ■ para enviar' : 'Mensagem da cliente…'} className="campo" disabled={gravando} />
        <button type="button" onClick={alternarGravacao} disabled={pensando} aria-label={gravando ? 'Parar e enviar áudio' : 'Gravar áudio'} title="Gravar áudio" className={`btn shrink-0 px-3 ${gravando ? 'animate-pulse bg-vermelho text-white' : 'btn-claro'}`}>
          {gravando ? '■' : '🎤'}
        </button>
        <button type="button" onClick={() => inputAudio.current.click()} disabled={pensando || gravando} aria-label="Escolher arquivo de áudio" title="Escolher arquivo de áudio" className="btn-claro shrink-0 px-3">📎</button>
        <input ref={inputAudio} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) enviarAudio(f) }} />
        <button type="submit" disabled={pensando || gravando || !texto.trim()} className="btn-primario">Enviar</button>
      </form>
    </div>
  )
}

/** Balão de conversa. Respostas do bot mostram a decisão e podem ser corrigidas (vira exemplo). */
export function Balao({ m, onCorrigir }) {
  const [corrigindo, setCorrigindo] = useState(false)
  const [correcao, setCorrecao] = useState(m.texto)
  const daLoja = m.autor !== 'cliente'
  const acao = m.acao || m.meta?.acao
  const motivo = m.motivo || m.meta?.motivo

  return (
    <div className={`flex flex-col ${daLoja ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] whitespace-pre-line ${daLoja ? (m.autor === 'dona' ? 'bg-ouro-palido ring-1 ring-ouro/30' : 'bg-magenta text-white') : 'bg-white ring-1 ring-blush'}`}>
        {corrigindo ? (
          <div className="space-y-2">
            <textarea value={correcao} onChange={(e) => setCorrecao(e.target.value)} rows={3} className="campo text-[#3d2430]" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCorrigindo(false)} className="text-xs underline">cancelar</button>
              <button type="button" onClick={() => { onCorrigir(correcao); setCorrigindo(false) }} className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-magenta">Salvar como exemplo</button>
            </div>
          </div>
        ) : m.texto}
        {m.audioUrl && <audio controls src={m.audioUrl} className="mt-1.5 h-9 max-w-full" />}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 px-1 text-[11px] text-magenta/45">
        {m.autor === 'dona' && <span>você</span>}
        {(m.origem || m.meta?.origem) === 'pronta' && <span className="rounded-full bg-verde-bg px-2 font-semibold text-verde">⚡ resposta pronta</span>}
        {acao === 'passar_para_dona' && <span className="rounded-full bg-ambar-bg px-2 font-semibold text-ambar">passou para você</span>}
        {motivo && <span title={motivo} className="max-w-[260px] truncate">{motivo}</span>}
        {m.corrigido && <span className="text-verde">✓ salvo como exemplo</span>}
        {onCorrigir && !corrigindo && <button type="button" onClick={() => setCorrigindo(true)} className="underline">corrigir</button>}
      </div>
    </div>
  )
}

function ListaPares({ tabela, a, b, rotuloA, rotuloB, vazio, filtro, extra }) {
  const [itens, setItens] = useState([])
  const [novo, setNovo] = useState({ [a]: '', [b]: '' })
  const [erro, setErro] = useState('')

  const carregar = () => api.listar(tabela, { ordem: 'id', asc: false }).then(setItens).catch((e) => setErro(e.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [tabela])

  const adicionar = async (e) => {
    e.preventDefault()
    if (!novo[a].trim() || !novo[b].trim()) return
    try {
      const salvo = await api.salvar(tabela, { [a]: novo[a].trim(), [b]: novo[b].trim(), ativo: true, ...(tabela === 'ia_exemplos' ? { origem: 'manual' } : {}) })
      setItens((l) => [salvo, ...l])
      setNovo({ [a]: '', [b]: '' })
    } catch (err) {
      setErro(err.message)
    }
  }

  const atualizar = async (item, campos) => {
    setItens((l) => l.map((x) => (x.id === item.id ? { ...x, ...campos } : x)))
    await api.salvar(tabela, { id: item.id, ...campos }).catch((e) => setErro(e.message))
  }

  const excluir = async (item) => {
    if (!confirm('Excluir?')) return
    await api.excluir(tabela, item.id)
    setItens((l) => l.filter((x) => x.id !== item.id))
  }

  const visiveis = filtro ? itens.filter(filtro) : itens

  return (
    <div className="space-y-3">
      {extra}
      <form onSubmit={adicionar} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Campo rotulo={rotuloA}><textarea rows={2} value={novo[a]} onChange={(e) => setNovo((n) => ({ ...n, [a]: e.target.value }))} className="campo" /></Campo>
        <Campo rotulo={rotuloB}><textarea rows={2} value={novo[b]} onChange={(e) => setNovo((n) => ({ ...n, [b]: e.target.value }))} className="campo" /></Campo>
        <button type="submit" className="btn-primario">Adicionar</button>
      </form>
      <Erro>{erro}</Erro>
      {visiveis.length === 0 ? <Vazio>{vazio}</Vazio> : (
        <ul className="space-y-2">
          {visiveis.map((item) => <ItemPar key={item.id} item={item} a={a} b={b} onAtualizar={atualizar} onExcluir={excluir} />)}
        </ul>
      )}
    </div>
  )
}

function ItemPar({ item, a, b, onAtualizar, onExcluir }) {
  const [rascunho, setRascunho] = useState({ [a]: item[a], [b]: item[b] })
  const sujo = rascunho[a] !== item[a] || rascunho[b] !== item[b]
  const origem = { importado: 'importado do Direct', correcao: 'correção' }[item.origem]

  return (
    <li className={`card grid gap-2 p-3 sm:grid-cols-[1fr_1fr_auto] ${item.ativo ? '' : 'opacity-60'}`}>
      <textarea rows={2} value={rascunho[a]} onChange={(e) => setRascunho((r) => ({ ...r, [a]: e.target.value }))} className="campo text-sm" aria-label="Mensagem da cliente" />
      <textarea rows={2} value={rascunho[b]} onChange={(e) => setRascunho((r) => ({ ...r, [b]: e.target.value }))} className="campo text-sm" aria-label="Resposta" />
      <div className="flex items-center gap-1 sm:flex-col sm:items-end">
        <Toggle ativo={item.ativo} onChange={(v) => onAtualizar(item, { ativo: v })} rotulo={origem ? <span className="text-[11px] text-magenta/45">{origem}</span> : null} />
        {sujo && <button type="button" onClick={() => onAtualizar(item, rascunho)} className="btn-primario min-h-[36px] px-3 text-xs">Salvar</button>}
        <button type="button" onClick={() => onExcluir(item)} aria-label="Excluir" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-magenta/30 hover:text-vermelho sm:ml-0"><IconeLixo /></button>
      </div>
    </li>
  )
}

/** Respostas prontas (enviadas por palavra-chave, sem IA) e respostas de referência para a IA. */
function Respostas() {
  const vazioNovo = { pergunta: '', resposta: '', automatica: true, palavras: '', mensagem_exata: false }
  const [itens, setItens] = useState([])
  const [novo, setNovo] = useState(vazioNovo)
  const [erro, setErro] = useState('')

  useEffect(() => { api.listar('ia_respostas', { ordem: 'id', asc: false }).then(setItens).catch((e) => setErro(e.message)) }, [])

  const adicionar = async (e) => {
    e.preventDefault()
    setErro('')
    const palavras = paraLista(novo.palavras)
    if (!novo.pergunta.trim() || !novo.resposta.trim()) return setErro('Preencha a pergunta e a resposta.')
    if (novo.automatica && !palavras.length) return setErro('Resposta automática precisa de pelo menos uma palavra-chave.')
    try {
      const salvo = await api.salvar('ia_respostas', {
        pergunta: novo.pergunta.trim(), resposta: novo.resposta.trim(), ativo: true,
        automatica: novo.automatica, palavras_chave: palavras, mensagem_exata: novo.mensagem_exata,
      })
      setItens((l) => [salvo, ...l])
      setNovo(vazioNovo)
    } catch (err) {
      setErro(err.message)
    }
  }

  const atualizar = async (item, campos) => {
    setItens((l) => l.map((x) => (x.id === item.id ? { ...x, ...campos } : x)))
    await api.salvar('ia_respostas', { id: item.id, ...campos }).catch((e) => setErro(e.message))
  }

  const excluir = async (item) => {
    if (!confirm('Excluir esta resposta?')) return
    await api.excluir('ia_respostas', item.id)
    setItens((l) => l.filter((x) => x.id !== item.id))
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-1 p-4 text-sm text-magenta/70">
        <p><strong className="text-magenta">Automática:</strong> se a mensagem tiver as palavras-chave, o bot manda o texto pronto na hora, sem usar a IA.</p>
        <p><strong className="text-magenta">Não automática:</strong> a IA usa como referência e adapta ao contexto.</p>
        <p className="text-xs text-magenta/50">Palavras-chave separadas por vírgula. <code>entreg*</code> pega entrega, entregam, entregar… “qual pix” exige as duas palavras. Áudios sempre vão para a IA.</p>
      </div>

      <form onSubmit={adicionar} className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Quando perguntarem…"><textarea rows={2} value={novo.pergunta} onChange={(e) => setNovo((n) => ({ ...n, pergunta: e.target.value }))} className="campo" placeholder="Vocês entregam?" /></Campo>
          <Campo rotulo="Responda assim"><textarea rows={2} value={novo.resposta} onChange={(e) => setNovo((n) => ({ ...n, resposta: e.target.value }))} className="campo" placeholder="Entregamos sim, linda! A taxa aparece no carrinho do site 💖" /></Campo>
        </div>
        <OpcoesAutomatica valor={novo} onChange={(c) => setNovo((n) => ({ ...n, ...c }))} />
        <button type="submit" className="btn-primario">Adicionar resposta</button>
      </form>
      <Erro>{erro}</Erro>

      {itens.length === 0 ? <Vazio>Nenhuma resposta ainda.</Vazio> : (
        <ul className="space-y-2">
          {itens.map((item) => <ItemResposta key={item.id} item={item} onAtualizar={atualizar} onExcluir={excluir} />)}
        </ul>
      )}
    </div>
  )
}

const paraLista = (texto) => [...new Set(String(texto || '').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean))]

function OpcoesAutomatica({ valor, onChange }) {
  return (
    <div className="space-y-2 rounded-2xl bg-cream/70 p-3">
      <Toggle ativo={valor.automatica} onChange={(v) => onChange({ automatica: v })} rotulo="Enviar automático (sem IA)" />
      {valor.automatica && (
        <>
          <Campo rotulo="Palavras-chave">
            <input value={valor.palavras} onChange={(e) => onChange({ palavras: e.target.value })} className="campo" placeholder="entreg*, frete, delivery" />
          </Campo>
          <Toggle ativo={valor.mensagem_exata} onChange={(v) => onChange({ mensagem_exata: v })} rotulo="Só se a mensagem for exatamente isso (bom para “oi”, “bom dia”)" />
        </>
      )}
    </div>
  )
}

function ItemResposta({ item, onAtualizar, onExcluir }) {
  const inicial = { pergunta: item.pergunta, resposta: item.resposta, automatica: !!item.automatica, palavras: (item.palavras_chave || []).join(', '), mensagem_exata: !!item.mensagem_exata }
  const [r, setR] = useState(inicial)
  const sujo = JSON.stringify(r) !== JSON.stringify(inicial)

  const salvar = () => {
    if (r.automatica && !paraLista(r.palavras).length) return alert('Resposta automática precisa de pelo menos uma palavra-chave.')
    onAtualizar(item, { pergunta: r.pergunta, resposta: r.resposta, automatica: r.automatica, palavras_chave: paraLista(r.palavras), mensagem_exata: r.mensagem_exata })
  }

  return (
    <li className={`card space-y-2 p-3 ${item.ativo ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-2">
        {item.automatica ? (
          <span className="rounded-full bg-verde-bg px-2 py-0.5 text-[11px] font-semibold text-verde">⚡ automática</span>
        ) : (
          <span className="rounded-full bg-blush px-2 py-0.5 text-[11px] font-semibold text-magenta">referência da IA</span>
        )}
        <span className="ml-auto"><Toggle ativo={item.ativo} onChange={(v) => onAtualizar(item, { ativo: v })} rotulo={<span className="text-xs text-magenta/50">ligada</span>} /></span>
        <button type="button" onClick={() => onExcluir(item)} aria-label="Excluir" className="flex h-9 w-9 items-center justify-center rounded-lg text-magenta/30 hover:text-vermelho"><IconeLixo /></button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <textarea rows={2} value={r.pergunta} onChange={(e) => setR((x) => ({ ...x, pergunta: e.target.value }))} className="campo text-sm" aria-label="Pergunta" />
        <textarea rows={2} value={r.resposta} onChange={(e) => setR((x) => ({ ...x, resposta: e.target.value }))} className="campo text-sm" aria-label="Resposta" />
      </div>
      <OpcoesAutomatica valor={r} onChange={(c) => setR((x) => ({ ...x, ...c }))} />
      {sujo && <button type="button" onClick={salvar} className="btn-primario min-h-[36px] text-xs">Salvar alterações</button>}
    </li>
  )
}

function Exemplos() {
  const [filtro, setFiltro] = useState('todos')
  const [importando, setImportando] = useState(false)
  const [msg, setMsg] = useState('')
  const [chave, setChave] = useState(0)

  const importar = async () => {
    setImportando(true)
    setMsg('')
    try {
      const r = await api.importarHistorico()
      setMsg(`${r.importados} conversas importadas de ${r.conversas}. Elas chegam desligadas: ligue só as que têm o seu jeito de responder.`)
      setChave((k) => k + 1)
      setFiltro('importado')
    } catch (e) {
      setMsg(e.message)
    } finally {
      setImportando(false)
    }
  }

  const filtros = { todos: () => true, ativos: (x) => x.ativo, importado: (x) => x.origem === 'importado' && !x.ativo }

  return (
    <ListaPares
      key={chave}
      tabela="ia_exemplos"
      a="cliente"
      b="resposta"
      rotuloA="A cliente mandou…"
      rotuloB="Eu respondi assim"
      vazio="Nenhum exemplo aqui. Cole conversas reais suas, ou importe do Direct."
      filtro={filtros[filtro]}
      extra={
        <div className="card space-y-3 p-4">
          <p className="text-sm text-magenta/70">
            Quanto mais exemplos reais, mais o bot fala do seu jeito. Os ligados entram no aprendizado (até 60, os mais novos primeiro).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={importar} disabled={importando} className="btn-ouro">{importando ? 'Importando…' : '⇣ Importar minhas respostas antigas do Direct'}</button>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="campo w-auto" aria-label="Filtro">
              <option value="todos">Todos</option>
              <option value="ativos">Só os ligados</option>
              <option value="importado">Importados para revisar</option>
            </select>
          </div>
          {msg && <p className="text-sm text-magenta">{msg}</p>}
        </div>
      }
    />
  )
}

function Config({ cfg, onSalvo }) {
  const [form, setForm] = useState({
    ...cfg,
    horario_inicio: cfg.horario_inicio?.slice(0, 5) || '',
    horario_fim: cfg.horario_fim?.slice(0, 5) || '',
    modo_teste: cfg.modo_teste ?? true,
    usernames_teste: (cfg.usernames_teste || []).map((u) => `@${u}`).join('\n'),
  })
  const [erro, setErro] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const salvar = async (e) => {
    e.preventDefault()
    try {
      const { id, updated_at, ...campos } = form
      onSalvo(await api.salvarIaConfig({
        ...campos,
        pausa_horas: Math.max(1, parseInt(campos.pausa_horas, 10) || 12),
        // "@maria, @ana" ou um por linha -> ['maria', 'ana']
        usernames_teste: [...new Set(String(campos.usernames_teste).split(/[\s,;]+/).map((u) => u.replace(/^@/, '').trim().toLowerCase()).filter(Boolean))],
        horario_inicio: campos.horario_inicio || null,
        horario_fim: campos.horario_fim || null,
      }))
    } catch (err) {
      setErro(err.message)
    }
  }

  return (
    <form onSubmit={salvar} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome que o bot usa" ajuda="Ex.: Diiamond, ou o seu nome."><input value={form.nome_atendente || ''} onChange={set('nome_atendente')} className="campo" /></Campo>
        <Campo rotulo="Modelo de IA">
          <select value={form.modelo} onChange={set('modelo')} className="campo">
            {MODELOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Tom de voz" ajuda="Descreva como você escreve: formal ou descontraída, emojis, apelidos (linda, amiga…)."><textarea rows={3} value={form.tom || ''} onChange={set('tom')} className="campo" /></Campo>
      <Campo rotulo="Regras que o bot sempre segue" ajuda="Ex.: Não fazemos troca de brincos. Prazo de entrega: até 2 dias úteis. Não damos desconto pelo Direct."><textarea rows={4} value={form.regras || ''} onChange={set('regras')} className="campo" /></Campo>
      <Campo rotulo="Mensagem quando passar para você"><textarea rows={2} value={form.msg_transferencia || ''} onChange={set('msg_transferencia')} className="campo" /></Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo rotulo="Bot responde a partir de" ajuda="Vazio = o dia todo."><input type="time" value={form.horario_inicio} onChange={set('horario_inicio')} className="campo" /></Campo>
        <Campo rotulo="até"><input type="time" value={form.horario_fim} onChange={set('horario_fim')} className="campo" /></Campo>
        <Campo rotulo="Pausa quando você responde (horas)" ajuda="Se você responder uma conversa, o bot fica quieto nela por esse tempo."><input type="number" min="1" value={form.pausa_horas} onChange={set('pausa_horas')} className="campo" /></Campo>
      </div>
      <div className="borda-ouro space-y-2 rounded-2xl border bg-ouro-palido p-4">
        <Toggle ativo={form.modo_teste} onChange={(v) => setForm((f) => ({ ...f, modo_teste: v }))} rotulo="Modo teste: responder só os @ abaixo" />
        {form.modo_teste ? (
          <Campo rotulo="@ liberados para o teste" ajuda="Um por linha ou separados por vírgula. As mensagens dos outros clientes continuam aparecendo no Direct do painel, só não recebem resposta do bot.">
            <textarea rows={3} value={form.usernames_teste} onChange={set('usernames_teste')} className="campo" placeholder={'@sua_conta_pessoal\n@amiga_teste'} />
          </Campo>
        ) : (
          <p className="text-sm text-[#7a5f00]">O bot responde <strong>todas</strong> as clientes que mandarem mensagem.</p>
        )}
      </div>
      <Erro>{erro}</Erro>
      <button type="submit" className="btn-primario">Salvar configuração</button>
    </form>
  )
}
