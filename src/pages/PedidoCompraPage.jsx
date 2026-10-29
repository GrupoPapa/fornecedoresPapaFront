import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { comprasApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import {
  decimalParaTexto, formatarData, formatarDataHora, formatarMoeda, formatarNumero, hojeIso, lerDecimal,
  ROTULO_STATUS, ROTULO_STATUS_COMPRA, ROTULO_TIPO_COMPRA
} from '../utils/format'
import Campo from '../components/Campo'
import Modal from '../components/Modal'

const LIMITE_CATALOGO = 2000

const ROTULO_EVENTO = {
  CRIACAO: 'Pedido criado',
  ENVIO: 'Enviado para análise',
  REENVIO: 'Reenviado após reavaliação',
  DIVERGENCIA: 'Divergência no cadastro',
  CADASTRO_REANALISADO: 'Cadastro reanalisado',
  DIVERGENCIA_LIBERADA: 'Divergência liberada pelo fiscal',
  APROVACAO: 'Aprovado',
  REPROVACAO: 'Devolvido para reavaliação',
  SUGESTAO_GERADA: 'Sugestão gerada no WinThor',
  ERRO_SUGESTAO: 'Erro ao gerar a sugestão',
  REABERTURA: 'Voltou para análise',
  CANCELAMENTO: 'Cancelado'
}

const ROTULO_VARIACAO = {
  ACIMA: 'Acima',
  ABAIXO: 'Abaixo',
  OK: 'Dentro da faixa',
  SEM_HISTORICO: 'Sem compras anteriores',
  PRODUTO_NOVO: 'Produto novo',
  ERRO: 'Indisponível'
}

function chaveDe(p) {
  return p.codProdErp ? `W${p.codProdErp}` : `P${p.produtoId}`
}

function itemDoServidor(i) {
  return {
    chave: chaveDe(i),
    codProdErp: i.codProdErp,
    produtoId: i.produtoId,
    produtoStatus: i.produtoStatus,
    descricao: i.descricao,
    codigoFabrica: i.codigoFabrica,
    embalagem: i.embalagem,
    unidade: i.unidade,
    quantidade: decimalParaTexto(i.quantidade),
    precoUnitario: decimalParaTexto(i.precoUnitario),
    observacao: i.observacao || '',
    divergencia: i.divergencia,
    id: i.id
  }
}

export default function PedidoCompraPage() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const { admin } = useAuth()
  const novo = !id
  const fornecedorParam = parametros.get('fornecedor')

  const [pedido, setPedido] = useState(null)
  const [form, setForm] = useState({ codFilial: '', tipo: 'NORMAL', dataPrevisaoEntrega: '', observacao: '' })
  const [itens, setItens] = useState([])
  const [catalogo, setCatalogo] = useState({ produtos: [], avisoWinthor: null })
  const [filiais, setFiliais] = useState([])
  const [busca, setBusca] = useState('')
  const [sujo, setSujo] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [comparativo, setComparativo] = useState(null)
  const [aberto, setAberto] = useState({})
  const [historico, setHistorico] = useState([])
  const [situacao, setSituacao] = useState(null)
  const [modal, setModal] = useState(null) // {tipo, parecer, codFilial, forcar}
  const [geraSugestao, setGeraSugestao] = useState(false)

  const editavel = novo || !!pedido?.editavel
  const fornecedorId = admin ? (pedido?.fornecedorId || fornecedorParam) : null
  const status = pedido?.status

  // ------------------------------------------------------------ carga
  const aplicarPedido = useCallback((p) => {
    setPedido(p)
    setForm({
      codFilial: p.codFilial || '',
      tipo: p.tipo || 'NORMAL',
      dataPrevisaoEntrega: p.dataPrevisaoEntrega || '',
      observacao: p.observacao || ''
    })
    setItens((p.itens || []).map(itemDoServidor))
    setSujo(false)
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      if (!novo) {
        const p = await comprasApi.buscar(id)
        aplicarPedido(p)
        comprasApi.historico(id).then(setHistorico).catch(() => setHistorico([]))
      } else {
        setPedido(null)
        setItens([])
        setHistorico([])
      }
    } catch (err) {
      setErro(mensagemErro(err, 'Pedido não encontrado.'))
    } finally {
      setCarregando(false)
    }
  }, [id, novo, aplicarPedido])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    comprasApi.filiais().then(setFiliais).catch(() => setFiliais([]))
    comprasApi.configuracao().then((c) => setGeraSugestao(!!c.gerarSugestaoHabilitada)).catch(() => {})
  }, [])

  const carregarCatalogo = useCallback(async () => {
    if (admin && !fornecedorId) return
    try {
      setCatalogo(await comprasApi.catalogo(fornecedorId))
    } catch (err) {
      setCatalogo({ produtos: [], avisoWinthor: mensagemErro(err, 'Não foi possível carregar os produtos.') })
    }
  }, [admin, fornecedorId])

  useEffect(() => {
    if (editavel && !carregando) carregarCatalogo()
  }, [editavel, carregando, carregarCatalogo])

  // comparativo de precos e situacao na 220 (setor fiscal)
  useEffect(() => {
    if (!admin || !pedido || pedido.status === 'RASCUNHO' || pedido.status === 'CANCELADO') return
    comprasApi.comparativo(pedido.id).then(setComparativo).catch(() => setComparativo(null))
  }, [admin, pedido])

  useEffect(() => {
    if (!pedido?.numSugestaoErp) { setSituacao(null); return }
    comprasApi.situacaoWinthor(pedido.id).then(setSituacao).catch(() => setSituacao(null))
  }, [pedido])

  // ------------------------------------------------------------ itens
  const incluidos = useMemo(() => new Set(itens.map((i) => i.chave)), [itens])

  const catalogoFiltrado = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = !termo ? catalogo.produtos : catalogo.produtos.filter((p) =>
      [p.descricao, p.codigoFabrica, p.codBarras, p.codProdErp && String(p.codProdErp)]
        .some((v) => v && String(v).toLowerCase().includes(termo)))
    return lista.slice(0, LIMITE_CATALOGO)
  }, [catalogo, busca])

  const totalFiltrado = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return catalogo.produtos.length
    return catalogo.produtos.filter((p) =>
      [p.descricao, p.codigoFabrica, p.codBarras, p.codProdErp && String(p.codProdErp)]
        .some((v) => v && String(v).toLowerCase().includes(termo))).length
  }, [catalogo, busca])

  function adicionar(p) {
    const chave = chaveDe(p)
    if (incluidos.has(chave)) return
    setItens((lista) => [...lista, {
      chave, codProdErp: p.codProdErp, produtoId: p.produtoId, produtoStatus: p.situacaoCadastro,
      descricao: p.descricao, codigoFabrica: p.codigoFabrica, embalagem: p.embalagem, unidade: p.unidade,
      quantidade: '', precoUnitario: '', observacao: ''
    }])
    setSujo(true)
  }

  function alterarItem(chave, campo, valor) {
    setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, [campo]: valor } : i)))
    setSujo(true)
  }

  function removerItem(chave) {
    setItens((lista) => lista.filter((i) => i.chave !== chave))
    setSujo(true)
  }

  function alterarForm(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setSujo(true)
  }

  const totalPedido = useMemo(() => itens.reduce((soma, i) => {
    const q = lerDecimal(i.quantidade); const p = lerDecimal(i.precoUnitario)
    return soma + (q && p ? q * p : 0)
  }, 0), [itens])

  // ------------------------------------------------------------ salvar / enviar
  function montarDados() {
    const problemas = []
    const dados = {
      codFilial: form.codFilial || null,
      tipo: form.tipo,
      dataPrevisaoEntrega: form.dataPrevisaoEntrega || null,
      observacao: form.observacao || null,
      itens: itens.map((i, idx) => {
        const quantidade = lerDecimal(i.quantidade)
        const precoUnitario = lerDecimal(i.precoUnitario)
        if (!quantidade || quantidade <= 0) problemas.push(`item ${idx + 1} (${i.descricao}): quantidade`)
        if (!precoUnitario || precoUnitario <= 0) problemas.push(`item ${idx + 1} (${i.descricao}): preço`)
        return {
          codProdErp: i.codProdErp || null,
          produtoId: i.codProdErp ? null : i.produtoId,
          quantidade,
          precoUnitario,
          observacao: i.observacao || null
        }
      })
    }
    return { dados, problemas }
  }

  async function salvar({ silencioso = false } = {}) {
    setErro(''); setMensagem('')
    const { dados, problemas } = montarDados()
    if (problemas.length) {
      setErro(`Preencha com valores maiores que zero: ${problemas.join('; ')}.`)
      return null
    }
    setSalvando(true)
    try {
      let p
      if (novo) {
        p = await comprasApi.criar(dados, fornecedorParam)
        aplicarPedido(p)
        navegar(`/compras/${p.id}`, { replace: true })
      } else {
        p = await comprasApi.atualizar(id, dados)
        aplicarPedido(p)
        comprasApi.historico(id).then(setHistorico).catch(() => {})
      }
      if (!silencioso) setMensagem(`Pedido ${p.numero} salvo.`)
      return p
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível salvar o pedido.'))
      return null
    } finally {
      setSalvando(false)
    }
  }

  async function enviar() {
    setModal(null)
    const salvo = (novo || sujo) ? await salvar({ silencioso: true }) : pedido
    if (!salvo) return
    setSalvando(true)
    try {
      const p = await comprasApi.enviar(salvo.id)
      aplicarPedido(p)
      comprasApi.historico(p.id).then(setHistorico).catch(() => {})
      setMensagem(p.status === 'DIVERGENCIA'
        ? 'Pedido enviado. Alguns itens divergem do cadastro e passarão por reanálise do setor fiscal.'
        : 'Pedido enviado para análise do setor fiscal.')
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível enviar o pedido.'))
    } finally {
      setSalvando(false)
    }
  }

  async function acao(fn, sucesso) {
    setErro(''); setMensagem('')
    setSalvando(true)
    try {
      const p = await fn()
      if (p?.id) aplicarPedido(p)
      comprasApi.historico(id).then(setHistorico).catch(() => {})
      setMensagem(typeof sucesso === 'function' ? sucesso(p) : sucesso)
      setModal(null)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  function textoAprovacao(p) {
    if (p.statusIntegracao === 'GERADA') {
      return `Pedido aprovado. Sugestão ${p.numSugestaoErp} gerada no WinThor — importe na rotina 220.`
    }
    if (p.statusIntegracao === 'ERRO') return 'Pedido aprovado, mas a sugestão não foi gerada. Veja o erro abaixo.'
    return 'Pedido aprovado.'
  }

  // ------------------------------------------------------------ render
  if (carregando) return <p>Carregando...</p>
  if (!novo && !pedido) {
    return <>{erro && <div className="aviso erro">{erro}</div>}
      <button type="button" className="btn-secundario" onClick={() => navegar('/compras')}>Voltar</button></>
  }
  if (novo && admin && !fornecedorParam) {
    return <div className="aviso atencao">Selecione o fornecedor na lista de pedidos de compra antes de digitar um pedido.</div>
  }

  const mapaComparativo = Object.fromEntries((comparativo?.itens || []).map((c) => [c.itemId, c]))
  const mostrarComparativo = admin && !!comparativo && !editavel
  const itensDivergentes = itens.filter((i) => i.divergencia)
  const nomeFilial = (cod) => filiais.find((f) => f.codigo === cod)?.nome
  const colunasItens = 7 + (mostrarComparativo ? 3 : 0) + (editavel ? 1 : 0)

  return (
    <div className="pedido-compra">
      <div className="cabecalho-pagina" style={{ marginBottom: 0 }}>
        <div>
          <h2>{novo ? 'Novo pedido de compra' : `Pedido de compra ${pedido.numero}`}</h2>
          <p>
            {pedido?.fornecedorNome && <>{pedido.fornecedorNome} · </>}
            {pedido
              ? <span className={`etiqueta ${pedido.status}`}>{ROTULO_STATUS_COMPRA[pedido.status]}</span>
              : 'Selecione os produtos abaixo e informe quantidade e preço.'}
          </p>
        </div>
        <button type="button" className="btn-secundario" onClick={() => navegar('/compras')}>Voltar</button>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagem && <div className="aviso sucesso">{mensagem}</div>}

      {status === 'REPROVADO' && pedido.parecer && (
        <div className="aviso atencao">
          <strong>Devolvido pelo setor fiscal:</strong> {pedido.parecer}
          {!admin && <><br />Ajuste o que for preciso e clique em <strong>Reenviar para análise</strong>.</>}
        </div>
      )}
      {status === 'DIVERGENCIA' && (
        <div className="aviso atencao">
          {admin
            ? <>Este pedido tem itens que divergem do cadastro. Reanalise o cadastro (produtos novos precisam
                estar aprovados e gravados no WinThor na aba <strong>Cadastro de produtos</strong>) e conclua a reanálise.</>
            : <>Alguns itens divergem do cadastro. O setor fiscal está reanalisando antes de conferir os preços.</>}
        </div>
      )}
      {status === 'EM_ANALISE' && !admin && (
        <div className="aviso info">Seu pedido está com o setor fiscal, que confere os preços antes de aprovar.</div>
      )}
      {status === 'APROVADO' && (
        <div className={`aviso ${pedido.statusIntegracao === 'ERRO' ? 'erro' : 'sucesso'}`}>
          {pedido.statusIntegracao === 'GERADA' && <>Aprovado. Sugestão <strong>{pedido.numSugestaoErp}</strong> gerada
            no WinThor em {formatarDataHora(pedido.dataIntegracao)}
            {situacao?.importada ? ' e já importada na rotina 220.' : ' — aguardando importação na rotina 220.'}</>}
          {pedido.statusIntegracao === 'PENDENTE' && <>Aprovado em {formatarDataHora(pedido.dataAnalise)}.
            {admin ? ' A sugestão ainda não foi gerada no WinThor.' : ' O pedido seguirá para o WinThor.'}</>}
          {pedido.statusIntegracao === 'ERRO' && <>Aprovado, mas a geração da sugestão falhou
            {admin && <>: {pedido.mensagemErro}</>}.</>}
          {pedido.parecer && <><br />Parecer: {pedido.parecer}</>}
        </div>
      )}
      {status === 'APROVADO' && situacao?.itens?.some((s) => !s.numPed && s.obs) && (
        <div className="aviso atencao">
          <strong>A rotina 220 não importou alguns itens:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {situacao.itens.filter((s) => !s.numPed && s.obs).map((s) => (
              <li key={s.codProd}>{s.codProd} · {itens.find((i) => i.codProdErp === s.codProd)?.descricao || ''} — {s.obs}</li>
            ))}
          </ul>
          Depois de corrigir no WinThor, importe a sugestão {pedido.numSugestaoErp} de novo na 220.
        </div>
      )}

      {/* ---------------------------------------------------------- cabecalho */}
      <section className="cartao">
        <h3>Dados do pedido</h3>
        {editavel ? (
          <div className="grade">
            <Campo label="Filial de entrega" obrigatorio>
              <select value={form.codFilial} onChange={(e) => alterarForm('codFilial', e.target.value)}>
                <option value="">Selecione</option>
                {filiais.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} - {f.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Previsão de entrega" obrigatorio>
              <input type="date" min={hojeIso()} value={form.dataPrevisaoEntrega}
                     onChange={(e) => alterarForm('dataPrevisaoEntrega', e.target.value)} />
            </Campo>
            <Campo label="Tipo do pedido">
              <select value={form.tipo} onChange={(e) => alterarForm('tipo', e.target.value)}>
                {Object.entries(ROTULO_TIPO_COMPRA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </Campo>
            <Campo label="Observações" ajuda="Condições, prazo ou qualquer informação para o setor fiscal.">
              <textarea maxLength={500} value={form.observacao}
                        onChange={(e) => alterarForm('observacao', e.target.value)} />
            </Campo>
          </div>
        ) : (
          <div className="resumo-pedido">
            <div><span>Filial</span><strong>{pedido.codFilial ? `${pedido.codFilial} - ${nomeFilial(pedido.codFilial) || ''}` : '-'}</strong></div>
            <div><span>Previsão de entrega</span><strong>{formatarData(pedido.dataPrevisaoEntrega)}</strong></div>
            <div><span>Tipo</span><strong>{ROTULO_TIPO_COMPRA[pedido.tipo]}</strong></div>
            <div><span>Total</span><strong>{formatarMoeda(pedido.valorTotal)}</strong></div>
            <div><span>Enviado em</span><strong>{formatarDataHora(pedido.dataEnvio)}</strong></div>
            {pedido.numSugestaoErp && <div><span>Sugestão WinThor</span><strong>{pedido.numSugestaoErp}</strong></div>}
            {pedido.observacao && <div style={{ gridColumn: '1 / -1' }}><span>Observações</span>{pedido.observacao}</div>}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- catalogo */}
      {editavel && (
        <section className="cartao">
          <div className="cabecalho-cartao">
            <h3>Produtos disponíveis</h3>
            <div className="botoes">
              <button type="button" className="btn-secundario btn-pequeno" onClick={carregarCatalogo}>
                Atualizar lista
              </button>
              {!admin && (
                <a className="btn-secundario btn-pequeno" href="/pedidos" target="_blank" rel="noreferrer"
                   style={{ textDecoration: 'none', border: '1px solid var(--cor-borda)', borderRadius: 'var(--raio)', padding: '5px 10px', color: 'var(--cor-texto)' }}
                   title="Abre o cadastro de produtos numa nova aba. Depois clique em Atualizar lista.">
                  Cadastrar produto novo
                </a>
              )}
            </div>
          </div>
          {catalogo.avisoWinthor && <div className="aviso atencao">{catalogo.avisoWinthor}</div>}
          <p className="texto-suave" style={{ marginTop: 0 }}>
            Produto que ainda não existe na lista? Cadastre-o primeiro em <strong>Cadastro de produtos</strong>;
            ele aparece aqui marcado como <span className="item-novo">novo</span> e passa pela análise do cadastro.
          </p>
          <div className="filtros" style={{ marginBottom: 10 }}>
            <Campo label="Buscar produto">
              <input type="search" value={busca} placeholder="Descrição, código de fábrica, código WinThor ou EAN"
                     onChange={(e) => setBusca(e.target.value)} />
            </Campo>
          </div>
          <div className="catalogo-lista">
            <table>
              <thead>
                <tr><th>Código</th><th>Descrição</th><th>Embalagem</th><th>Cód. fábrica</th><th></th></tr>
              </thead>
              <tbody>
                {catalogoFiltrado.length === 0 && (
                  <tr><td colSpan={5} className="vazio">Nenhum produto encontrado.</td></tr>
                )}
                {catalogoFiltrado.map((p) => {
                  const ja = incluidos.has(chaveDe(p))
                  return (
                    <tr key={chaveDe(p)} className={ja ? 'incluido' : undefined}>
                      <td>{p.codProdErp || <span className="item-novo">novo</span>}</td>
                      <td>
                        {p.descricao}
                        {p.origem === 'PORTAL' && (
                          <span className="texto-suave"> · cadastro {ROTULO_STATUS[p.situacaoCadastro]?.toLowerCase()}</span>
                        )}
                      </td>
                      <td>{[p.embalagem, p.unidade].filter(Boolean).join(' / ') || '-'}</td>
                      <td>{p.codigoFabrica || '-'}</td>
                      <td>
                        <button type="button" className={ja ? 'btn-secundario btn-pequeno' : 'btn-primario btn-pequeno'}
                                disabled={ja} onClick={() => adicionar(p)}>
                          {ja ? 'No pedido' : 'Adicionar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalFiltrado > LIMITE_CATALOGO && (
            <p className="texto-suave">Mostrando {LIMITE_CATALOGO} de {totalFiltrado} produtos. Use a busca para encontrar os demais.</p>
          )}
        </section>
      )}

      {/* ---------------------------------------------------------- itens */}
      <section className="cartao">
        <div className="cabecalho-cartao">
          <h3>Itens do pedido ({itens.length})</h3>
          {mostrarComparativo && (
            <span className="texto-suave">
              Comparativo com as últimas entradas no WinThor · destaque acima de ±{formatarNumero(comparativo.alertaPercentual, 2)}%
            </span>
          )}
        </div>
        {admin && itensDivergentes.length > 0 && !editavel && (
          <div className="aviso atencao">{itensDivergentes.length} item(ns) com divergência de cadastro.</div>
        )}
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Produto</th>
                <th>Embalagem</th>
                <th className="numero">Quantidade</th>
                <th className="numero">Preço unit.</th>
                <th className="numero">Total</th>
                {mostrarComparativo && <th className="numero">Último preço</th>}
                {mostrarComparativo && <th className="numero">Variação</th>}
                {mostrarComparativo && <th></th>}
                <th>Obs.</th>
                {editavel && <th></th>}
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr><td colSpan={colunasItens} className="vazio">
                  {editavel ? 'Adicione produtos pela lista acima.' : 'Pedido sem itens.'}
                </td></tr>
              )}
              {itens.map((i, idx) => {
                const q = lerDecimal(i.quantidade); const pr = lerDecimal(i.precoUnitario)
                const c = mapaComparativo[i.id]
                return (
                  <Fragment key={i.chave}>
                    <tr>
                      <td>{idx + 1}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 220 }}>
                        <strong>{i.codProdErp || <span className="item-novo">novo</span>}</strong> · {i.descricao}
                        {i.codigoFabrica && <span className="texto-suave"> · fáb. {i.codigoFabrica}</span>}
                        {!i.codProdErp && i.produtoStatus && (
                          <span className="texto-suave"> · cadastro {ROTULO_STATUS[i.produtoStatus]?.toLowerCase()}</span>
                        )}
                        {i.divergencia && <span className="divergencia">⚠ {i.divergencia}</span>}
                      </td>
                      <td>{[i.embalagem, i.unidade].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="numero">
                        {editavel
                          ? <input className="numero" inputMode="decimal" value={i.quantidade} placeholder="0"
                                   aria-label={`Quantidade de ${i.descricao}`}
                                   onChange={(e) => alterarItem(i.chave, 'quantidade', e.target.value)} />
                          : formatarNumero(q, 6)}
                      </td>
                      <td className="numero">
                        {editavel
                          ? <input className="numero" inputMode="decimal" value={i.precoUnitario} placeholder="0,00"
                                   aria-label={`Preço de ${i.descricao}`}
                                   onChange={(e) => alterarItem(i.chave, 'precoUnitario', e.target.value)} />
                          : formatarMoeda(pr, 2)}
                      </td>
                      <td className="numero">{q && pr ? formatarMoeda(q * pr) : '-'}</td>
                      {mostrarComparativo && (
                        <td className="numero">
                          {c?.ultimoPreco ? <>{formatarMoeda(c.ultimoPreco)}<br />
                            <span className="texto-suave">{formatarData(c.dataUltimaCompra)}</span></> : '-'}
                        </td>
                      )}
                      {mostrarComparativo && (
                        <td className="numero">
                          {c && <span className={`variacao ${c.situacao}`} title={ROTULO_VARIACAO[c.situacao]}>
                            {c.variacaoPercentual !== null && c.variacaoPercentual !== undefined
                              ? `${c.variacaoPercentual > 0 ? '+' : ''}${formatarNumero(c.variacaoPercentual, 2)}%`
                              : ROTULO_VARIACAO[c.situacao]}
                          </span>}
                        </td>
                      )}
                      {mostrarComparativo && (
                        <td>
                          {c?.ultimas?.length > 0 && (
                            <button type="button" className="btn-secundario btn-pequeno"
                                    onClick={() => setAberto((a) => ({ ...a, [i.chave]: !a[i.chave] }))}>
                              {aberto[i.chave] ? 'Ocultar' : 'Histórico'}
                            </button>
                          )}
                        </td>
                      )}
                      <td>
                        {editavel
                          ? <input maxLength={150} value={i.observacao} style={{ minWidth: 140 }}
                                   aria-label={`Observação de ${i.descricao}`}
                                   onChange={(e) => alterarItem(i.chave, 'observacao', e.target.value)} />
                          : (i.observacao || '-')}
                      </td>
                      {editavel && (
                        <td>
                          <button type="button" className="btn-perigo btn-pequeno" onClick={() => removerItem(i.chave)}>
                            Remover
                          </button>
                        </td>
                      )}
                    </tr>
                    {mostrarComparativo && aberto[i.chave] && c?.ultimas?.length > 0 && (
                      <tr className="detalhe-precos">
                        <td></td>
                        <td colSpan={colunasItens - 1}>
                          <strong>Últimas entradas</strong>
                          {c.mediaPreco && <span className="texto-suave"> · média {formatarMoeda(c.mediaPreco)}</span>}
                          <table style={{ marginTop: 6 }}>
                            <thead><tr><th>Data</th><th>Nota</th><th>Filial</th><th>Fornecedor</th>
                              <th className="numero">Qtd.</th><th className="numero">Preço unit.</th></tr></thead>
                            <tbody>
                              {c.ultimas.map((u, k) => (
                                <tr key={k}>
                                  <td>{formatarData(u.data)}</td><td>{u.numNota || '-'}</td><td>{u.codFilial}</td>
                                  <td style={{ whiteSpace: 'normal' }}>{u.codFornec} · {u.fornecedor}</td>
                                  <td className="numero">{formatarNumero(u.quantidade, 3)}</td>
                                  <td className="numero">{formatarMoeda(u.precoUnitario)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {itens.length > 0 && (
                <tr className="linha-total">
                  <td colSpan={5} className="numero">Total do pedido</td>
                  <td className="numero">{formatarMoeda(totalPedido)}</td>
                  <td colSpan={colunasItens - 6}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {mostrarComparativo && (
          <p className="texto-suave">
            O último preço vem das entradas de nota no WinThor, na unidade do produto ({'"'}Embalagem{'"'}).
            Confira se o fornecedor informou o preço na mesma unidade.
          </p>
        )}
      </section>

      {/* ---------------------------------------------------------- historico */}
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

      {/* ---------------------------------------------------------- acoes */}
      <div className="barra-acoes">
        {editavel && (
          <>
            {!novo && (
              <button type="button" className="btn-perigo" disabled={salvando}
                      onClick={() => setModal({ tipo: 'cancelar', parecer: '' })}>Cancelar pedido</button>
            )}
            <button type="button" className="btn-secundario" disabled={salvando || (!novo && !sujo)}
                    onClick={() => salvar()}>
              {salvando ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            <button type="button" className="btn-primario" disabled={salvando || itens.length === 0}
                    onClick={() => setModal({ tipo: 'enviar' })}>
              {status === 'REPROVADO' ? 'Reenviar para análise' : 'Enviar para análise'}
            </button>
          </>
        )}

        {admin && status === 'DIVERGENCIA' && (
          <>
            <button type="button" className="btn-perigo" disabled={salvando}
                    onClick={() => setModal({ tipo: 'reprovar', parecer: '' })}>Devolver ao fornecedor</button>
            <button type="button" className="btn-primario" disabled={salvando}
                    onClick={() => setModal({ tipo: 'divergencia', parecer: '', forcar: false })}>
              Concluir reanálise do cadastro
            </button>
          </>
        )}

        {admin && status === 'EM_ANALISE' && (
          <>
            <button type="button" className="btn-perigo" disabled={salvando}
                    onClick={() => setModal({ tipo: 'reprovar', parecer: '' })}>Reprovar</button>
            <button type="button" className="btn-sucesso" disabled={salvando}
                    onClick={() => setModal({ tipo: 'aprovar', parecer: '', codFilial: pedido.codFilial || '' })}>
              Aprovar pedido
            </button>
          </>
        )}

        {admin && status === 'APROVADO' && pedido.statusIntegracao !== 'GERADA' && (
          <>
            <button type="button" className="btn-secundario" disabled={salvando}
                    onClick={() => acao(() => comprasApi.voltarAnalise(pedido.id), 'Pedido voltou para análise.')}>
              Voltar para análise
            </button>
            <button type="button" className="btn-primario" disabled={salvando}
                    onClick={() => acao(() => comprasApi.gerarSugestao(pedido.id), textoAprovacao)}>
              {pedido.statusIntegracao === 'ERRO' ? 'Tentar gerar a sugestão de novo' : 'Gerar sugestão no WinThor'}
            </button>
          </>
        )}

        {admin && status === 'APROVADO' && situacao && !situacao.erro && situacao.itens?.length > 0 && (
          <span className="texto-suave" style={{ alignSelf: 'center' }}>
            Pedido(s) na 220: {[...new Set(situacao.itens.map((s) => s.numPed).filter(Boolean))].join(', ') || 'ainda não gerado'}
          </span>
        )}
      </div>

      {/* ---------------------------------------------------------- modais */}
      {modal?.tipo === 'enviar' && (
        <Modal titulo="Enviar pedido para análise" aoFechar={() => setModal(null)}
               rodape={<>
                 <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Voltar</button>
                 <button type="button" className="btn-primario" onClick={enviar} disabled={salvando}>Confirmar envio</button>
               </>}>
          <p>Você está enviando <strong>{itens.length} item(ns)</strong>, total de <strong>{formatarMoeda(totalPedido)}</strong>.</p>
          <p>Depois do envio o pedido não pode ser alterado, a não ser que o setor fiscal o devolva.</p>
          {itens.some((i) => !i.codProdErp) && (
            <div className="aviso atencao">O pedido tem produto novo: ele passa pela reanálise do cadastro antes da análise de preços.</div>
          )}
        </Modal>
      )}

      {modal?.tipo === 'cancelar' && (
        <Modal titulo="Cancelar pedido" aoFechar={() => setModal(null)}
               rodape={<>
                 <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Voltar</button>
                 <button type="button" className="btn-perigo" disabled={salvando}
                         onClick={() => acao(() => comprasApi.cancelar(pedido.id, modal.parecer), 'Pedido cancelado.')}>
                   Cancelar pedido
                 </button>
               </>}>
          <Campo label="Motivo (opcional)">
            <textarea maxLength={500} value={modal.parecer}
                      onChange={(e) => setModal((m) => ({ ...m, parecer: e.target.value }))} />
          </Campo>
        </Modal>
      )}

      {modal?.tipo === 'reprovar' && (
        <Modal titulo="Devolver ao fornecedor" aoFechar={() => setModal(null)}
               rodape={<>
                 <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Voltar</button>
                 <button type="button" className="btn-perigo" disabled={salvando || !modal.parecer.trim()}
                         onClick={() => acao(() => comprasApi.reprovar(pedido.id, modal.parecer),
                           'Pedido devolvido ao fornecedor para reavaliação.')}>
                   Devolver
                 </button>
               </>}>
          <Campo label="O que o fornecedor precisa rever?" obrigatorio
                 ajuda="Ex.: preço do item 3 acima da última compra; quantidade fora do múltiplo da caixa.">
            <textarea maxLength={500} value={modal.parecer} autoFocus
                      onChange={(e) => setModal((m) => ({ ...m, parecer: e.target.value }))} />
          </Campo>
        </Modal>
      )}

      {modal?.tipo === 'divergencia' && (
        <Modal titulo="Concluir reanálise do cadastro" aoFechar={() => setModal(null)}
               rodape={<>
                 <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Voltar</button>
                 <button type="button" className="btn-primario"
                         disabled={salvando || (modal.forcar && !modal.parecer.trim())}
                         onClick={() => acao(() => comprasApi.resolverDivergencia(pedido.id,
                           { parecer: modal.parecer || null, forcar: modal.forcar }),
                         'Cadastro reanalisado. O pedido seguiu para a análise de preços.')}>
                   Concluir
                 </button>
               </>}>
          <p>O sistema confere de novo cada item. Produtos novos só liberam depois de gravados no WinThor.</p>
          {itensDivergentes.length > 0 && (
            <ul>{itensDivergentes.map((i) => <li key={i.chave}><strong>{i.descricao}</strong>: {i.divergencia}</li>)}</ul>
          )}
          <label className="caixa-selecao">
            <input type="checkbox" checked={modal.forcar}
                   onChange={(e) => setModal((m) => ({ ...m, forcar: e.target.checked }))} />
            Liberar mesmo com divergência (exceto produto sem código no WinThor)
          </label>
          {modal.forcar && (
            <Campo label="Motivo da liberação" obrigatorio>
              <textarea maxLength={500} value={modal.parecer}
                        onChange={(e) => setModal((m) => ({ ...m, parecer: e.target.value }))} />
            </Campo>
          )}
        </Modal>
      )}

      {modal?.tipo === 'aprovar' && (
        <Modal titulo="Aprovar pedido de compra" aoFechar={() => setModal(null)}
               rodape={<>
                 <button type="button" className="btn-secundario" onClick={() => setModal(null)}>Voltar</button>
                 <button type="button" className="btn-sucesso" disabled={salvando || !modal.codFilial}
                         onClick={() => acao(() => comprasApi.aprovar(pedido.id,
                           { parecer: modal.parecer || null, codFilial: modal.codFilial }), textoAprovacao)}>
                   {salvando ? 'Aprovando...' : 'Aprovar'}
                 </button>
               </>}>
          <p>Total de <strong>{formatarMoeda(pedido.valorTotal)}</strong> em {itens.length} item(ns).</p>
          {(comparativo?.itens || []).some((c) => c.situacao === 'ACIMA') && (
            <div className="aviso atencao">
              {(comparativo.itens || []).filter((c) => c.situacao === 'ACIMA').length} item(ns) com preço acima
              da faixa em relação à última compra.
            </div>
          )}
          <div className="formulario">
            <Campo label="Filial" obrigatorio>
              <select value={modal.codFilial} onChange={(e) => setModal((m) => ({ ...m, codFilial: e.target.value }))}>
                <option value="">Selecione</option>
                {filiais.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} - {f.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Parecer (opcional)">
              <textarea maxLength={500} value={modal.parecer}
                        onChange={(e) => setModal((m) => ({ ...m, parecer: e.target.value }))} />
            </Campo>
          </div>
          <p className="texto-suave">
            {geraSugestao
              ? 'Ao aprovar, a sugestão de compra é gravada no WinThor (PCSUGESTAOCOMPRAC) para ser importada na rotina 220.'
              : 'A gravação automática no WinThor está desligada: depois de aprovar, use "Gerar sugestão no WinThor" quando ela for habilitada.'}
          </p>
        </Modal>
      )}
    </div>
  )
}
