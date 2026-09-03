import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { erpApi, fornecedoresApi, fotosApi, pedidosApi, produtoErpApi, produtosApi } from '../api/servicos'
import { errosPorCampo, mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { ROTULO_STATUS, ROTULO_TIPO_FORNECEDOR, ehPiso, rotulosProduto, somenteDigitos } from '../utils/format'
import Campo from '../components/Campo'
import CamposWinthor from '../components/CamposWinthor'
import FotosProduto from '../components/FotosProduto'
import Modal from '../components/Modal'

const VAZIO = {
  codigo: '', descricao: '', codBarraCaixa: '', codBarraProduto: '', ncm: '',
  pesoLiquido: '', pesoBruto: '', metroCaixa: '', metroPallet: '',
  qtdEmbalagem: '', m2Caixa: '', m2Pallet: '', observacao: ''
}

function paraEnvio(form, tipo) {
  const numero = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')))
  const piso = ehPiso(tipo)
  return {
    codigo: form.codigo.trim(),
    descricao: form.descricao.trim(),
    codBarraCaixa: form.codBarraCaixa ? somenteDigitos(form.codBarraCaixa) : null,
    codBarraProduto: somenteDigitos(form.codBarraProduto),
    ncm: somenteDigitos(form.ncm),
    pesoLiquido: numero(form.pesoLiquido),
    pesoBruto: numero(form.pesoBruto),
    metroCaixa: piso ? null : numero(form.metroCaixa),
    metroPallet: piso ? null : numero(form.metroPallet),
    qtdEmbalagem: piso || form.qtdEmbalagem === '' ? null : Number(form.qtdEmbalagem),
    m2Caixa: piso ? numero(form.m2Caixa) : null,
    m2Pallet: piso ? numero(form.m2Pallet) : null,
    observacao: form.observacao ? form.observacao.trim() : null
  }
}

export default function ProdutoFormPage() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const pedidoId = parametros.get('pedido')
  const editando = !!id
  const navegar = useNavigate()
  const { admin, usuario } = useAuth()

  const [form, setForm] = useState(VAZIO)
  const [produto, setProduto] = useState(null)
  const [fornecedores, setFornecedores] = useState([])
  const [fornecedorId, setFornecedorId] = useState('')
  const [erro, setErro] = useState('')
  const [erros, setErros] = useState({})
  const [mensagem, setMensagem] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(editando)
  const [fotosPendentes, setFotosPendentes] = useState([])
  const [pedidoInfo, setPedidoInfo] = useState(null)
  const [perguntarOutro, setPerguntarOutro] = useState(false)

  // complemento WinThor (apenas para o admin, num produto ja salvo)
  const [erp, setErp] = useState(null)
  const [errosErp, setErrosErp] = useState({})
  const [marcas, setMarcas] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [secoes, setSecoes] = useState([])
  const mostrarWinthor = admin && editando

  // de onde vem o tipo: produto salvo > fornecedor escolhido pelo admin > fornecedor do usuario logado
  const tipoFornecedor = produto?.fornecedorTipo
    || pedidoInfo?.fornecedorTipo
    || fornecedores.find((f) => String(f.id) === String(fornecedorId))?.tipo
    || usuario?.fornecedorTipo
    || 'GERAL'
  const piso = ehPiso(tipoFornecedor)
  const rotulos = rotulosProduto(tipoFornecedor)

  const somenteLeitura = editando && produto && !produto.editavel && !admin

  useEffect(() => {
    if (!mostrarWinthor) return
    produtoErpApi.buscar(id).then(setErp).catch(() => setErp(null))
    erpApi.marcas().then(setMarcas).catch(() => setMarcas([]))
    erpApi.departamentos().then(setDepartamentos).catch(() => setDepartamentos([]))
  }, [mostrarWinthor, id])

  useEffect(() => {
    if (!erp?.codEpto) { setSecoes([]); return }
    erpApi.secoes(erp.codEpto).then(setSecoes).catch(() => setSecoes([]))
  }, [erp?.codEpto])

  useEffect(() => {
    if (!pedidoId) return
    pedidosApi.buscar(pedidoId).then(setPedidoInfo).catch(() => setPedidoInfo(null))
  }, [pedidoId])

  useEffect(() => {
    if (admin && !editando && !pedidoId) {
      fornecedoresApi.todos().then((lista) => setFornecedores(lista.filter((f) => f.ativo)))
        .catch(() => setFornecedores([]))
    }
  }, [admin, editando, pedidoId])

  useEffect(() => {
    if (!editando) return
    produtosApi.buscar(id)
      .then((p) => {
        setProduto(p)
        setForm({
          codigo: p.codigo ?? '',
          descricao: p.descricao ?? '',
          codBarraCaixa: p.codBarraCaixa ?? '',
          codBarraProduto: p.codBarraProduto ?? '',
          ncm: p.ncm ?? '',
          pesoLiquido: p.pesoLiquido ?? '',
          pesoBruto: p.pesoBruto ?? '',
          metroCaixa: p.metroCaixa ?? '',
          metroPallet: p.metroPallet ?? '',
          qtdEmbalagem: p.qtdEmbalagem ?? '',
          m2Caixa: p.m2Caixa ?? '',
          m2Pallet: p.m2Pallet ?? '',
          observacao: p.observacao ?? ''
        })
      })
      .catch((err) => setErro(mensagemErro(err, 'Produto não encontrado.')))
      .finally(() => setCarregando(false))
  }, [id, editando])

  function alterarErp(campo, valor) {
    setErp((e) => ({ ...e, [campo]: valor === '' ? null : valor }))
    setErrosErp((e) => ({ ...e, [campo]: undefined }))
  }

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  async function salvar(e, enviarDepois = false) {
    e.preventDefault()
    setErro(''); setMensagem(''); setErros({})
    setSalvando(true)
    try {
      const dados = paraEnvio(form, tipoFornecedor)
      const salvo = editando
        ? await produtosApi.atualizar(id, dados)
        : await produtosApi.criar(dados, admin && !pedidoId ? fornecedorId : null, pedidoId)

      if (mostrarWinthor && erp) {
        const numero = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
        const atualizado = await produtoErpApi.salvar(salvo.id, {
          ...erp,
          codMarca: numero(erp.codMarca), codEpto: numero(erp.codEpto), codSec: numero(erp.codSec),
          qtUnit: numero(erp.qtUnit), qtUnitCx: numero(erp.qtUnitCx), multiplo: numero(erp.multiplo),
          pesoLiq: numero(erp.pesoLiq), pesoBruto: numero(erp.pesoBruto),
          sugVenda: numero(erp.sugVenda), pComExt1: numero(erp.pComExt1),
          pComInt1: numero(erp.pComInt1), pComRep1: numero(erp.pComRep1),
          // no WinThor estes tres sao numericos (ver PCPRODUT)
          gtinCodAuxiliar: numero(erp.gtinCodAuxiliar), temRepos: numero(erp.temRepos)
        })
        setErp(atualizado)
      }

      // fotos escolhidas antes de o produto existir sobem agora
      for (const arquivo of fotosPendentes) {
        await fotosApi.anexar(salvo.id, arquivo)
      }
      setFotosPendentes([])

      if (pedidoId) {
        if (editando) {
          navegar(`/pedidos/${pedidoId}`, { replace: true })
        } else {
          // fluxo do pedido: pergunta se tem mais algum produto neste mesmo pedido
          setPerguntarOutro(true)
        }
        return
      }

      if (enviarDepois) {
        await produtosApi.enviar(salvo.id)
      }
      navegar('/produtos', { replace: true })
    } catch (err) {
      setErro(mensagemErro(err))
      const porCampo = errosPorCampo(err)
      setErros(porCampo)
      setErrosErp(porCampo)
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p>Carregando...</p>

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>{editando ? `Produto ${produto?.codigo ?? ''}` : 'Novo produto'}</h2>
          {pedidoInfo && (
            <p style={{ margin: '2px 0 0' }}>
              Pedido <strong>{pedidoInfo.numero}</strong> · {pedidoInfo.qtdItens} item(ns) até agora
            </p>
          )}
          <p>
            Preencha os dados exatamente como constam na embalagem e na nota fiscal.
            {piso && ' Como este fornecedor é de piso/revestimento, as medidas são por m².'}
          </p>
        </div>
        <div className="botoes">
          <span className="etiqueta GERAL" style={{ background: '#eef1f4', color: '#4a5560' }}>
            {ROTULO_TIPO_FORNECEDOR[tipoFornecedor]}
          </span>
          {produto && <span className={`etiqueta ${produto.status}`}>{ROTULO_STATUS[produto.status]}</span>}
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagem && <div className="aviso sucesso">{mensagem}</div>}
      {produto?.status === 'REPROVADO' && produto?.parecer && (
        <div className="aviso atencao"><strong>Devolvido para correção:</strong> {produto.parecer}</div>
      )}
      {somenteLeitura && (
        <div className="aviso info">
          Este cadastro já foi enviado e não pode mais ser alterado. Fale com a equipe de cadastro se precisar corrigir.
        </div>
      )}

      <form className="cartao formulario" onSubmit={(e) => salvar(e, false)}>
        {admin && !editando && !pedidoId && (
          <Campo label="Fornecedor" obrigatorio>
            <select value={fornecedorId} required onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="">Selecione...</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
            </select>
          </Campo>
        )}

        <div className="grade">
          <Campo label="Código do produto" obrigatorio erro={erros.codigo}
                 ajuda="Código usado pelo fornecedor (ex.: 63238).">
            <input value={form.codigo} maxLength={30} required disabled={somenteLeitura}
                   className={erros.codigo ? 'invalido' : undefined}
                   onChange={(e) => alterar('codigo', e.target.value)} />
          </Campo>

          <Campo label="Classificação fiscal (NCM)" obrigatorio erro={erros.ncm}
                 ajuda="8 dígitos, somente números.">
            <input value={form.ncm} maxLength={8} inputMode="numeric" required disabled={somenteLeitura}
                   className={erros.ncm ? 'invalido' : undefined}
                   onChange={(e) => alterar('ncm', somenteDigitos(e.target.value))} />
          </Campo>
        </div>

        <Campo label="Descrição do produto" obrigatorio erro={erros.descricao}>
          <input value={form.descricao} maxLength={150} required disabled={somenteLeitura}
                 className={erros.descricao ? 'invalido' : undefined}
                 onChange={(e) => alterar('descricao', e.target.value)} />
        </Campo>

        <div className="grade">
          <Campo label="Cód. barras do produto (EAN)" obrigatorio erro={erros.codBarraProduto}
                 ajuda="GTIN de 8, 12, 13 ou 14 dígitos, como impresso na embalagem (ex.: 7897451432381).">
            <input value={form.codBarraProduto} maxLength={14} inputMode="numeric" required disabled={somenteLeitura}
                   className={erros.codBarraProduto ? 'invalido' : undefined}
                   onChange={(e) => alterar('codBarraProduto', somenteDigitos(e.target.value))} />
          </Campo>

          <Campo label="Cód. barras da caixa (DUN)" erro={erros.codBarraCaixa}
                 ajuda="Opcional (DUN-14). Deixe em branco se a caixa não tiver código próprio.">
            <input value={form.codBarraCaixa} maxLength={14} inputMode="numeric" disabled={somenteLeitura}
                   className={erros.codBarraCaixa ? 'invalido' : undefined}
                   onChange={(e) => alterar('codBarraCaixa', somenteDigitos(e.target.value))} />
          </Campo>

          {piso ? (
            <Campo label={rotulos.embalagem} obrigatorio erro={erros.m2Caixa} ajuda={rotulos.embalagemAjuda}>
              <input type="number" min="0" step="0.0001" value={form.m2Caixa} required disabled={somenteLeitura}
                     className={erros.m2Caixa ? 'invalido' : undefined}
                     onChange={(e) => alterar('m2Caixa', e.target.value)} />
            </Campo>
          ) : (
            <Campo label={rotulos.embalagem} obrigatorio erro={erros.qtdEmbalagem} ajuda={rotulos.embalagemAjuda}>
              <input type="number" min="1" step="1" value={form.qtdEmbalagem} required disabled={somenteLeitura}
                     className={erros.qtdEmbalagem ? 'invalido' : undefined}
                     onChange={(e) => alterar('qtdEmbalagem', e.target.value)} />
            </Campo>
          )}
        </div>

        <div className="grade">
          <Campo label={rotulos.pesoLiquido} obrigatorio erro={erros.pesoLiquido}>
            <input type="number" min="0" step="0.0001" value={form.pesoLiquido} required disabled={somenteLeitura}
                   className={erros.pesoLiquido ? 'invalido' : undefined}
                   onChange={(e) => alterar('pesoLiquido', e.target.value)} />
          </Campo>

          <Campo label={rotulos.pesoBruto} obrigatorio erro={erros.pesoBruto}
                 ajuda={rotulos.pesoBrutoAjuda}>
            <input type="number" min="0" step="0.0001" value={form.pesoBruto} required disabled={somenteLeitura}
                   className={erros.pesoBruto ? 'invalido' : undefined}
                   onChange={(e) => alterar('pesoBruto', e.target.value)} />
          </Campo>

          {rotulos.mostrarMetroCaixa && (
            <Campo label={rotulos.caixa} erro={erros.metroCaixa} ajuda={rotulos.caixaAjuda}>
              <input type="number" min="0" step="0.000001" value={form.metroCaixa} disabled={somenteLeitura}
                     className={erros.metroCaixa ? 'invalido' : undefined}
                     onChange={(e) => alterar('metroCaixa', e.target.value)} />
            </Campo>
          )}

          {piso ? (
            <Campo label={rotulos.pallet} erro={erros.m2Pallet} ajuda={rotulos.palletAjuda}>
              <input type="number" min="0" step="0.0001" value={form.m2Pallet} disabled={somenteLeitura}
                     className={erros.m2Pallet ? 'invalido' : undefined}
                     onChange={(e) => alterar('m2Pallet', e.target.value)} />
            </Campo>
          ) : rotulos.mostrarMetroPallet ? (
            <Campo label={rotulos.pallet} erro={erros.metroPallet} ajuda={rotulos.palletAjuda}>
              <input type="number" min="0" step="0.000001" value={form.metroPallet} disabled={somenteLeitura}
                     className={erros.metroPallet ? 'invalido' : undefined}
                     onChange={(e) => alterar('metroPallet', e.target.value)} />
            </Campo>
          ) : null}
        </div>

        <Campo label="Observações" erro={erros.observacao} ajuda="Opcional (máx. 500 caracteres).">
          <textarea value={form.observacao} maxLength={500} disabled={somenteLeitura}
                    onChange={(e) => alterar('observacao', e.target.value)} />
        </Campo>

        {mostrarWinthor && erp && (
          <CamposWinthor form={erp} erros={errosErp} aoAlterar={alterarErp}
                         marcas={marcas} departamentos={departamentos} secoes={secoes}
                         somenteLeitura={erp.statusIntegracao === 'INTEGRADO'} />
        )}

        {mostrarWinthor && erp?.statusIntegracao === 'INTEGRADO' && (
          <div className="aviso sucesso">
            Produto já gravado no WinThor com o código <strong>{erp.codProdErp}</strong>.
          </div>
        )}
        {mostrarWinthor && erp?.statusIntegracao === 'ERRO' && (
          <div className="aviso erro">Última tentativa de gravação: {erp.mensagemErro}</div>
        )}

        <FotosProduto produtoId={editando ? Number(id) : null}
                      somenteLeitura={somenteLeitura}
                      pendentes={fotosPendentes}
                      aoMudarPendentes={setFotosPendentes}
                      aoErro={setErro} />

        <div className="botoes">
          <button type="button" className="btn-secundario"
                  onClick={() => navegar(pedidoId ? `/pedidos/${pedidoId}` : '/produtos')}>
            Voltar
          </button>
          {!somenteLeitura && pedidoId && (
            <button type="submit" className="btn-primario" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar produto'}
            </button>
          )}
          {!somenteLeitura && !pedidoId && (
            <>
              <button type="submit" className="btn-secundario" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              <button type="button" className="btn-primario" disabled={salvando}
                      onClick={(e) => salvar(e, true)}>
                Salvar e enviar para análise
              </button>
            </>
          )}
        </div>
      </form>

      {perguntarOutro && (
        <Modal titulo="Produto salvo" aoFechar={() => navegar(`/pedidos/${pedidoId}`)}
               rodape={
                 <>
                   <button type="button" className="btn-secundario"
                           onClick={() => navegar(`/pedidos/${pedidoId}`)}>
                     Não, finalizar
                   </button>
                   <button type="button" className="btn-primario"
                           onClick={() => {
                             setForm(VAZIO)
                             setFotosPendentes([])
                             setErros({})
                             setErro('')
                             setPerguntarOutro(false)
                             pedidosApi.buscar(pedidoId).then(setPedidoInfo).catch(() => {})
                             window.scrollTo({ top: 0, behavior: 'smooth' })
                           }}>
                     Sim, cadastrar outro
                   </button>
                 </>
               }>
          <p style={{ fontSize: 15 }}>
            Tem outro produto neste pedido{pedidoInfo ? ` ${pedidoInfo.numero}` : ''}?
          </p>
          <p style={{ color: 'var(--cor-texto-suave)' }}>
            Ao finalizar, você volta para o pedido e pode conferir tudo antes de enviar.
          </p>
        </Modal>
      )}
    </>
  )
}
