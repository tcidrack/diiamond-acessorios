import CrudLista from '../../components/admin/CrudLista.jsx'
import { Titulo } from '../../components/admin/UI.jsx'
import { numeroParaCampo, parseBRL } from '../../lib/format.js'

export default function Cupons() {
  return (
    <>
      <Titulo>Cupons de desconto</Titulo>
      <p className="mb-4 text-sm text-magenta/55">
        O cliente digita o código no checkout. Para promoção de um produto só, use o preço promocional no cadastro do produto.
      </p>
      <CrudLista
        tabela="cupons"
        ordem="id"
        rotuloNovo="Novo cupom"
        vazio="Nenhum cupom criado."
        colunas={[
          { chave: 'codigo', rotulo: 'Código', placeholder: 'BEMVINDA', largura: 'min-w-[130px] flex-1' },
          { chave: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: [['percentual', '% off'], ['valor', 'R$ off']], largura: 'w-28' },
          { chave: 'valor', rotulo: 'Valor', tipo: 'dinheiro', largura: 'w-24' },
          { chave: 'minimo', rotulo: 'Compra mín. (R$)', tipo: 'dinheiro', largura: 'w-32' },
          { chave: 'validade', rotulo: 'Válido até', tipo: 'data', largura: 'w-40' },
          { chave: 'usos_max', rotulo: 'Limite de usos', tipo: 'numero', placeholder: 'sem limite', largura: 'w-28' },
          { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle', largura: '' },
        ]}
        mostrar={(r) => ({ ...r, valor: numeroParaCampo(r.valor), minimo: numeroParaCampo(r.minimo), validade: r.validade || '', usos_max: r.usos_max ?? '' })}
        novoRegistro={() => ({ codigo: '', tipo: 'percentual', valor: '10', minimo: '', validade: '', usos_max: '', ativo: true })}
        preparar={({ usos, ...r }) => {
          const codigo = String(r.codigo || '').trim().toUpperCase().replace(/\s+/g, '')
          if (!codigo) throw new Error('Informe o código do cupom.')
          const valor = parseBRL(r.valor)
          if (!(valor > 0)) throw new Error('Informe o valor do desconto.')
          if (r.tipo === 'percentual' && valor >= 100) throw new Error('A porcentagem precisa ser menor que 100.')
          return {
            ...r, codigo, valor, minimo: parseBRL(r.minimo) ?? 0,
            validade: r.validade || null, usos_max: r.usos_max ? parseInt(r.usos_max, 10) : null,
          }
        }}
      />
    </>
  )
}
