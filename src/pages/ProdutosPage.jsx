import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fornecedoresApi, produtosApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { ehPiso, formatarDataHora, formatarNumero, ROTULO_STATUS } from '../utils/format'
import Campo from '../components/Campo'
import Modal from '../components/Modal'
import Paginacao from '../components/Paginacao'

const TAMANHO_PAGINA = 20

export default function ProdutosPage() {
  const { admin } = useAuth()
  const navegar = useNavigate()

  const [dados, setDados] = useState({ conteudo: [], pagina: 0, totalPaginas: 0, totalElementos: 0 })
  const [resumo, setResumo] = useState(null)
  const [fornecedores, setFornecedores] = useState([])
  const [filtros, setFiltros] = useState({ termo: '', status: '', fornecedorId: '' })
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [historico, setHistorico] = useState(null)
  const [analise, setAnalise] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const params = { pagina, tamanho: TAMANHO_PAGINA }
      if (filtros.termo.trim()) params.termo = filtros.termo.trim()
      if (filtros.status) params.status = filtros.status
      if (admin && filtros.fornecedorId) params.fornecedorId = filtros.fornecedorId
      const [lista, totais] = await Promise.all([produtosApi.listar(params), produtosApi.resumo()])
      setDados(lista)
      setResumo(totais)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar os produtos.'))
    } finally {
      setCarregando(false)
    }
  }, [pagina, filtros, admin])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (admin) {
      fornecedoresApi.todos().then(setFornecedores).catch(() => setFornecedores([]))
    }
  }, [admin])

  function aplicarFiltro(campo, valor) {
    setPagina(0)
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  async function acao(fn, textoSucesso) {
    setErro(''); setMensagem('')
    try {
      await fn()
      setMensagem(textoSucesso)
      carregar()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  async function exportar(formato) {
    try {
      const params = { formato }
      if (filtros.status) params.status = filtros.status
      if (admin && filtros.fornecedorId) params.fornecedorId = filtros.fornecedorId
      const resposta = await produtosApi.exportar(params)
      const url = URL.createObjectURL(new Blob([resposta.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `produtos.${formato}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível gerar o arquivo.'))
    }
  }

  async function abrirHistorico(produto) {
    try {
      const itens = await produtosApi.historico(produto.id)
      setHistorico({ produto, itens })
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Produtos</h2>
          <p>{admin
            ? 'Todos os produtos, de qualquer pedido — use a aba Pedidos para analisar em lote.'
            : 'Todos os seus produtos. Para cadastrar novos, use a aba Pedidos.'}</p>
        </div>
        <div className="botoes">
          <button type="button" className="btn-secundario" onClick={() => exportar('xlsx')}>Exportar Excel</button>
          <button type="button" className="btn-secundario" onClick={() => exportar('csv')}>Exportar CSV</button>
          {admin && (
            <button type="button" className="btn-primario"
                    onClick={() => navegar('/produtos/novo')}>Novo produto avulso</button>
          )}
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagem && <div className="aviso sucesso">{mensagem}</div>}

      {resumo && (
        <div className="cartoes-resumo">
          <div className="cartao-resumo"><span>Rascunho</span><strong>{resumo.rascunho}</strong></div>
          <div className="cartao-resumo"><span>Enviados</span><strong>{resumo.enviado}</strong></div>
          <div className="cartao-resumo"><span>Aprovados</span><strong>{resumo.aprovado}</strong></div>
          <div className="cartao-resumo"><span>Reprovados</span><strong>{resumo.reprovado}</strong></div>
        </div>
      )}

      <div className="filtros">
        <Campo label="Buscar">
          <input type="search" value={filtros.termo} placeholder="Código, descrição, EAN ou NCM"
                 onChange={(e) => aplicarFiltro('termo', e.target.value)} />
        </Campo>
        <Campo label="Status">
          <select value={filtros.status} onChange={(e) => aplicarFiltro('status', e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </Campo>
        {admin && (
          <Campo label="Fornecedor">
            <select value={filtros.fornecedorId}
                    onChange={(e) => aplicarFiltro('fornecedorId', e.target.value)}>
              <option value="">Todos</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.razaoSocial}</option>
              ))}
            </select>
          </Campo>
        )}
      </div>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Código</th>
              <th>Descrição</th>
              {admin && <th>Fornecedor</th>}
              <th>EAN caixa</th>
              <th>EAN produto</th>
              <th>NCM</th>
              <th>Peso líq.</th>
              <th>Peso bruto</th>
              <th>Emb.</th>
              <th>m² caixa</th>
              <th>Pallet</th>
              <th>Fotos</th>
              <th>Status</th>
              <th>Atualizado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr><td colSpan={admin ? 16 : 15} className="vazio">Carregando...</td></tr>
            )}
            {!carregando && dados.conteudo.length === 0 && (
              <tr><td colSpan={admin ? 16 : 15} className="vazio">Nenhum produto encontrado.</td></tr>
            )}
            {!carregando && dados.conteudo.map((p) => (
              <tr key={p.id}>
                <td>{p.pedidoNumero
                  ? <a href={`/pedidos/${p.pedidoId}`}
                       onClick={(e) => { e.preventDefault(); navegar(`/pedidos/${p.pedidoId}`) }}>
                      {p.pedidoNumero}
                    </a>
                  : 'avulso'}</td>
                <td>{p.codigo}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{p.descricao}</td>
                {admin && <td>{p.fornecedorNome}</td>}
                <td>{p.codBarraCaixa || '-'}</td>
                <td>{p.codBarraProduto}</td>
                <td>{p.ncm}</td>
                <td>{formatarNumero(p.pesoLiquido)}</td>
                <td>{formatarNumero(p.pesoBruto)}</td>
                <td>{ehPiso(p.fornecedorTipo)
                  ? `${formatarNumero(p.m2Caixa)} m²`
                  : p.qtdEmbalagem}</td>
                <td>{ehPiso(p.fornecedorTipo) ? '-' : formatarNumero(p.metroCaixa, 6)}</td>
                <td>{ehPiso(p.fornecedorTipo)
                  ? (p.m2Pallet ? `${formatarNumero(p.m2Pallet)} m²` : '-')
                  : (p.metroPallet ? `${formatarNumero(p.metroPallet, 6)} m²` : '-')}</td>
                <td>{p.qtdFotos ? `${p.qtdFotos} 📷` : '-'}</td>
                <td><span className={`etiqueta ${p.status}`}>{ROTULO_STATUS[p.status]}</span></td>
                <td>{formatarDataHora(p.dataAtualizacao || p.dataCriacao)}</td>
                <td className="acoes">
                  <button type="button" className="btn-secundario btn-pequeno"
                          onClick={() => navegar(`/produtos/${p.id}`)}>
                    {p.editavel || admin ? 'Editar' : 'Ver'}
                  </button>
                  {p.editavel && (
                    <button type="button" className="btn-primario btn-pequeno"
                            onClick={() => acao(() => produtosApi.enviar(p.id), 'Produto enviado para análise.')}>
                      Enviar
                    </button>
                  )}
                  {admin && p.status === 'ENVIADO' && (
                    <>
                      <button type="button" className="btn-sucesso btn-pequeno"
                              onClick={() => acao(() => produtosApi.aprovar(p.id, null), 'Produto aprovado.')}>
                        Aprovar
                      </button>
                      <button type="button" className="btn-perigo btn-pequeno"
                              onClick={() => setAnalise({ produto: p, parecer: '' })}>
                        Reprovar
                      </button>
                    </>
                  )}
                  {admin && p.status === 'APROVADO' && (
                    <button type="button" className="btn-secundario btn-pequeno"
                            onClick={() => acao(() => produtosApi.reabrir(p.id), 'Produto reaberto.')}>
                      Reabrir
                    </button>
                  )}
                  <button type="button" className="btn-secundario btn-pequeno"
                          onClick={() => abrirHistorico(p)}>Histórico</button>
                  {(p.status === 'RASCUNHO' || admin) && (
                    <button type="button" className="btn-perigo btn-pequeno"
                            onClick={() => {
                              if (window.confirm(`Excluir o produto ${p.codigo}?`)) {
                                acao(() => produtosApi.excluir(p.id), 'Produto excluído.')
                              }
                            }}>Excluir</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas}
                 totalElementos={dados.totalElementos} aoMudar={setPagina} />

      {historico && (
        <Modal titulo={`Histórico · ${historico.produto.codigo}`} aoFechar={() => setHistorico(null)}>
          {historico.itens.length === 0 && <p>Nenhum registro de alteração.</p>}
          {historico.itens.length > 0 && (
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr><th>Data</th><th>Ação</th><th>Campo</th><th>De</th><th>Para</th><th>Usuário</th></tr>
                </thead>
                <tbody>
                  {historico.itens.map((h) => (
                    <tr key={h.id}>
                      <td>{formatarDataHora(h.dataEvento)}</td>
                      <td>{h.acao}</td>
                      <td>{h.campo || '-'}</td>
                      <td>{h.valorAnterior || '-'}</td>
                      <td>{h.valorNovo || '-'}</td>
                      <td>{h.usuario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {analise && (
        <Modal titulo={`Reprovar ${analise.produto.codigo}`} aoFechar={() => setAnalise(null)}
               rodape={
                 <>
                   <button type="button" className="btn-secundario" onClick={() => setAnalise(null)}>Cancelar</button>
                   <button type="button" className="btn-primario"
                           disabled={!analise.parecer.trim()}
                           onClick={() => {
                             acao(() => produtosApi.reprovar(analise.produto.id, analise.parecer),
                                  'Produto devolvido ao fornecedor.')
                             setAnalise(null)
                           }}>Confirmar reprovação</button>
                 </>
               }>
          <Campo label="Motivo da reprovação" obrigatorio
                 ajuda="O fornecedor verá este texto e poderá corrigir o cadastro.">
            <textarea value={analise.parecer} maxLength={500}
                      onChange={(e) => setAnalise({ ...analise, parecer: e.target.value })} />
          </Campo>
        </Modal>
      )}
    </>
  )
}
