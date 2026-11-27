import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { comprasApi, fornecedoresApi, importacaoApi } from '../api/servicos'
import ImportarPlanilha from '../components/ImportarPlanilha'
import { mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { formatarData, formatarDataHora, formatarMoeda, ROTULO_EVENTO_COMPRA, ROTULO_STATUS_COMPRA } from '../utils/format'
import Modal from '../components/Modal'
import Campo from '../components/Campo'
import Paginacao from '../components/Paginacao'
import SugestoesSystock from '../components/SugestoesSystock'

/** Pedidos de compra do portal e sugestoes de compra vindas do Systock. */
export default function PedidosCompraPage() {
  const { admin } = useAuth()
  const [parametros, setParametros] = useSearchParams()
  const aba = parametros.get('aba') === 'systock' ? 'systock' : 'portal'
  const [fornecedores, setFornecedores] = useState([])

  useEffect(() => {
    if (admin) fornecedoresApi.todos().then(setFornecedores).catch(() => setFornecedores([]))
  }, [admin])

  function trocar(nova) {
    setParametros(nova === 'systock' ? { aba: 'systock' } : {}, { replace: true })
  }

  return (
    <>
      <div className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'portal'}
                className={aba === 'portal' ? 'ativa' : undefined} onClick={() => trocar('portal')}>
          Pedidos do portal
        </button>
        <button type="button" role="tab" aria-selected={aba === 'systock'}
                className={aba === 'systock' ? 'ativa' : undefined} onClick={() => trocar('systock')}>
          Sugestões do Systock
        </button>
      </div>
      {aba === 'systock'
        ? <SugestoesSystock admin={admin} fornecedores={fornecedores} />
        : <PedidosPortal />}
    </>
  )
}

