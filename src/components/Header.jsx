import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import { IconeSacola } from './Icones.jsx'
import { useCarrinho } from '../hooks/useCarrinho.jsx'
import { useLoja } from '../hooks/useLoja.jsx'

export default function Header() {
  const { quantidadeTotal, setAberto } = useCarrinho()
  const { config } = useLoja()

  return (
    <header className="relative bg-brand-gradient text-white shadow-lift">
      {/* fio dourado: o folheado a ouro 18K é o carro-chefe da loja */}
      <span aria-hidden="true" className="fio-ouro absolute inset-x-0 bottom-0 h-px" />

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-5">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Logo />
          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-tight font-medium tracking-tight sm:text-[1.75rem]">
              {config?.nome || 'Diiamond Acessórios'}
            </p>
            <p className="truncate text-[13px] font-light tracking-wide text-ouro-claro/80 sm:text-sm">
              {config?.slogan || 'Semijoias, prata e aço inox'}
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label={`Abrir carrinho, ${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'}`}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 transition hover:bg-white/20 active:scale-95"
        >
          <IconeSacola />
          {quantidadeTotal > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-ouro px-1.5 text-xs font-bold text-white shadow-ouro ring-2 ring-magenta">
              {quantidadeTotal}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
