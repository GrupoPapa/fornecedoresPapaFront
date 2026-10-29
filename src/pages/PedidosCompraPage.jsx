import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { comprasApi, fornecedoresApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { formatarData, formatarDataHora, formatarMoeda, ROTULO_STATUS_COMPRA } from '../utils/format'
import Campo from '../components/Campo'
import Paginacao from '../components/Paginacao'

export default function PedidosCompraPage() {
  const { admin } = useAuth()
  const navegar = useNavigate()

  const [dados, setDados] = useState({ conteudo: [], pagina: 0, totalPaginas: 0, totalElementos: 0 })
  const [fornecedores, setFornecedores] = useState([])
  const [filtros, setFiltros] = useState({ termo: '', status: '', fornecedorId: '' })
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const params = { pagina, tamanho: 20 }
      if (filtros.termo.trim()) params.termo = filtros.termo.trim()
      if (filtros.status) params.status = filtros.status
      if (admin && filtros.fornecedorId) params.fornecedorId = filtros.fornecedorId
      setDados(await comprasApi.listar(params))
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar os pedidos de compra.'))
    } finally {
      setCarregando(false)
    }
  }, [pagina, filtros, admin])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (admin) fornecedoresApi.todos().then(setFornecedores).catch(() => setFornecedores([]))
  }, [admin])

  function aplicarFiltro(campo, valor) {
    setPagina(0)
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function novoPedido() {
    if (admin) {
      if (!filtros.fornecedorId) {
        setErro('Selecione o fornecedor no filtro para digitar um pedido em nome dele.')
        return
      }
      navegar(`/compras/novo?fornecedor=${filtros.fornecedorId}`)
      return
    }
    navegar('/compras/novo')
  }

  async function exportar(formato) {
    try {
      const params = { formato }
      if (filtros.status) params.status = filtros.status
      if (admin && filtros.fornecedorId) params.fornecedorId = filtros.fornecedorId
      const resposta = await comprasApi.exportar(params)
      const url = URL.createObjectURL(new Blob([resposta.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `pedidos-compra.${formato}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível gerar o arquivo.'))
    }
  }

  const colunas = admin ? 9 : 8

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Pedidos de compra</h2>
          <p>{admin
            ? 'Pedidos digitados pelos fornecedores. Analise o cadastro e os preços e aprove para gerar a sugestão na rotina 220.'
            : 'Escolha os produtos, informe quantidade e preço e envie o pedido para análise.'}</p>
        </div>
        <div className="botoes">
          <button type="button" className="btn-secundario" onClick={() => exportar('xlsx')}>Exportar Excel</button>
          <button type="button" className="btn-secundario" onClick={() => exportar('csv')}>Exportar CSV</button>
          <button type="button" className={admin ? 'btn-secundario' : 'btn-primario'} onClick={novoPedido}
                  title={admin ? 'Digita um pedido para o fornecedor selecionado no filtro' : undefined}>
            {admin ? 'Novo pedido para o fornecedor filtrado' : 'Iniciar pedido'}
          </button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}

      <div className="filtros">
        <Campo label="Buscar">
          <input type="search" value={filtros.termo} placeholder="Nº do pedido, fornecedor ou nº da sugestão"
                 onChange={(e) => aplicarFiltro('termo', e.target.value)} />
        </Campo>
        <Campo label="Situação">
          <select value={filtros.status} onChange={(e) => aplicarFiltro('status', e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_STATUS_COMPRA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </Campo>
        {admin && (
          <Campo label="Fornecedor">
            <select value={filtros.fornecedorId} onChange={(e) => aplicarFiltro('fornecedorId', e.target.value)}>
              <option value="">Todos</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
            </select>
          </Campo>
        )}
      </div>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              {admin && <th>Fornecedor</th>}
              <th className="numero">Itens</th>
              <th className="numero">Total</th>
              <th>Situação</th>
              <th>Previsão entrega</th>
              <th>Enviado em</th>
              <th>Sugestão WinThor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={colunas} className="vazio">Carregando...</td></tr>}
            {!carregando && dados.conteudo.length === 0 && (
              <tr><td colSpan={colunas} className="vazio">
                {admin ? 'Nenhum pedido de compra encontrado.' : 'Você ainda não tem pedidos. Clique em "Iniciar pedido".'}
              </td></tr>
            )}
            {!carregando && dados.conteudo.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.numero}</strong></td>
                {admin && <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{p.fornecedorNome}</td>}
                <td className="numero">{p.qtdItens}</td>
                <td className="numero">{formatarMoeda(p.valorTotal)}</td>
                <td><span className={`etiqueta ${p.status}`}>{ROTULO_STATUS_COMPRA[p.status]}</span></td>
                <td>{formatarData(p.dataPrevisaoEntrega)}</td>
                <td>{formatarDataHora(p.dataEnvio)}</td>
                <td>
                  {p.numSugestaoErp
                    ? <strong>{p.numSugestaoErp}</strong>
                    : p.statusIntegracao === 'ERRO' ? <span style={{ color: 'var(--cor-erro)' }}>Erro</span> : '-'}
                </td>
                <td className="acoes">
                  <button type="button" className="btn-primario btn-pequeno"
                          onClick={() => navegar(`/compras/${p.id}`)}>
                    {admin && (p.status === 'EM_ANALISE' || p.status === 'DIVERGENCIA') ? 'Analisar'
                      : !admin && p.editavel ? 'Continuar' : 'Abrir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas}
                 totalElementos={dados.totalElementos} aoMudar={setPagina} />
    </>
  )
}