function PedidosPortal() {
  const { admin, usuario } = useAuth()
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

  const [importando, setImportando] = useState(false)
  const [historico, setHistorico] = useState(null) // { pedido, eventos, erro }
  const [excluindo, setExcluindo] = useState(null) // { pedido, salvando, erro }

  async function confirmarExclusao() {
    const p = excluindo.pedido
    setExcluindo((e) => ({ ...e, salvando: true, erro: '' }))
    try {
      await comprasApi.excluir(p.id)
      setExcluindo(null)
      setMensagemExclusao(`Pedido ${p.numero} excluído.`)
      carregar()
    } catch (err) {
      setExcluindo((e) => ({ ...e, salvando: false, erro: mensagemErro(err, 'Não foi possível excluir o pedido.') }))
    }
  }
  const [mensagemExclusao, setMensagemExclusao] = useState('')

  async function verHistorico(p) {
    setHistorico({ pedido: p, eventos: null })
    try {
      const eventos = await comprasApi.historico(p.id)
      setHistorico({ pedido: p, eventos })
    } catch (err) {
      setHistorico({ pedido: p, eventos: [], erro: mensagemErro(err, 'Não foi possível carregar o histórico.') })
    }
  }

  function abrirImportacao() {
    if (admin && !filtros.fornecedorId) {
      setErro('Selecione o fornecedor no filtro para baixar o modelo ou importar a planilha dele.')
      return
    }
    setErro('')
    setImportando(true)
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
          <button type="button" className="btn-secundario" onClick={abrirImportacao}
                  title={admin ? 'Modelo e importação para o fornecedor selecionado no filtro' : undefined}>
            Planilha Excel
          </button>
          {admin && (
            <form className="imprimir-winthor" title="Pedido de compra do WinThor no layout da rotina 210"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const n = String(new FormData(e.currentTarget).get('numPed') || '').replace(/\D/g, '')
                    if (n) window.open(`/admin/impressao-pedido/${n}`, '_blank', 'noreferrer')
                  }}>
              <input name="numPed" inputMode="numeric" placeholder="Nº pedido WinThor" aria-label="Número do pedido no WinThor" />
              <button type="submit" className="btn-secundario">Imprimir</button>
            </form>
          )}
          <button type="button" className="btn-secundario" onClick={() => exportar('xlsx')}>Exportar Excel</button>
          <button type="button" className="btn-secundario" onClick={() => exportar('csv')}>Exportar CSV</button>
          <button type="button" className={admin ? 'btn-secundario' : 'btn-primario'} onClick={novoPedido}
                  title={admin ? 'Digita um pedido para o fornecedor selecionado no filtro' : undefined}>
            {admin ? 'Novo pedido para o fornecedor filtrado' : 'Iniciar pedido'}
          </button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagemExclusao && <div className="aviso sucesso">{mensagemExclusao}</div>}

      {importando && (
        <ImportarPlanilha
          titulo={`Pedido de compra por planilha${admin && filtros.fornecedorId
            ? ` - ${fornecedores.find((f) => String(f.id) === String(filtros.fornecedorId))?.razaoSocial || ''}` : ''}`}
          explicacao="O pedido é criado em digitação com todos os itens. Confira e envie para análise. Se alguma linha tiver erro, nada é importado."
          nomeModelo="modelo-pedido-compra.xlsx"
          baixarModelo={() => importacaoApi.modeloCompra(admin ? filtros.fornecedorId : null)}
          importar={(arquivo) => importacaoApi.importarCompra(arquivo, admin ? filtros.fornecedorId : null)}
          aoFechar={() => setImportando(false)}
          aoConcluir={(r) => {
            setImportando(false)
            navegar(`/compras/${r.pedidoId}`, { state: { mensagem: (r.avisos || []).join(' ') } })
          }} />
      )}

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
                <td>
                  <strong>{p.numero}</strong>
                  {p.systockId && <span className="etiqueta origem-portal" title="Trazido de uma sugestão do Systock"> Systock {p.systockId}</span>}
                </td>
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
                    {admin && p.status === 'AGUARDANDO_DIRETORIA' && usuario?.aprovaDiretoria ? 'Aprovar'
                      : admin && (p.status === 'EM_ANALISE' || p.status === 'DIVERGENCIA') ? 'Analisar'
                      : !admin && p.editavel ? 'Continuar' : 'Abrir'}
                  </button>
                  <button type="button" className="btn-secundario btn-pequeno" onClick={() => verHistorico(p)}>
                    Histórico
                  </button>
                  {admin && !p.numSugestaoErp && (
                    <button type="button" className="btn-perigo btn-pequeno" title="Excluir o pedido de vez"
                            onClick={() => setExcluindo({ pedido: p })}>
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {excluindo && (
        <Modal titulo={`Excluir o pedido ${excluindo.pedido.numero}`} aoFechar={() => !excluindo.salvando && setExcluindo(null)}
               rodape={<>
                 <button type="button" className="btn-secundario" disabled={excluindo.salvando} onClick={() => setExcluindo(null)}>Voltar</button>
                 <button type="button" className="btn-perigo" disabled={excluindo.salvando} onClick={confirmarExclusao}>
                   {excluindo.salvando ? 'Excluindo...' : 'Excluir de vez'}
                 </button>
               </>}>
          {excluindo.erro && <div className="aviso erro">{excluindo.erro}</div>}
          <div className="aviso atencao">
            O pedido <strong>{excluindo.pedido.numero}</strong>
            {excluindo.pedido.fornecedorNome && <> de <strong>{excluindo.pedido.fornecedorNome}</strong></>} será
            apagado com os itens e o histórico. <strong>Não dá para desfazer.</strong>
          </div>
          <p className="texto-suave">Se quiser manter o registro, use <strong>Cancelar pedido</strong> dentro do pedido.</p>
        </Modal>
      )}

      {historico && (
        <Modal titulo={`Histórico do pedido ${historico.pedido.numero}`} aoFechar={() => setHistorico(null)}
               rodape={<>
                 <button type="button" className="btn-secundario" onClick={() => setHistorico(null)}>Fechar</button>
                 <button type="button" className="btn-primario" onClick={() => navegar(`/compras/${historico.pedido.id}`)}>Abrir pedido</button>
               </>}>
          <p className="texto-suave" style={{ marginTop: 0 }}>
            {historico.pedido.fornecedorNome && <>{historico.pedido.fornecedorNome} · </>}
            <span className={`etiqueta ${historico.pedido.status}`}>{ROTULO_STATUS_COMPRA[historico.pedido.status]}</span>
          </p>
          {historico.erro && <div className="aviso erro">{historico.erro}</div>}
          {historico.eventos === null && <p>Carregando...</p>}
          {historico.eventos?.length === 0 && !historico.erro && <p className="texto-suave">Sem eventos registrados.</p>}
          {historico.eventos?.length > 0 && (
            <ul className="historico">
              {historico.eventos.map((h) => (
                <li key={h.id}>
                  <strong>{ROTULO_EVENTO_COMPRA[h.evento] || h.evento}</strong>
                  <span className="texto-suave"> · {formatarDataHora(h.dataEvento)} · {h.usuario}</span>
                  {h.descricao && <p>{h.descricao}</p>}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas}
                 totalElementos={dados.totalElementos} aoMudar={setPagina} />
    </>
  )
}
