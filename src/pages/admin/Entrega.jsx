import CrudLista from '../../components/admin/CrudLista.jsx'
import { Titulo } from '../../components/admin/UI.jsx'
import { numeroParaCampo, parseBRL } from '../../lib/format.js'

export default function Entrega() {
  return (
    <>
      <Titulo>Entrega por bairro</Titulo>
      <p className="mb-4 text-sm text-magenta/55">
        O cliente escolhe o bairro no checkout e a taxa entra no total. Taxa 0 = entrega grátis. Sem nenhum bairro ativo, a loja só oferece retirada.
      </p>
      <CrudLista
        tabela="bairros_entrega"
        rotuloNovo="Novo bairro"
        vazio="Nenhum bairro cadastrado ainda."
        colunas={[
          { chave: 'nome', rotulo: 'Bairro / região' },
          { chave: 'taxa', rotulo: 'Taxa (R$)', tipo: 'dinheiro', largura: 'w-28' },
          { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', largura: 'w-20' },
          { chave: 'ativo', rotulo: 'Ativo', tipo: 'toggle', largura: '' },
        ]}
        mostrar={(r) => ({ ...r, taxa: numeroParaCampo(r.taxa) })}
        novoRegistro={(l) => ({ nome: '', taxa: '', ordem: l.length + 1, ativo: true })}
        preparar={(r) => {
          if (!r.nome?.trim()) throw new Error('Informe o nome do bairro.')
          const taxa = parseBRL(r.taxa) ?? 0
          if (taxa < 0) throw new Error('Taxa inválida.')
          return { ...r, nome: r.nome.trim(), taxa, ordem: Number(r.ordem) || 0 }
        }}
      />
    </>
  )
}
