import { useCallback, useEffect, useRef, useState } from 'react'
import { Erro, Titulo, Vazio } from '../../components/admin/UI.jsx'
import { IconeInstagram, IconeVoltar } from '../../components/Icones.jsx'
import { Balao } from './AssistenteIA.jsx'
import { usePainel } from './AdminLayout.jsx'
import { api } from '../../lib/api.js'
import { formatData } from '../../lib/format.js'

export default function Conversas() {
  const { recontar } = usePainel()
  const [conversas, setConversas] = useState([])
  const [filtro, setFiltro] = useState('todas')
  const [aberta, setAberta] = useState(null)

  const carregar = useCallback(() => api.listar('ig_conversas', { ordem: 'ultima_em', asc: false }).then(setConversas).catch(() => {}), [])

  useEffect(() => {
    carregar()
    return api.assinar('ig_conversas', carregar)
  }, [carregar])

  const lista = filtro === 'dona' ? conversas.filter((c) => c.precisa_dona) : conversas
  const atual = conversas.find((c) => c.id === aberta)

  if (atual) return <Conversa conversa={atual} onVoltar={() => setAberta(null)} onMudou={() => { carregar(); recontar?.() }} />

  return (
    <>
      <Titulo>Direct do Instagram</Titulo>
      <div className="mb-3 flex gap-2">
        {[['todas', 'Todas'], ['dona', `Precisam de você (${conversas.filter((c) => c.precisa_dona).length})`]].map(([k, r]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)} className={`min-h-[40px] rounded-xl px-3.5 text-sm font-medium ${filtro === k ? 'bg-magenta text-white' : 'bg-white text-magenta/70 ring-1 ring-blush'}`}>{r}</button>
        ))}
      </div>
      {lista.length === 0 ? (
        <Vazio>{conversas.length ? 'Nenhuma conversa esperando você.' : 'As conversas do Direct aparecem aqui quando o Instagram estiver conectado (veja docs/instagram-setup.md).'}</Vazio>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setAberta(c.id)} className={`card flex w-full items-center gap-3 p-3 text-left transition hover:shadow-lift ${c.precisa_dona ? 'borda-ouro border bg-ouro-palido' : ''}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush text-magenta"><IconeInstagram /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-magenta">{c.nome || (c.username ? `@${c.username}` : 'Cliente')}</span>
                    {c.precisa_dona && <span className="rounded-full bg-ouro px-2 text-[11px] font-bold text-white">responder</span>}
                    {!c.precisa_dona && c.modo === 'dona' && <span className="text-[11px] text-magenta/45">você assumiu</span>}
                  </span>
                  <span className="block truncate text-sm text-magenta/55">{c.ultima_mensagem}</span>
                </span>
                <span className="shrink-0 text-[11px] text-magenta/40">{formatData(c.ultima_em)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Conversa({ conversa, onVoltar, onMudou }) {
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const fim = useRef(null)

  const carregar = useCallback(() => api.listMensagens(conversa.id).then(setMensagens), [conversa.id])
  useEffect(() => {
    carregar()
    return api.assinar('ig_mensagens', ({ novo }) => novo?.conversa_id === conversa.id && carregar())
  }, [carregar, conversa.id])
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [mensagens])

  const enviar = async (e) => {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true)
    setErro('')
    try {
      await api.enviarMensagemDona(conversa.id, texto.trim())
      setTexto('')
      carregar()
      onMudou()
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const mudarModo = async (modo) => {
    await api.salvar('ig_conversas', { id: conversa.id, modo, precisa_dona: false, pausado_ate: null })
    onMudou()
  }

  const corrigir = async (i, correcao) => {
    const pergunta = mensagens.slice(0, i).reverse().find((m) => m.autor === 'cliente')?.texto
    if (pergunta) await api.salvar('ia_exemplos', { cliente: pergunta, resposta: correcao, origem: 'correcao', ativo: true })
    setMensagens((l) => l.map((m, j) => (j === i ? { ...m, corrigido: true } : m)))
  }

  return (
    <div className="card flex h-[calc(100dvh-170px)] flex-col overflow-hidden lg:h-[calc(100dvh-100px)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-blush px-3 py-2">
        <button type="button" onClick={onVoltar} aria-label="Voltar" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-blush/50"><IconeVoltar /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-magenta">{conversa.nome || 'Cliente'}</p>
          {conversa.username && <a href={`https://instagram.com/${conversa.username}`} target="_blank" rel="noreferrer" className="text-xs text-magenta/50">@{conversa.username}</a>}
        </div>
        {conversa.modo === 'bot' ? (
          <button type="button" onClick={() => mudarModo('dona')} className="btn-claro min-h-[38px] text-xs">Assumir (pausar bot)</button>
        ) : (
          <button type="button" onClick={() => mudarModo('bot')} className="btn-claro min-h-[38px] text-xs">Devolver ao bot</button>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-cream/50 p-4">
        {mensagens.map((m, i) => (
          <div key={m.id}>
            <Balao m={m} onCorrigir={m.autor === 'bot' && !m.corrigido ? (c) => corrigir(i, c) : null} />
            <p className={`px-1 text-[10px] text-magenta/35 ${m.autor === 'cliente' ? '' : 'text-right'}`}>{formatData(m.created_at)}</p>
          </div>
        ))}
        <div ref={fim} />
      </div>
      <Erro>{erro}</Erro>
      <form onSubmit={enviar} className="flex gap-2 border-t border-blush p-3">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responder como a loja…" className="campo" />
        <button type="submit" disabled={enviando || !texto.trim()} className="btn-primario">{enviando ? '…' : 'Enviar'}</button>
      </form>
      <p className="px-3 pb-2 text-[11px] text-magenta/40">“Corrigir” numa resposta do bot salva a sua versão como exemplo: é assim que ele aprende o seu jeito.</p>
    </div>
  )
}
