/**
 * Som de "plim" gerado na hora (sem arquivo de áudio) + notificação do navegador.
 * O navegador só deixa tocar som depois de um clique na página: por isso o botão
 * "Ativar alertas" no painel chama `destravarSom()`.
 */
let ctx = null

export function destravarSom() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* navegador sem áudio */ }
}

export function somDestravado() {
  return ctx?.state === 'running'
}

export function tocarPlim() {
  if (!ctx) destravarSom()
  if (!ctx) return
  const agora = ctx.currentTime
  ;[988, 1319, 1568].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const ganho = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const inicio = agora + i * 0.14
    ganho.gain.setValueAtTime(0.0001, inicio)
    ganho.gain.exponentialRampToValueAtTime(0.35, inicio + 0.02)
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.6)
    osc.connect(ganho).connect(ctx.destination)
    osc.start(inicio)
    osc.stop(inicio + 0.65)
  })
}

export async function pedirPermissaoNotificacao() {
  if (!('Notification' in window)) return 'indisponivel'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

export function notificar(titulo, corpo, url) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(titulo, { body: corpo, icon: '/logo-192.png', tag: url })
    n.onclick = () => {
      window.focus()
      if (url) window.location.assign(url)
      n.close()
    }
  } catch { /* Android Chrome exige service worker para notificação: o som já avisa */ }
}
