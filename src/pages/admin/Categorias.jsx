import CrudLista from '../../components/admin/CrudLista.jsx'
import { Titulo } from '../../components/admin/UI.jsx'
import { slugify } from '../../lib/format.js'

export default function Categorias() {
  return (
    <>
      <Titulo>Categorias</Titulo>
      <p className="mb-4 text-sm text-magenta/55">Aparecem como abas na loja (só as que têm produto). A ordem define a posição.</p>
      <CrudLista
        tabela="categorias"
        rotuloNovo="Nova categoria"
        vazio="Nenhuma categoria."
        colunas={[
          { chave: 'nome', rotulo: 'Nome' },
          { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', largura: 'w-20' },
          { chave: 'ativo', rotulo: 'Ativa', tipo: 'toggle', largura: '' },
        ]}
        novoRegistro={(l) => ({ nome: '', ordem: l.length + 1, ativo: true })}
        preparar={(r) => {
          if (!r.nome?.trim()) throw new Error('Dê um nome à categoria.')
          return { ...r, nome: r.nome.trim(), slug: slugify(r.nome), ordem: Number(r.ordem) || 0 }
        }}
      />
    </>
  )
}
