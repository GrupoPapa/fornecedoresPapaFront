import { useCallback, useEffect, useState } from 'react'
import { comprasApi, erpApi, fornecedoresApi } from '../../api/servicos'
import { errosPorCampo, mensagemErro } from '../../api/http'
import { formatarCnpj, ROTULO_TIPO_FORNECEDOR, somenteDigitos } from '../../utils/format'
import Campo from '../../components/Campo'
import Modal from '../../components/Modal'
import Paginacao from '../../components/Paginacao'

const VAZIO = { cnpj: '', razaoSocial: '', nomeFantasia: '', email: '', telefone: '',
  codFornecedorErp: '', tipo: 'GERAL', ativo: true, codFilialCompra: '' }

export default function FornecedoresPage() {
  const [dados, setDados] = useState({ conteudo: [], pagina: 0, totalPaginas: 0, totalElementos: 0 })
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [edicao, setEdicao] = useState(null)
  const [erros, setErros] = useState({})
  const [filiais, setFiliais] = useState([])

  useEffect(() => {
    comprasApi.filiais().then(setFiliais).catch(() => setFiliais([]))
  }, [])

  // importacao do WinThor
  const [importar, setImportar] = useState(null)
  const [buscandoErp, setBuscandoErp] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = { pagina, tamanho: 20 }
      if (termo.trim()) params.termo = termo.trim()
      setDados(await fornecedoresApi.listar(params))
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }, [pagina, termo])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setErros({})
    const dadosEnvio = {
      ...edicao,
      cnpj: somenteDigitos(edicao.cnpj),
      codFornecedorErp: edicao.codFornecedorErp === '' ? null : Number(edicao.codFornecedorErp),
      codFilialCompra: edicao.codFilialCompra?.trim() || null
    }
    try {
      if (edicao.id) {
        await fornecedoresApi.atualizar(edicao.id, dadosEnvio)
        setMensagem('Fornecedor atualizado.')
      } else {
        await fornecedoresApi.criar(dadosEnvio)
        setMensagem('Fornecedor cadastrado.')
      }
      setEdicao(null)
      carregar()
    } catch (err) {
      setErro(mensagemErro(err))
      setErros(errosPorCampo(err))
    }
  }

  function abrirImportacao() {
    setErro('')
    setImportar({ termo: '', resultados: [], buscou: false, erro: '' })
    buscarNoErp('')
  }

  async function buscarNoErp(termoBusca) {
    setBuscandoErp(true)
    try {
      const resultados = await erpApi.fornecedores(termoBusca?.trim() || undefined)
      setImportar((atual) => ({ ...(atual || {}), termo: termoBusca ?? '', resultados, buscou: true, erro: '' }))
    } catch (err) {
      setImportar((atual) => ({
        ...(atual || {}), resultados: [], buscou: true,
        erro: mensagemErro(err, 'Não foi possível consultar o WinThor.')
      }))
    } finally {
      setBuscandoErp(false)
    }
  }

  async function confirmarImportacao(item) {
    try {
      const f = await erpApi.importarFornecedor(item.codigo)
      setMensagem(`${f.razaoSocial} importado do WinThor.`)
      setImportar(null)
      carregar()
    } catch (err) {
      setImportar((atual) => ({ ...atual, erro: mensagemErro(err) }))
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Fornecedores</h2>
          <p>Traga a empresa do WinThor e depois crie o acesso do usuário.</p>
        </div>
        <div className="botoes">
          <button type="button" className="btn-secundario" onClick={() => { setEdicao({ ...VAZIO }); setErros({}) }}>
            Cadastrar manualmente
          </button>
          <button type="button" className="btn-primario" onClick={abrirImportacao}>
            Importar do WinThor
          </button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagem && <div className="aviso sucesso">{mensagem}</div>}

      <div className="filtros">
        <Campo label="Buscar">
          <input type="search" value={termo} placeholder="Razão social ou CNPJ"
                 onChange={(e) => { setPagina(0); setTermo(e.target.value) }} />
        </Campo>
      </div>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Cód. WinThor</th><th>CNPJ</th><th>Razão social</th><th>Filial compra</th><th>Tipo</th>
              <th>E-mail</th><th>Telefone</th><th>Situação</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={9} className="vazio">Carregando...</td></tr>}
            {!carregando && dados.conteudo.length === 0 &&
              <tr><td colSpan={9} className="vazio">Nenhum fornecedor cadastrado.</td></tr>}
            {!carregando && dados.conteudo.map((f) => (
              <tr key={f.id}>
                <td>{f.codFornecedorErp || '-'}</td>
                <td>{formatarCnpj(f.cnpj)}</td>
                <td>{f.razaoSocial}</td>
                <td>{f.codFilialCompra || '-'}</td>
                <td>{ROTULO_TIPO_FORNECEDOR[f.tipo] || 'Geral'}</td>
                <td>{f.email || '-'}</td>
                <td>{f.telefone || '-'}</td>
                <td>{f.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="acoes">
                  <button type="button" className="btn-secundario btn-pequeno"
                          onClick={() => { setEdicao({ ...f, codFornecedorErp: f.codFornecedorErp ?? '', codFilialCompra: f.codFilialCompra ?? '' }); setErros({}) }}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas}
                 totalElementos={dados.totalElementos} aoMudar={setPagina} />

      {importar && (
        <Modal titulo="Importar fornecedor do WinThor" largura={860} aoFechar={() => setImportar(null)}>
          {importar.erro && <div className="aviso erro">{importar.erro}</div>}

          <form className="filtros" onSubmit={(e) => { e.preventDefault(); buscarNoErp(importar.termo) }}>
            <Campo label="Buscar no WinThor" ajuda="Razão social, CNPJ ou código do fornecedor.">
              <input type="search" value={importar.termo} autoFocus
                     placeholder="Ex.: GERDAU, 07358761005128 ou 1627"
                     onChange={(e) => setImportar({ ...importar, termo: e.target.value })} />
            </Campo>
            <button type="submit" className="btn-primario" disabled={buscandoErp}>
              {buscandoErp ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {buscandoErp && <p className="vazio">Consultando o WinThor...</p>}

          {!buscandoErp && importar.buscou && importar.resultados.length === 0 && !importar.erro && (
            <p className="vazio">Nenhum fornecedor encontrado no WinThor com esse termo.</p>
          )}

          {!buscandoErp && importar.resultados.length > 0 && (
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr><th>Código</th><th>CNPJ</th><th>Razão social</th><th>Tipo</th><th>Telefone</th><th>E-mail</th><th></th></tr>
                </thead>
                <tbody>
                  {importar.resultados.map((item) => (
                    <tr key={item.codigo}>
                      <td>{item.codigo}</td>
                      <td>{formatarCnpj(item.cnpj)}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 220 }}>{item.razaoSocial}</td>
                      <td>{ROTULO_TIPO_FORNECEDOR[item.tipo] || 'Geral'}</td>
                      <td>{item.telefone || '-'}</td>
                      <td>{item.email || '-'}</td>
                      <td>
                        <button type="button"
                                className={item.jaImportado ? 'btn-secundario btn-pequeno' : 'btn-primario btn-pequeno'}
                                onClick={() => confirmarImportacao(item)}>
                          {item.jaImportado ? 'Atualizar dados' : 'Importar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {edicao && (
        <Modal titulo={edicao.id ? 'Editar fornecedor' : 'Novo fornecedor'} aoFechar={() => setEdicao(null)}>
          <form className="formulario" onSubmit={salvar}>
            <div className="grade">
              <Campo label="CNPJ" obrigatorio erro={erros.cnpj}>
                <input value={edicao.cnpj} required maxLength={18}
                       onChange={(e) => setEdicao({ ...edicao, cnpj: e.target.value })} />
              </Campo>
              <Campo label="Código no WinThor" erro={erros.codFornecedorErp} ajuda="Opcional.">
                <input type="number" value={edicao.codFornecedorErp}
                       onChange={(e) => setEdicao({ ...edicao, codFornecedorErp: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Razão social" obrigatorio erro={erros.razaoSocial}>
              <input value={edicao.razaoSocial} required maxLength={150}
                     onChange={(e) => setEdicao({ ...edicao, razaoSocial: e.target.value })} />
            </Campo>
            <div className="grade">
              <Campo label="Nome fantasia" erro={erros.nomeFantasia}>
                <input value={edicao.nomeFantasia || ''} maxLength={150}
                       onChange={(e) => setEdicao({ ...edicao, nomeFantasia: e.target.value })} />
              </Campo>
              <Campo label="Tipo de fornecedor" erro={erros.tipo}
                     ajuda="Piso/Revestimento informa m² por caixa e peso por m².">
                <select value={edicao.tipo || 'GERAL'}
                        onChange={(e) => setEdicao({ ...edicao, tipo: e.target.value })}>
                  <option value="GERAL">Geral</option>
                  <option value="PISO_REVESTIMENTO">Piso / Revestimento</option>
                </select>
              </Campo>
            </div>
            <div className="grade">
              <Campo label="E-mail" erro={erros.email}>
                <input type="email" value={edicao.email || ''} maxLength={150}
                       onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} />
              </Campo>
              <Campo label="Filial de compra" erro={erros.codFilialCompra}
                     ajuda="O pedido de compra deste fornecedor já nasce com esta filial e ele não altera. Sem filial, ele escolhe.">
                <select value={edicao.codFilialCompra || ''}
                        onChange={(e) => setEdicao({ ...edicao, codFilialCompra: e.target.value })}>
                  <option value="">Sem filial fixa (fornecedor escolhe)</option>
                  {filiais.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} - {f.nome}</option>)}
                  {edicao.codFilialCompra && !filiais.some((f) => f.codigo === edicao.codFilialCompra) && (
                    <option value={edicao.codFilialCompra}>{edicao.codFilialCompra}</option>
                  )}
                </select>
              </Campo>
              <Campo label="Telefone" erro={erros.telefone}>
                <input value={edicao.telefone || ''} maxLength={20}
                       onChange={(e) => setEdicao({ ...edicao, telefone: e.target.value })} />
              </Campo>
              <Campo label="Situação">
                <select value={edicao.ativo ? '1' : '0'}
                        onChange={(e) => setEdicao({ ...edicao, ativo: e.target.value === '1' })}>
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </Campo>
            </div>
            <div className="botoes" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secundario" onClick={() => setEdicao(null)}>Cancelar</button>
              <button type="submit" className="btn-primario">Salvar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
