import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { comprasApi, farApi } from '../api/servicos'
import { errosPorCampo, mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { formatarData, formatarDataHora, formatarTamanho, hojeIso, ROTULO_STATUS_FAR } from '../utils/format'
import Campo from '../components/Campo'
import Modal from '../components/Modal'
import ProdutoAutocomplete from '../components/ProdutoAutocomplete'

let sequenciaChave = 0
function itemVazio() {
  sequenciaChave += 1
  return { chave: `n${sequenciaChave}`, codigoProduto: '', descricaoProduto: '', quantidade: '', motivoId: '' }
}

const FORM_VAZIO = {
  dataVisita: '', itens: [], obsOcorrencia: '',
  dataAberturaFar: '', numeroFar: '', numeroNota: '', numeroPedido: '', status: 'EM_ANALISE', statusOutros: '',
  obsFarFornecedor: '', obsFarEmpresa: ''
}

const ROTULO_EVENTO = {
  CRIACAO: 'FAR registrada',
  ALTERACAO: 'Dados alterados',
  STATUS: 'Situação alterada',
  ANEXO: 'Arquivo anexado',
  ANEXO_EXCLUIDO: 'Arquivo excluído',
  BAIXA_FISCAL: 'Vinculada à baixa fiscal',
  BAIXA_DESFEITA: 'Vínculo com a baixa fiscal desfeito'
}

const ROTULO_ANEXO = { COMPROVANTE_PAGAMENTO: 'Comprovante de pagamento', OUTRO: 'Outro documento' }
const ACEITOS = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'
const MAX_MB = 5
const MAX_ANEXOS = 10

function formDoServidor(f) {
  return {
    dataVisita: f.dataVisita || '',
    itens: (f.itens || []).map((i) => ({
      chave: `s${i.id}`,
      codigoProduto: i.codigoProduto || '',
      descricaoProduto: i.descricaoProduto || '',
      quantidade: i.quantidade ?? '',
      motivoId: i.motivoId ? String(i.motivoId) : ''
    })),
    obsOcorrencia: f.obsOcorrencia || '',
    dataAberturaFar: f.dataAberturaFar || '',
    numeroFar: f.numeroFar || '',
    numeroNota: f.numeroNota || '',
    numeroPedido: f.numeroPedido || '',
    status: f.status || 'EM_ANALISE',
    statusOutros: f.statusOutros || '',
    obsFarFornecedor: f.obsFarFornecedor || '',
    obsFarEmpresa: f.obsFarEmpresa || ''
  }
}

/** Mesmas regras do servidor, para avisar antes de enviar. */
function validar(form, comprovantes) {
  const e = {}
  const hoje = hojeIso()
  if (!form.dataVisita) e.dataVisita = 'Informe a data da visita.'
  else if (form.dataVisita > hoje) e.dataVisita = 'A data da visita não pode ser futura.'
  if (form.itens.length === 0) e.itensGeral = 'Inclua ao menos um produto.'
  const errosItens = form.itens.map((i) => {
    const ei = {}
    if (!i.codigoProduto.trim()) ei.codigoProduto = 'Informe o código.'
    const qtd = Number(i.quantidade)
    if (i.quantidade === '' || !Number.isInteger(qtd) || qtd <= 0) ei.quantidade = 'Quantidade inteira maior que zero.'
    if (!i.motivoId) ei.motivoId = 'Selecione o motivo.'
    return ei
  })
  if (errosItens.some((ei) => Object.keys(ei).length)) e.itens = errosItens
  if (form.dataAberturaFar) {
    if (form.dataAberturaFar > hoje) e.dataAberturaFar = 'A data de abertura não pode ser futura.'
    else if (form.dataVisita && form.dataAberturaFar < form.dataVisita) e.dataAberturaFar = 'Não pode ser anterior à data da visita.'
  }
  const temNumero = !!form.numeroFar.trim()
  if (temNumero && !form.dataAberturaFar) e.dataAberturaFar = 'Informe a data de abertura da FAR.'
  if (form.dataAberturaFar && !temNumero) e.numeroFar = 'Informe o número da FAR.'
  if (form.status.startsWith('FINALIZADO') && !temNumero) e.numeroFar = 'Para finalizar, informe o número e a data de abertura da FAR.'
  if (form.status === 'OUTROS' && !form.statusOutros.trim()) e.statusOutros = 'Descreva a situação.'
  if (form.status === 'FINALIZADO_APROVADO' && comprovantes === 0) e.comprovante = 'Anexe o comprovante de pagamento.'
  return e
}

function validarArquivo(arquivo) {
  if (!arquivo) return ''
  if (arquivo.size > MAX_MB * 1024 * 1024) return `O arquivo passa de ${MAX_MB} MB.`
  if (!/\.(pdf|jpe?g|png|webp)$/i.test(arquivo.name)) return 'Envie PDF, JPG, PNG ou WEBP.'
  return ''
}

export default function FarFormPage() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const local = useLocation()
  const { admin } = useAuth()
  const novo = !id
  const fornecedorParam = parametros.get('fornecedor')

  const [far, setFar] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [motivos, setMotivos] = useState([])
  const [produtos, setProdutos] = useState([])
  const [fornecedorNome, setFornecedorNome] = useState('')
  const [anexos, setAnexos] = useState([])
  const [historico, setHistorico] = useState([])
  const [comprovante, setComprovante] = useState(null)
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState(local.state?.mensagem || '')
  const [carregando, setCarregando] = useState(!novo)
  const [salvando, setSalvando] = useState(false)
  const [modal, setModal] = useState(null)
  const [novoAnexo, setNovoAnexo] = useState({ tipo: 'OUTRO', arquivo: null })
  // FAR nova: os anexos ficam na fila e sobem logo depois de registrar
  const [pendentes, setPendentes] = useState([])
  // conferencia da NF de compra no WinThor: null | { carregando } | resposta da API
  const [verificacaoNota, setVerificacaoNota] = useState(null)

  const editavel = novo || !!far?.editavel

  // mensagem deixada pela tela anterior (ex.: "FAR registrada." ao sair de /far/novo)
  useEffect(() => {
    if (local.state?.mensagem) setMensagem(local.state.mensagem)
  }, [local.state])

  const carregarRelacionados = useCallback((farId) => {
    farApi.anexos(farId).then(setAnexos).catch(() => setAnexos([]))
    farApi.historico(farId).then(setHistorico).catch(() => setHistorico([]))
  }, [])

  useEffect(() => {
    farApi.motivos().then(setMotivos).catch(() => setMotivos([]))
  }, [])

  // catalogo do fornecedor (WinThor + produtos novos do portal) para a pesquisa por nome
  const fornecedorDoCatalogo = admin ? (novo ? fornecedorParam : far?.fornecedorId) : null
  useEffect(() => {
    if (admin && !fornecedorDoCatalogo) return
    comprasApi.catalogo(fornecedorDoCatalogo || undefined)
      .then((c) => setProdutos(c.produtos || []))
      .catch(() => setProdutos([]))
  }, [admin, fornecedorDoCatalogo])

  // admin registrando em nome do fornecedor: mostra o nome dele no cabecalho
  useEffect(() => {
    if (!novo || !admin) return
    if (!fornecedorParam) {
      setErro('Volte à lista e selecione o fornecedor no filtro para registrar a FAR em nome dele.')
      return
    }
    farApi.fornecedores()
      .then((lista) => {
        const f = lista.find((x) => String(x.id) === String(fornecedorParam))
        if (f) setFornecedorNome(f.razaoSocial)
        else setErro('O controle de avarias não está liberado para o fornecedor selecionado.')
      })
      .catch(() => {})
  }, [novo, admin, fornecedorParam])

  useEffect(() => {
    if (novo) {
      setFar(null)
      setForm({ ...FORM_VAZIO, dataVisita: hojeIso(), itens: [itemVazio()] })
      setAnexos([])
      setHistorico([])
      return
    }
    let ativo = true
    setCarregando(true)
    farApi.buscar(id)
      .then((f) => {
        if (!ativo) return
        setFar(f)
        setForm(formDoServidor(f))
        setFornecedorNome(f.fornecedorNome)
        carregarRelacionados(f.id)
      })
      .catch((err) => ativo && setErro(mensagemErro(err, 'Não foi possível abrir a FAR.')))
      .finally(() => ativo && setCarregando(false))
    return () => { ativo = false }
  }, [id, novo, carregarRelacionados])

  // motivo inativo continua aparecendo nos itens da FAR que ja o usam
  const opcoesMotivo = useMemo(() => {
    const extras = []
    ;(far?.itens || []).forEach((i) => {
      if (!motivos.some((m) => m.id === i.motivoId) && !extras.some((m) => m.id === i.motivoId)) {
        extras.push({ id: i.motivoId, descricao: `${i.motivoDescricao} (inativo)` })
      }
    })
    return [...motivos, ...extras]
  }, [motivos, far])

  const totalProdutos = form.itens.reduce((soma, i) => soma + (Number(i.quantidade) > 0 ? Number(i.quantidade) : 0), 0)

  function erroItem(indice, campo) {
    return erros.itens?.[indice]?.[campo] || erros[`itens[${indice}].${campo}`]
  }

  function alterarItem(indice, mudancas) {
    setForm((f) => ({ ...f, itens: f.itens.map((i, n) => (n === indice ? { ...i, ...mudancas } : i)) }))
    setErros((e) => {
      if (!e.itens?.[indice] && !Object.keys(e).some((k) => k.startsWith(`itens[${indice}]`))) return e
      const itens = e.itens ? e.itens.map((ei, n) => (n === indice ? {} : ei)) : e.itens
      return { ...e, itens }
    })
    setMensagem('')
  }

  function incluirItem() {
    setForm((f) => ({ ...f, itens: [...f.itens, itemVazio()] }))
    setErros((e) => ({ ...e, itensGeral: undefined }))
  }

  const verificarNota = useCallback(async (numero) => {
    const n = String(numero || '').trim()
    if (!n) { setVerificacaoNota(null); return }
    if (admin && !fornecedorDoCatalogo) return
    setVerificacaoNota({ numero: n, carregando: true })
    try {
      setVerificacaoNota(await farApi.verificarNota(n, fornecedorDoCatalogo || undefined))
    } catch (err) {
      setVerificacaoNota({ numero: n, consultado: false, encontrada: false,
        mensagem: mensagemErro(err, 'Não foi possível conferir a nota agora.') })
    }
  }, [admin, fornecedorDoCatalogo])

  // ao abrir uma FAR que ja tem nota, confere de novo (mostra data, filial e produtos da NF)
  useEffect(() => {
    if (far?.numeroNota) verificarNota(far.numeroNota)
  }, [far?.id, far?.numeroNota, verificarNota])

  // produtos da FAR que nao aparecem na NF de compra (so da para comparar pelo CODPROD do WinThor)
  const produtosForaDaNota = useMemo(() => {
    if (!verificacaoNota?.encontrada || !verificacaoNota.produtos?.length) return []
    const naNota = new Set(verificacaoNota.produtos.map(String))
    return form.itens.map((i) => i.codigoProduto.trim())
      .filter((c) => /^\d+$/.test(c) && !naNota.has(String(Number(c))))
  }, [verificacaoNota, form.itens])

  function removerItem(indice) {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, n) => n !== indice) }))
    setErros((e) => ({ ...e, itens: e.itens?.filter((_, n) => n !== indice) }))
  }

  const comprovantesNaFila = novo ? pendentes.filter((p) => p.tipo === 'COMPROVANTE_PAGAMENTO').length : 0
  const qtdComprovantes = (far?.qtdComprovantes || 0) + comprovantesNaFila
  const precisaComprovante = form.status === 'FINALIZADO_APROVADO' && qtdComprovantes === 0

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
    setMensagem('')
  }

  function escolherComprovante(evento) {
    const arquivo = evento.target.files?.[0] || null
    evento.target.value = ''
    const problema = validarArquivo(arquivo)
    if (problema) {
      setErros((e) => ({ ...e, comprovante: problema }))
      return
    }
    setComprovante(arquivo)
    setErros((e) => ({ ...e, comprovante: undefined }))
  }

  async function salvar() {
    setErro('')
    setMensagem('')
    const comprovantes = qtdComprovantes + (comprovante ? 1 : 0)
    const locais = validar(form, comprovantes)
    if (Object.keys(locais).length) {
      setErros(locais)
      setErro('Confira os campos destacados.')
      return
    }
    const dados = {
      dataVisita: form.dataVisita,
      itens: form.itens.map((i) => ({
        codigoProduto: i.codigoProduto.trim(),
        descricaoProduto: i.descricaoProduto?.trim() || null,
        quantidade: Number(i.quantidade),
        motivoId: Number(i.motivoId)
      })),
      obsOcorrencia: form.obsOcorrencia.trim() || null,
      dataAberturaFar: form.dataAberturaFar || null,
      numeroFar: form.numeroFar.trim() || null,
      numeroNota: form.numeroNota.trim() || null,
      numeroPedido: form.numeroPedido.trim() || null,
      status: form.status,
      statusOutros: form.status === 'OUTROS' ? form.statusOutros.trim() : null,
      obsFarFornecedor: form.obsFarFornecedor.trim() || null,
      obsFarEmpresa: admin ? (form.obsFarEmpresa.trim() || null) : null
    }
    // so envia o comprovante quando ele for usado (processo aprovado). Na FAR nova, um
    // comprovante que esteja na fila de anexos serve: ele vai junto com o registro.
    const aprovado = form.status === 'FINALIZADO_APROVADO'
    const comprovanteDaFila = novo && aprovado && !comprovante
      ? pendentes.find((p) => p.tipo === 'COMPROVANTE_PAGAMENTO') : null
    const arquivo = aprovado ? (comprovante || comprovanteDaFila?.arquivo || null) : null
    const restantes = novo ? pendentes.filter((p) => p !== comprovanteDaFila) : []
    setSalvando(true)
    try {
      const salvo = novo
        ? await farApi.criar(dados, arquivo, admin ? fornecedorParam : null)
        : await farApi.atualizar(id, dados, arquivo)
      if (novo) {
        const falhas = []
        for (const p of restantes) {
          try {
            await farApi.anexar(salvo.id, p.arquivo, p.tipo)
          } catch (err) {
            falhas.push(`${p.arquivo.name}: ${mensagemErro(err)}`)
          }
        }
        setPendentes([])
        navegar(`/far/${salvo.id}`, {
          replace: true,
          state: {
            mensagem: falhas.length
              ? `FAR registrada, mas ${falhas.length} arquivo(s) não foram anexados (${falhas.join('; ')}). Anexe de novo abaixo.`
              : 'FAR registrada.'
          }
        })
        return
      }
      setFar(salvo)
      setForm(formDoServidor(salvo))
      setComprovante(null)
      setErros({})
      setMensagem('Alterações salvas.')
      carregarRelacionados(salvo.id)
    } catch (err) {
      setErro(mensagemErro(err))
      setErros(errosPorCampo(err))
    } finally {
      setSalvando(false)
    }
  }

  async function enviarAnexo() {
    const problema = validarArquivo(novoAnexo.arquivo)
    if (problema) {
      setErro(problema)
      return
    }
    setErro('')
    if (novo) {
      if (pendentes.length >= MAX_ANEXOS) {
        setErro(`No máximo ${MAX_ANEXOS} anexos por FAR.`)
        return
      }
      setPendentes((lista) => [...lista, { chave: `${Date.now()}-${lista.length}`, ...novoAnexo }])
      setNovoAnexo({ tipo: 'OUTRO', arquivo: null })
      if (novoAnexo.tipo === 'COMPROVANTE_PAGAMENTO') setErros((e) => ({ ...e, comprovante: undefined }))
      return
    }
    setSalvando(true)
    try {
      await farApi.anexar(id, novoAnexo.arquivo, novoAnexo.tipo)
      setNovoAnexo({ tipo: 'OUTRO', arquivo: null })
      setMensagem('Arquivo anexado.')
      setFar(await farApi.buscar(id))
      carregarRelacionados(id)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function baixarAnexo(anexo) {
    try {
      const blob = await farApi.conteudoAnexo(id, anexo.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = anexo.nomeArquivo
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível baixar o arquivo.'))
    }
  }

  async function confirmarModal() {
    setSalvando(true)
    setErro('')
    try {
      if (modal.tipo === 'excluirAnexo') {
        await farApi.excluirAnexo(id, modal.anexo.id)
        setMensagem('Arquivo excluído.')
        setFar(await farApi.buscar(id))
      } else if (modal.tipo === 'motivo') {
        const descricao = modal.descricao.trim()
        if (!descricao) {
          setModal((m) => ({ ...m, erro: 'Informe a descrição do motivo.' }))
          return
        }
        const criado = await farApi.criarMotivoFar({ descricao })
        const lista = await farApi.motivos().catch(() => motivos)
        setMotivos(lista.some((m) => m.id === criado.id) ? lista : [...lista, criado])
        alterarItem(modal.indice, { motivoId: String(criado.id) })
        setMensagem(`Motivo "${criado.descricao}" cadastrado.`)
        setModal(null)
        return
      } else if (modal.tipo === 'baixa') {
        if (!modal.tipoNf || !modal.referencia.trim()) {
          setModal((m) => ({ ...m, erro: !modal.tipoNf
            ? 'Informe se a NF é de perda ou de devolução ao fornecedor.'
            : 'Informe a NF da baixa fiscal.' }))
          return
        }
        setFar(await farApi.vincularBaixa(id, {
          tipo: modal.tipoNf, referencia: modal.referencia.trim(), observacao: modal.observacao.trim() || null
        }))
        setMensagem('Vínculo com a baixa fiscal registrado. A FAR ficou travada para o fornecedor.')
      } else if (modal.tipo === 'desfazer') {
        setFar(await farApi.desfazerBaixa(id, modal.motivo.trim() || null))
        setMensagem('Vínculo desfeito. O fornecedor pode alterar a FAR de novo.')
      }
      setModal(null)
      carregarRelacionados(id)
    } catch (err) {
      setModal((m) => ({ ...m, erro: mensagemErro(err) }))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="vazio">Carregando...</p>

  const titulo = novo ? 'Nova FAR'
    : !far?.numeroFar ? 'FAR sem número'
      : /^far/i.test(far.numeroFar) ? far.numeroFar : `FAR ${far.numeroFar}`

  return (
    <div className="far-pagina">
      <div className="cabecalho-pagina">
        <div>
          <h2>
            {titulo}{' '}
            {far && <span className={`etiqueta ${far.status}`}>{ROTULO_STATUS_FAR[far.status]}</span>}{' '}
            {far?.baixaFiscal && <span className="etiqueta BAIXA_OK">Baixa fiscal vinculada</span>}
          </h2>
          <p>
            {fornecedorNome && admin ? `${fornecedorNome} · ` : ''}
            {far ? `Registrada em ${formatarDataHora(far.dataCriacao)}${far.usuarioCriacao ? ` por ${far.usuarioCriacao}` : ''}`
              : 'Preencha os dados da visita. A FAR pode ser completada depois, conforme o processo andar.'}
          </p>
        </div>
        <div className="botoes">
          <button type="button" className="btn-secundario" onClick={() => navegar('/far')}>Voltar para a lista</button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagem && <div className="aviso sucesso">{mensagem}</div>}
      {far && !far.editavel && (
        <div className="aviso info">
          Esta FAR já foi vinculada à baixa fiscal e não pode mais ser alterada. Fale com a equipe interna se precisar corrigir algo.
        </div>
      )}
      {far?.comprovantePendente && (
        <div className="aviso atencao">Processo aprovado sem comprovante de pagamento anexado.</div>
      )}

      {/* ------------------------------------------------------ ocorrencia */}
      <section className="cartao">
        <h3>Ocorrência</h3>
        <div className="formulario">
          <div className="grade" style={{ maxWidth: 300 }}>
            <Campo label="Data da visita" obrigatorio erro={erros.dataVisita}>
              <input type="date" value={form.dataVisita} max={hojeIso()} disabled={!editavel}
                     className={erros.dataVisita ? 'invalido' : undefined}
                     onChange={(e) => alterar('dataVisita', e.target.value)} />
            </Campo>
          </div>

          <div className="far-itens">
            <div className="far-itens-cabecalho">
              <strong>Produtos avariados</strong>
              <span className="texto-suave">
                {form.itens.length} produto(s) · total {totalProdutos.toLocaleString('pt-BR')} unidade(s)
              </span>
            </div>
            {erros.itensGeral && <div className="aviso erro">{erros.itensGeral}</div>}

            {form.itens.map((item, n) => (
              <div className="far-item" key={item.chave}>
                <span className="far-item-numero">{n + 1}</span>
                <Campo label="Código do produto" obrigatorio erro={erroItem(n, 'codigoProduto')}
                       ajuda={item.descricaoProduto
                         ? undefined
                         : (produtos.length ? 'Pesquise pelo nome ou digite o código.' : 'Código de fábrica ou do WinThor.')}>
                  <ProdutoAutocomplete valor={item.codigoProduto} produtos={produtos} disabled={!editavel}
                                       invalido={!!erroItem(n, 'codigoProduto')}
                                       aoMudar={(codigo, descricao) => alterarItem(n, {
                                         codigoProduto: codigo,
                                         // mantem a descricao gravada enquanto o codigo nao mudar
                                         descricaoProduto: descricao ?? (codigo === item.codigoProduto ? item.descricaoProduto : '')
                                       })} />
                  {item.descricaoProduto && <span className="descricao-produto">{item.descricaoProduto}</span>}
                </Campo>
                <Campo label="Qtd." obrigatorio erro={erroItem(n, 'quantidade')}>
                  <input type="number" inputMode="numeric" min={1} step={1} value={item.quantidade} disabled={!editavel}
                         className={erroItem(n, 'quantidade') ? 'invalido' : undefined}
                         onChange={(e) => alterarItem(n, { quantidade: e.target.value })} />
                </Campo>
                <Campo label="Motivo" obrigatorio erro={erroItem(n, 'motivoId')}>
                  <div className="motivo-linha">
                    <select value={item.motivoId} disabled={!editavel}
                            className={erroItem(n, 'motivoId') ? 'invalido' : undefined}
                            onChange={(e) => alterarItem(n, { motivoId: e.target.value })}>
                      <option value="">Selecione...</option>
                      {opcoesMotivo.map((m) => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                    </select>
                    {editavel && (
                      <button type="button" className="btn-secundario btn-pequeno" title="Cadastrar um motivo novo"
                              onClick={() => setModal({ tipo: 'motivo', indice: n, descricao: '' })}>+ Motivo</button>
                    )}
                  </div>
                </Campo>
                {editavel && (
                  <button type="button" className="btn-perigo btn-pequeno far-item-remover"
                          disabled={form.itens.length === 1} title="Remover este produto"
                          onClick={() => removerItem(n)}>Remover</button>
                )}
              </div>
            ))}

            {editavel && (
              <div>
                <button type="button" className="btn-secundario" onClick={incluirItem}>+ Adicionar produto</button>
              </div>
            )}
          </div>
          <Campo label="Obs. da ocorrência" erro={erros.obsOcorrencia}>
            <textarea value={form.obsOcorrencia} maxLength={1000} disabled={!editavel}
                      placeholder="O que foi encontrado na visita: produtos, lotes, local..."
                      onChange={(e) => alterar('obsOcorrencia', e.target.value)} />
          </Campo>
        </div>
      </section>

      {/* ------------------------------------------------------ FAR */}
      <section className="cartao">
        <h3>FAR</h3>
        <div className="formulario">
          <div className="grade">
            <Campo label="Data de abertura da FAR" erro={erros.dataAberturaFar}>
              <input type="date" value={form.dataAberturaFar} max={hojeIso()} min={form.dataVisita || undefined}
                     disabled={!editavel} className={erros.dataAberturaFar ? 'invalido' : undefined}
                     onChange={(e) => alterar('dataAberturaFar', e.target.value)} />
            </Campo>
            <Campo label="Nº da FAR" erro={erros.numeroFar} ajuda="Informe junto com a data de abertura.">
              <input value={form.numeroFar} maxLength={30} disabled={!editavel}
                     className={erros.numeroFar ? 'invalido' : undefined}
                     onChange={(e) => alterar('numeroFar', e.target.value)} />
            </Campo>
            <Campo label="Nº da NF de compra" erro={erros.numeroNota}
                   ajuda={!verificacaoNota ? 'Conferida no WinThor ao sair do campo.' : undefined}>
              <input value={form.numeroNota} maxLength={15} inputMode="numeric" disabled={!editavel}
                     className={erros.numeroNota || (verificacaoNota?.consultado && !verificacaoNota.encontrada && !verificacaoNota.carregando)
                       ? 'invalido' : undefined}
                     onChange={(e) => {
                       alterar('numeroNota', e.target.value.replace(/\D/g, ''))
                       setVerificacaoNota(null)
                     }}
                     onBlur={(e) => verificarNota(e.target.value)} />
              {verificacaoNota && (
                <span className={`verificacao-nota ${verificacaoNota.carregando ? 'nf-consultando'
                  : verificacaoNota.encontrada ? 'nf-ok' : verificacaoNota.consultado ? 'nf-erro' : 'nf-aviso'}`}>
                  {verificacaoNota.carregando ? 'Conferindo no WinThor...' : verificacaoNota.mensagem}
                </span>
              )}
              {produtosForaDaNota.length > 0 && (
                <span className="verificacao-nota nf-aviso">
                  Produto(s) {produtosForaDaNota.join(', ')} não constam nesta NF.
                </span>
              )}
            </Campo>
            <Campo label="Nº do pedido" erro={erros.numeroPedido}>
              <input value={form.numeroPedido} maxLength={30} inputMode="numeric" disabled={!editavel}
                     className={erros.numeroPedido ? 'invalido' : undefined}
                     onChange={(e) => alterar('numeroPedido', e.target.value)} />
            </Campo>
            <Campo label="Situação" obrigatorio erro={erros.status}>
              <select value={form.status} disabled={!editavel} onChange={(e) => alterar('status', e.target.value)}>
                {Object.entries(ROTULO_STATUS_FAR).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </Campo>
            {form.status === 'OUTROS' && (
              <Campo label="Qual situação?" obrigatorio erro={erros.statusOutros}>
                <input value={form.statusOutros} maxLength={100} disabled={!editavel}
                       className={erros.statusOutros ? 'invalido' : undefined}
                       onChange={(e) => alterar('statusOutros', e.target.value)} />
              </Campo>
            )}
          </div>

          {form.status === 'FINALIZADO_APROVADO' && (
            <div className={`bloco-comprovante ${precisaComprovante && !comprovante ? 'faltando' : ''}`}>
              {qtdComprovantes > 0 ? (
                <p style={{ margin: 0 }}>
                  <strong>Comprovante de pagamento anexado</strong>
                  <span className="texto-suave">
                    {comprovantesNaFila > 0 && !far
                      ? ' · está na lista de anexos e será enviado ao registrar a FAR.'
                      : ` · ${qtdComprovantes} arquivo(s), veja em Anexos.`}
                  </span>
                </p>
              ) : (
                <Campo label="Comprovante de pagamento" obrigatorio erro={erros.comprovante}
                       ajuda={`Obrigatório para processo aprovado. PDF, JPG, PNG ou WEBP até ${MAX_MB} MB.`}>
                  {comprovante ? (
                    <div className="botoes" style={{ alignItems: 'center' }}>
                      <span>{comprovante.name} ({formatarTamanho(comprovante.size)})</span>
                      <button type="button" className="btn-secundario btn-pequeno" onClick={() => setComprovante(null)}>Trocar</button>
                    </div>
                  ) : (
                    <input type="file" accept={ACEITOS} disabled={!editavel} onChange={escolherComprovante} />
                  )}
                </Campo>
              )}
            </div>
          )}

          <div className="grade-larga">
            <Campo label="Obs. FAR (fornecedor)" erro={erros.obsFarFornecedor}>
              <textarea value={form.obsFarFornecedor} maxLength={1000} disabled={!editavel}
                        onChange={(e) => alterar('obsFarFornecedor', e.target.value)} />
            </Campo>
            <Campo label="Obs. FAR (empresa)" erro={erros.obsFarEmpresa}
                   ajuda={admin ? 'Retorno da equipe interna, visível para o fornecedor.' : 'Preenchido pela equipe interna.'}>
              {admin ? (
                <textarea value={form.obsFarEmpresa} maxLength={1000}
                          onChange={(e) => alterar('obsFarEmpresa', e.target.value)} />
              ) : (
                <div className="leitura">{form.obsFarEmpresa || '-'}</div>
              )}
            </Campo>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ anexos */}
      <section className="cartao">
          <h3>Anexos</h3>
          {novo && (
            pendentes.length === 0 ? (
              <p className="texto-suave">
                Nenhum arquivo. Anexe fotos da avaria, nota fiscal, laudo ou o comprovante de pagamento:
                eles são enviados ao registrar a FAR.
              </p>
            ) : (
              <ul className="lista-anexos">
                {pendentes.map((p) => (
                  <li key={p.chave}>
                    <span className={`tipo-anexo ${p.tipo}`}>{ROTULO_ANEXO[p.tipo]}</span>
                    <span className="nome">{p.arquivo.name}
                      <span className="texto-suave"> · {formatarTamanho(p.arquivo.size)} · será enviado ao registrar</span>
                    </span>
                    <button type="button" className="btn-perigo btn-pequeno"
                            onClick={() => setPendentes((l) => l.filter((x) => x !== p))}>Remover</button>
                  </li>
                ))}
              </ul>
            )
          )}
          {!novo && (anexos.length === 0 ? (
            <p className="texto-suave">Nenhum arquivo anexado.</p>
          ) : (
            <ul className="lista-anexos">
              {anexos.map((a) => (
                <li key={a.id}>
                  <span className={`tipo-anexo ${a.tipo}`}>{ROTULO_ANEXO[a.tipo]}</span>
                  <span className="nome">{a.nomeArquivo}
                    <span className="texto-suave"> · {formatarTamanho(a.tamanho)} · {formatarDataHora(a.dataCriacao)}</span>
                  </span>
                  <button type="button" className="btn-secundario btn-pequeno" onClick={() => baixarAnexo(a)}>Baixar</button>
                  {editavel && (
                    <button type="button" className="btn-perigo btn-pequeno"
                            onClick={() => setModal({ tipo: 'excluirAnexo', anexo: a })}>Excluir</button>
                  )}
                </li>
              ))}
            </ul>
          ))}
          {editavel && (
            <div className="filtros" style={{ marginTop: 12, marginBottom: 0 }}>
              <Campo label="Tipo">
                <select value={novoAnexo.tipo} onChange={(e) => setNovoAnexo({ ...novoAnexo, tipo: e.target.value })}>
                  <option value="OUTRO">Outro documento (fotos, laudo, NF...)</option>
                  <option value="COMPROVANTE_PAGAMENTO">Comprovante de pagamento</option>
                </select>
              </Campo>
              <Campo label="Arquivo" ajuda={`PDF, JPG, PNG ou WEBP até ${MAX_MB} MB.`}>
                <input type="file" accept={ACEITOS}
                       key={novoAnexo.arquivo ? 'com' : 'sem'}
                       onChange={(e) => setNovoAnexo({ ...novoAnexo, arquivo: e.target.files?.[0] || null })} />
              </Campo>
              <button type="button" className="btn-secundario" disabled={salvando || !novoAnexo.arquivo}
                      onClick={enviarAnexo}>{novo ? 'Adicionar' : 'Anexar'}</button>
            </div>
          )}
      </section>

      {/* ------------------------------------------------------ baixa fiscal */}
      {!novo && far && (
        <section className="cartao">
          <div className="cabecalho-cartao">
            <h3>Vínculo de baixa fiscal no sistema</h3>
            {admin && (
              <div className="botoes">
                {far.baixaFiscal ? (
                  <button type="button" className="btn-perigo btn-pequeno" disabled={salvando}
                          onClick={() => setModal({ tipo: 'desfazer', motivo: '' })}>Desfazer vínculo</button>
                ) : (
                  <button type="button" className="btn-sucesso btn-pequeno" disabled={salvando || !far.numeroFar}
                          title={!far.numeroFar ? 'A FAR precisa ter número para ser vinculada' : undefined}
                          onClick={() => setModal({ tipo: 'baixa', tipoNf: '', referencia: '', observacao: '' })}>
                    Registrar vínculo
                  </button>
                )}
              </div>
            )}
          </div>
          {far.baixaFiscal ? (
            <div className="resumo-pedido">
              <div><span>Situação</span><strong style={{ color: 'var(--cor-sucesso)' }}>Vinculada</strong></div>
              <div><span>Tipo da NF</span><strong>{far.baixaFiscalTipoRotulo
                ? (far.baixaFiscalTipo === 'DEVOLUCAO' ? 'Devolução ao fornecedor' : 'NF de perda') : '-'}</strong></div>
              <div><span>NF baixa fiscal</span><strong>{far.baixaFiscalReferencia || '-'}</strong></div>
              <div><span>Registrado em</span><strong>{formatarDataHora(far.dataBaixaFiscal)}</strong></div>
              <div><span>Por</span><strong>{far.usuarioBaixa || '-'}</strong></div>
              {far.baixaFiscalObservacao && (
                <div style={{ gridColumn: '1 / -1' }}><span>Observação</span><strong>{far.baixaFiscalObservacao}</strong></div>
              )}
            </div>
          ) : (
            <p className="texto-suave" style={{ margin: 0 }}>
              {admin
                ? 'Registre aqui quando a FAR for vinculada ao processo de baixa fiscal da avaria no sistema. Depois do vínculo o fornecedor não altera mais a FAR.'
                : 'Ainda não vinculada. A equipe interna registra o vínculo quando a baixa fiscal da avaria for feita no sistema.'}
            </p>
          )}
        </section>
      )}

      {/* ------------------------------------------------------ historico */}
      {historico.length > 0 && (
        <section className="cartao">
          <h3>Histórico</h3>
          <ul className="historico">
            {historico.map((h) => (
              <li key={h.id}>
                <strong>{ROTULO_EVENTO[h.evento] || h.evento}</strong>
                <span className="texto-suave"> · {formatarDataHora(h.dataEvento)} · {h.usuario}</span>
                {h.descricao && <p>{h.descricao}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editavel && (
        <div className="barra-acoes">
          <button type="button" className="btn-secundario" onClick={() => navegar('/far')}>Cancelar</button>
          <button type="button" className="btn-primario" disabled={salvando || (novo && admin && !fornecedorParam)}
                  onClick={salvar}>
            {salvando ? 'Salvando...' : novo ? 'Registrar FAR' : 'Salvar alterações'}
          </button>
        </div>
      )}

      {modal && (
        <Modal titulo={{
          excluirAnexo: 'Excluir arquivo',
          motivo: 'Cadastrar motivo de avaria',
          baixa: 'Registrar vínculo com a baixa fiscal',
          desfazer: 'Desfazer vínculo com a baixa fiscal'
        }[modal.tipo]} aoFechar={() => setModal(null)}
               rodape={(
                 <>
                   <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Cancelar</button>
                   <button type="button" className={modal.tipo === 'baixa' ? 'btn-sucesso' : modal.tipo === 'motivo' ? 'btn-primario' : 'btn-perigo'}
                           disabled={salvando} onClick={confirmarModal}>
                     {salvando ? 'Aguarde...' : 'Confirmar'}
                   </button>
                 </>
               )}>
          {modal.erro && <div className="aviso erro">{modal.erro}</div>}
          {modal.tipo === 'motivo' && (
            <form className="formulario" onSubmit={(e) => { e.preventDefault(); confirmarModal() }}>
              <Campo label="Descrição do motivo" obrigatorio
                     ajuda="Fica disponível para as próximas FARs. Confira se já não existe na lista antes de cadastrar.">
                <input value={modal.descricao} maxLength={100} autoFocus placeholder="Ex.: Embalagem violada"
                       onChange={(e) => setModal({ ...modal, descricao: e.target.value, erro: undefined })} />
              </Campo>
            </form>
          )}
          {modal.tipo === 'excluirAnexo' && <p>Excluir o arquivo <strong>{modal.anexo.nomeArquivo}</strong>?</p>}
          {modal.tipo === 'baixa' && (
            <div className="formulario">
              <p style={{ margin: 0 }}>
                Confirma que a FAR <strong>{far?.numeroFar}</strong> foi vinculada ao processo de baixa fiscal da avaria no sistema?
              </p>
              <Campo label="A NF é de" obrigatorio>
                <div className="opcoes-radio">
                  {[['PERDA', 'NF de perda'], ['DEVOLUCAO', 'Devolução ao fornecedor']].map(([valor, rotulo]) => (
                    <label key={valor} className={modal.tipoNf === valor ? 'marcada' : undefined}>
                      <input type="radio" name="tipoNf" value={valor} checked={modal.tipoNf === valor}
                             onChange={() => setModal({ ...modal, tipoNf: valor, erro: undefined })} />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </Campo>
              <Campo label="NF baixa fiscal" obrigatorio ajuda="Número da nota fiscal que deu baixa na avaria.">
                <input value={modal.referencia} maxLength={100} inputMode="numeric"
                       onChange={(e) => setModal({ ...modal, referencia: e.target.value, erro: undefined })} />
              </Campo>
              <Campo label="Observação">
                <textarea value={modal.observacao} maxLength={500}
                          onChange={(e) => setModal({ ...modal, observacao: e.target.value })} />
              </Campo>
            </div>
          )}
          {modal.tipo === 'desfazer' && (
            <div className="formulario">
              <p style={{ margin: 0 }}>A FAR volta a ficar editável para o fornecedor. O vínculo anterior fica registrado no histórico.</p>
              <Campo label="Motivo">
                <textarea value={modal.motivo} maxLength={500} autoFocus
                          onChange={(e) => setModal({ ...modal, motivo: e.target.value })} />
              </Campo>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
