import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fornecedoresApi, pedidosApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { formatarDataHora, ROTULO_STATUS_PEDIDO } from '../utils/format'
import Campo from '../components/Campo'
import Paginacao from '../components/Paginacao'

export default function PedidosPage() {
  const { admin } = useAuth()
  const navegar = useNavigate()

  const [dados, setDados] = useState({ conteudo: [], pagina: 0, totalPaginas: 0, totalElementos: 0 })
  const [fornecedores, setFornecedores] = useState([])
  const [filtros, setFiltros] = useState({ termo: '', status: '', fornecedorId: '' })
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const params = { pagina, tamanho: 20 }
      if (filtros.termo.trim()) params.termo = filtros.termo.trim()
      if (filtros.status) params.status = filtros.status
      if (admin && filtros.fornecedorId) params.fornecedorId = filtros.fornecedorId
      setDados(await pedidosApi.listar(params))
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar os pedidos.'))
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

  async function iniciarPedido() {
    setErro('')
    setAbrindo(true)
    try {
      const pedido = await pedidosApi.abrir(admin ? filtros.fornecedorId || null : null)
      navegar(`/pedidos/${pedido.id}`)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível iniciar o pedido.'))
    } finally {
      setAbrindo(false)
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Cadastro de produtos</h2>
          <p>{admin
            ? 'Cada pedido reúne os produtos que o fornecedor enviou de uma vez.'
            : 'Monte um pedido com todos os produtos e envie de uma vez só.'}</p>
        </div>
        {!admin && (
          <button type="button" className="btn-primario" onClick={iniciarPedido} disabled={abrindo}>
            {abrindo ? 'Abrindo...' : 'Iniciar cadastro de produtos'}
          </button>
        )}
        {admin && (
          <button type="button" className="btn-secundario" onClick={iniciarPedido} disabled={abrindo}
                  title="Abre um pedido para o fornecedor selecionado no filtro">
            Iniciar cadastro de produtos para o fornecedor filtrado
          </button>
        )}
      </div>

      {erro && <div className="aviso erro">{erro}</div>}

      <div className="filtros">
        <Campo label="Buscar">
          <input type="search" value={filtros.termo} placeholder="Número do pedido ou fornecedor"
                 onChange={(e) => aplicarFiltro('termo', e.target.value)} />
        </Campo>
        <Campo label="Situação">
          <select value={filtros.status} onChange={(e) => aplicarFiltro('status', e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_STATUS_PEDIDO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </Campo>
        {admin && (
          <Campo label="Fornecedor">
            <select value={filtros.fornecedorId}
                    onChange={(e) => aplicarFiltro('fornecedorId', e.target.value)}>
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
              <th>Itens</th>
              <th>Situação</th>
              <th>Criado em</th>
              <th>Enviado em</th>
              <th>Analisado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={admin ? 8 : 7} className="vazio">Carregando...</td></tr>}
            {!carregando && dados.conteudo.length === 0 && (
              <tr><td colSpan={admin ? 8 : 7} className="vazio">
                {admin ? 'Nenhum pedido recebido.' : 'Você ainda não tem pedidos. Clique em "Iniciar cadastro de produtos".'}
              </td></tr>
            )}
            {!carregando && dados.conteudo.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.numero}</strong></td>
                {admin && <td style={{ whiteSpace: 'normal', minWidth: 200 }}>{p.fornecedorNome}</td>}
                <td>{p.qtdItens}</td>
                <td><span className={`etiqueta ${p.status}`}>{ROTULO_STATUS_PEDIDO[p.status]}</span></td>
                <td>{formatarDataHora(p.dataCriacao)}</td>
                <td>{formatarDataHora(p.dataEnvio)}</td>
                <td>{formatarDataHora(p.dataAnalise)}</td>
                <td className="acoes">
                  <button type="button" className="btn-primario btn-pequeno"
                          onClick={() => navegar(`/pedidos/${p.id}`)}>
                    {p.status === 'ENVIADO' && admin ? 'Analisar' : 'Abrir'}
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
