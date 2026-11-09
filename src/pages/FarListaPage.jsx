import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { farApi } from '../api/servicos'
import { errosPorCampo, mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { formatarData, ROTULO_STATUS_FAR } from '../utils/format'
import Campo from '../components/Campo'
import Modal from '../components/Modal'
import Paginacao from '../components/Paginacao'

const FILTROS_VAZIOS = { termo: '', status: '', motivoId: '', baixaFiscal: '', dataDe: '', dataAte: '', fornecedorId: '' }

export default function FarListaPage() {
  const { admin } = useAuth()
  const navegar = useNavigate()

  const [dados, setDados] = useState({ conteudo: [], pagina: 0, totalPaginas: 0, totalElementos: 0 })
  const [motivos, setMotivos] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [gerenciarMotivos, setGerenciarMotivos] = useState(false)

  const parametros = useCallback(() => {
    const p = {}
    if (filtros.status) p.status = filtros.status
    if (filtros.motivoId) p.motivoId = filtros.motivoId
    if (filtros.baixaFiscal) p.baixaFiscal = filtros.baixaFiscal
    if (filtros.dataDe) p.dataDe = filtros.dataDe
    if (filtros.dataAte) p.dataAte = filtros.dataAte
    if (admin && filtros.fornecedorId) p.fornecedorId = filtros.fornecedorId
    return p
  }, [filtros, admin])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const p = { ...parametros(), pagina, tamanho: 20 }
      if (filtros.termo.trim()) p.termo = filtros.termo.trim()
      setDados(await farApi.listar(p))
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar as FARs.'))
    } finally {
      setCarregando(false)
    }
  }, [pagina, filtros, parametros])

  useEffect(() => { carregar() }, [carregar])

  const carregarMotivos = useCallback(() => {
    const busca = admin ? farApi.todosMotivos() : farApi.motivos()
    busca.then(setMotivos).catch(() => setMotivos([]))
  }, [admin])

  useEffect(() => { carregarMotivos() }, [carregarMotivos])

  useEffect(() => {
    if (admin) farApi.fornecedores().then(setFornecedores).catch(() => setFornecedores([]))
  }, [admin])

  function aplicarFiltro(campo, valor) {
    setPagina(0)
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function novaFar() {
    if (admin) {
      const alvo = filtros.fornecedorId || (fornecedores.length === 1 ? fornecedores[0].id : '')
      if (!alvo) {
        setErro('Selecione o fornecedor no filtro para registrar uma FAR em nome dele.')
        return
      }
      navegar(`/far/novo?fornecedor=${alvo}`)
      return
    }
    navegar('/far/novo')
  }

  async function exportar(formato) {
    try {
      const resposta = await farApi.exportar({ ...parametros(), formato })
      const url = URL.createObjectURL(new Blob([resposta.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `controle-avarias.${formato}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível gerar o arquivo.'))
    }
  }

  const colunas = admin ? 11 : 10

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Controle de avarias (FAR)</h2>
          <p>{admin
            ? 'Avarias registradas pelos fornecedores. Confira a FAR e registre o vínculo com a baixa fiscal.'
            : 'Registre cada visita de avaria, acompanhe a FAR e anexe o comprovante quando o processo for aprovado.'}</p>
        </div>
        <div className="botoes">
          {admin && (
            <button type="button" className="btn-secundario" onClick={() => setGerenciarMotivos(true)}>Motivos</button>
          )}
          <button type="button" className="btn-secundario" onClick={() => exportar('xlsx')}>Exportar Excel</button>
          <button type="button" className="btn-secundario" onClick={() => exportar('csv')}>Exportar CSV</button>
          <button type="button" className="btn-primario" onClick={novaFar}>Nova FAR</button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}

      <div className="filtros">
        <Campo label="Buscar">
          <input type="search" value={filtros.termo}
                 placeholder={admin ? 'Nº FAR, cód. produto, fornecedor ou ref. baixa' : 'Nº da FAR, cód. produto ou ocorrência'}
                 onChange={(e) => aplicarFiltro('termo', e.target.value)} />
        </Campo>
        <Campo label="Situação">
          <select value={filtros.status} onChange={(e) => aplicarFiltro('status', e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(ROTULO_STATUS_FAR).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Motivo">
          <select value={filtros.motivoId} onChange={(e) => aplicarFiltro('motivoId', e.target.value)}>
            <option value="">Todos</option>
            {motivos.map((m) => <option key={m.id} value={m.id}>{m.descricao}{m.ativo ? '' : ' (inativo)'}</option>)}
          </select>
        </Campo>
        <Campo label="Baixa fiscal">
          <select value={filtros.baixaFiscal} onChange={(e) => aplicarFiltro('baixaFiscal', e.target.value)}>
            <option value="">Todas</option>
            <option value="true">Vinculada</option>
            <option value="false">Não vinculada</option>
          </select>
        </Campo>
        <Campo label="Visita de">
          <input type="date" value={filtros.dataDe} onChange={(e) => aplicarFiltro('dataDe', e.target.value)} />
        </Campo>
        <Campo label="até">
          <input type="date" value={filtros.dataAte} onChange={(e) => aplicarFiltro('dataAte', e.target.value)} />
        </Campo>
        {admin && (
          <Campo label="Fornecedor">
            <select value={filtros.fornecedorId} onChange={(e) => aplicarFiltro('fornecedorId', e.target.value)}>
              <option value="">Todos</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codFornecedorErp ? `${f.codFornecedorErp} - ` : ''}{f.razaoSocial}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Data visita</th>
              {admin && <th>Fornecedor</th>}
              <th>Cód. produto</th>
              <th className="numero">Qtd</th>
              <th>Motivo</th>
              <th>Nº FAR</th>
              <th>Abertura FAR</th>
              <th>Situação</th>
              <th>Comprovante</th>
              <th>Baixa fiscal</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={colunas} className="vazio">Carregando...</td></tr>}
            {!carregando && dados.conteudo.length === 0 && (
              <tr><td colSpan={colunas} className="vazio">
                {admin ? 'Nenhuma FAR encontrada.' : 'Nenhuma FAR registrada. Clique em "Nova FAR".'}
              </td></tr>
            )}
            {!carregando && dados.conteudo.map((f) => (
              <tr key={f.id}>
                <td>{formatarData(f.dataVisita)}</td>
                {admin && <td className="quebra">{f.fornecedorNome}</td>}
                <td className="quebra">{f.codigoProduto || '-'}</td>
                <td className="numero">{f.qtdProdutos}</td>
                <td className="quebra">{f.motivoDescricao}</td>
                <td><strong>{f.numeroFar || '-'}</strong></td>
                <td>{formatarData(f.dataAberturaFar)}</td>
                <td>
                  <span className={`etiqueta ${f.status}`}>{ROTULO_STATUS_FAR[f.status]}</span>
                  {f.status === 'OUTROS' && f.statusOutros && <span className="texto-suave"> {f.statusOutros}</span>}
                </td>
                <td>
                  {f.qtdComprovantes > 0
                    ? <span className="etiqueta BAIXA_OK">Anexado</span>
                    : f.comprovantePendente ? <span className="etiqueta REPROVADO">Pendente</span> : '-'}
                </td>
                <td>
                  {f.baixaFiscal
                    ? <span className="etiqueta BAIXA_OK">Vinculada</span>
                    : <span className="etiqueta BAIXA_PENDENTE">Não vinculada</span>}
                </td>
                <td className="acoes">
                  <button type="button" className="btn-primario btn-pequeno" onClick={() => navegar(`/far/${f.id}`)}>
                    {f.editavel ? 'Abrir / editar' : 'Abrir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas}
                 totalElementos={dados.totalElementos} aoMudar={setPagina} />

      {gerenciarMotivos && (
        <MotivosModal motivos={motivos} aoMudar={carregarMotivos} aoFechar={() => setGerenciarMotivos(false)} />
      )}
    </>
  )
}

/** Cadastro dos motivos de avaria (equipe interna). Motivo em uso e inativado, nunca excluido. */
function MotivosModal({ motivos, aoMudar, aoFechar }) {
  const [novo, setNovo] = useState('')
  const [edicao, setEdicao] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function executar(acao) {
    setErro('')
    setSalvando(true)
    try {
      await acao()
      aoMudar()
      return true
    } catch (err) {
      const campos = errosPorCampo(err)
      setErro(campos.descricao || mensagemErro(err))
      return false
    } finally {
      setSalvando(false)
    }
  }

  async function incluir(e) {
    e.preventDefault()
    if (!novo.trim()) return
    if (await executar(() => farApi.criarMotivo({ descricao: novo.trim(), ativo: true }))) setNovo('')
  }

  async function salvarEdicao() {
    if (await executar(() => farApi.atualizarMotivo(edicao.id, { descricao: edicao.descricao, ativo: edicao.ativo }))) {
      setEdicao(null)
    }
  }

  return (
    <Modal titulo="Motivos de avaria" largura={640} aoFechar={aoFechar}>
      <p className="texto-suave" style={{ marginTop: 0 }}>
        São as opções do campo &quot;Motivo&quot; na FAR. Para tirar um motivo da lista do fornecedor, inative-o: as FARs
        antigas continuam com ele.
      </p>
      {erro && <div className="aviso erro">{erro}</div>}

      <form className="filtros" onSubmit={incluir}>
        <Campo label="Novo motivo">
          <input value={novo} maxLength={100} placeholder="Ex.: Embalagem violada" onChange={(e) => setNovo(e.target.value)} />
        </Campo>
        <button type="submit" className="btn-primario" disabled={salvando || !novo.trim()}>Incluir</button>
      </form>

      <div className="tabela-rolagem">
        <table>
          <thead><tr><th>Motivo</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {motivos.length === 0 && <tr><td colSpan={3} className="vazio">Nenhum motivo cadastrado.</td></tr>}
            {motivos.map((m) => (edicao?.id === m.id ? (
              <tr key={m.id}>
                <td>
                  <input value={edicao.descricao} maxLength={100} autoFocus
                         onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} />
                </td>
                <td>
                  <select value={edicao.ativo ? '1' : '0'} onChange={(e) => setEdicao({ ...edicao, ativo: e.target.value === '1' })}>
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </td>
                <td className="acoes">
                  <button type="button" className="btn-primario btn-pequeno" disabled={salvando || !edicao.descricao.trim()}
                          onClick={salvarEdicao}>Salvar</button>{' '}
                  <button type="button" className="btn-secundario btn-pequeno" onClick={() => setEdicao(null)}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={m.id}>
                <td className="quebra">{m.descricao}</td>
                <td>{m.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="acoes">
                  <button type="button" className="btn-secundario btn-pequeno" onClick={() => setEdicao({ ...m })}>Editar</button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
