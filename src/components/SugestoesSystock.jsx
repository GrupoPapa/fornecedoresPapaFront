import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { systockApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { formatarData, formatarMoeda, formatarNumero, ROTULO_STATUS_COMPRA } from '../utils/format'
import Campo from './Campo'
import Modal from './Modal'

function normalizar(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const ROTULO_STATUS = {
  AB: 'Em aberto',
  CT: 'Em cotação',
  PARA_EXPORTACAO: 'Para exportação',
  FN: 'Finalizado'
}

const CLASSE_STATUS = { AB: 'RASCUNHO', CT: 'EM_ANALISE', PARA_EXPORTACAO: 'ENVIADO', FN: 'APROVADO' }

/** Valor da ultima entrada no WinThor, com a data e quanto o preco da sugestao difere dele. */
function UltimaEntrada({ ultima, preco }) {
  if (!ultima) return <span className="texto-suave">Sem entrada</span>
  const valor = Number(ultima.valorUnitario)
  const dif = valor > 0 && preco != null ? ((Number(preco) - valor) / valor) * 100 : null
  const detalhe = [
    ultima.numNota && `NF ${ultima.numNota}`,
    ultima.codFilial && `filial ${ultima.codFilial}`,
    ultima.fornecedor && `${ultima.codFornec ? `${ultima.codFornec} - ` : ''}${ultima.fornecedor}`,
    ultima.quantidade != null && `qtde. ${formatarNumero(ultima.quantidade)}`
  ].filter(Boolean).join(' · ')
  return (
    <span title={detalhe || undefined}>
      {formatarMoeda(ultima.valorUnitario)}
      <span className="ultima-entrada-detalhe">
        {formatarData(ultima.data)}
        {dif != null && Math.abs(dif) >= 0.05 && (
          <span className={dif > 0 ? 'dif-maior' : 'dif-menor'}> {dif > 0 ? '+' : ''}{dif.toFixed(1).replace('.', ',')}%</span>
        )}
      </span>
    </span>
  )
}

/**
 * Sugestoes de compra do Systock. O portal so le o Systock: o fornecedor ve as sugestoes dele e
 * pode trazer uma para o portal, onde vira um pedido de compra em digitacao para editar e enviar.
 */
export default function SugestoesSystock({ admin, fornecedores }) {
  const navegar = useNavigate()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState({ termo: '', status: '', fornecedorId: '', trazidas: '' })
  const [aberta, setAberta] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [trazendo, setTrazendo] = useState(false)

  const carregar = useCallback(async (atualizar = false) => {
    setCarregando(true)
    setErro('')
    try {
      setDados(await systockApi.sugestoes({
        fornecedorId: admin && filtros.fornecedorId ? filtros.fornecedorId : undefined,
        atualizar: atualizar || undefined
      }))
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível carregar as sugestões do Systock.'))
    } finally {
      setCarregando(false)
    }
  }, [admin, filtros.fornecedorId])

  useEffect(() => { carregar() }, [carregar])

  const lista = useMemo(() => {
    const palavras = normalizar(filtros.termo).split(/\s+/).filter(Boolean)
    return (dados?.sugestoes || []).filter((s) => {
      if (filtros.status && s.statusCodigo !== filtros.status) return false
      if (filtros.trazidas === 'NAO' && s.importado) return false
      if (filtros.trazidas === 'SIM' && !s.importado) return false
      if (!palavras.length) return true
      const alvo = normalizar(`${s.idPedido} ${s.nomeFornecedor || ''} ${s.usuario || ''} ${
        s.itens.map((i) => `${i.idProduto} ${i.descricao || ''} ${i.codigoFabrica || ''}`).join(' ')}`)
      return palavras.every((w) => alvo.includes(w))
    })
  }, [dados, filtros])

  const contagem = useMemo(() => {
    const c = { AB: 0, CT: 0, PARA_EXPORTACAO: 0, FN: 0, pendentes: 0 }
    ;(dados?.sugestoes || []).forEach((s) => {
      c[s.statusCodigo] = (c[s.statusCodigo] || 0) + 1
      if (!s.importado) c.pendentes += 1
    })
    return c
  }, [dados])

  function filtrar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  async function trazer(s) {
    setTrazendo(true)
    try {
      const r = await systockApi.trazerParaPortal(s.idPedido)
      setConfirmar(null)
      navegar(`/compras/${r.pedidoId}`, {
        state: { mensagem: `Sugestão Systock nº ${s.idPedido} trazida para o portal como pedido ${r.pedidoNumero}. Confira, ajuste o que precisar e envie para análise.` }
      })
    } catch (err) {
      setConfirmar((c) => ({ ...c, erro: mensagemErro(err) }))
    } finally {
      setTrazendo(false)
    }
  }

  const colunas = admin ? 9 : 8

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Sugestões do Systock</h2>
          <p>{admin
            ? 'Sugestões de compra geradas no Systock. Ao trazer uma para o portal, ela vira um pedido em digitação no fornecedor.'
            : 'Sugestões de compra que o Grupo Papa gerou para você no Systock. Use "Editar pedido" para conferir, ajustar quantidades e preços e enviar.'}</p>
        </div>
        <div className="botoes">
          <button type="button" className="btn-secundario" disabled={carregando} onClick={() => carregar(true)}>
            {carregando ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {dados?.aviso && <div className={`aviso ${dados.habilitado ? 'atencao' : 'info'}`}>{dados.aviso}</div>}

      {dados?.habilitado && (
        <>
          <div className="cartoes-resumo">
            <div className="cartao-resumo"><span>Em aberto</span><strong>{contagem.AB}</strong></div>
            <div className="cartao-resumo"><span>Em cotação</span><strong>{contagem.CT}</strong></div>
            <div className="cartao-resumo"><span>Finalizadas ({dados.diasFinalizados} dias)</span><strong>{contagem.FN}</strong></div>
            <div className="cartao-resumo"><span>Não integrados</span><strong>{contagem.pendentes}</strong></div>
          </div>

          <div className="filtros">
            {admin && (
              <Campo label="Fornecedor">
                <select value={filtros.fornecedorId} onChange={(e) => filtrar('fornecedorId', e.target.value)}>
                  <option value="">Todos</option>
                  {fornecedores.filter((f) => f.codFornecedorErp).map((f) => (
                    <option key={f.id} value={f.id}>{f.codFornecedorErp} - {f.razaoSocial}</option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo label="Buscar">
              <input type="search" value={filtros.termo} placeholder="Nº da sugestão, produto ou comprador"
                     onChange={(e) => filtrar('termo', e.target.value)} />
            </Campo>
            <Campo label="Situação no Systock">
              <select value={filtros.status} onChange={(e) => filtrar('status', e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(ROTULO_STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </Campo>
            <Campo label="No portal">
              <select value={filtros.trazidas} onChange={(e) => filtrar('trazidas', e.target.value)}>
                <option value="">Todas</option>
                <option value="NAO">Não integrados</option>
                <option value="SIM">Integrados</option>
              </select>
            </Campo>
          </div>
        </>
      )}

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Sugestão</th>
              {admin && <th>Fornecedor</th>}
              <th>Situação no Systock</th>
              <th>Abertura</th>
              <th>Comprador</th>
              <th className="numero">Itens</th>
              <th className="numero">Total</th>
              <th>No portal</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={colunas} className="vazio">Consultando o Systock...</td></tr>}
            {!carregando && dados?.habilitado && lista.length === 0 && (
              <tr><td colSpan={colunas} className="vazio">Nenhuma sugestão de compra encontrada.</td></tr>
            )}
            {!carregando && lista.map((s) => (
              <Fragment key={s.idPedido}>
                <tr className="linha-clicavel" onClick={() => setAberta(aberta === s.idPedido ? null : s.idPedido)}>
                  <td><strong>{s.idPedido}</strong></td>
                  {admin && <td className="quebra">{s.idFornecedorErp} - {s.nomeFornecedor}</td>}
                  <td><span className={`etiqueta ${CLASSE_STATUS[s.statusCodigo] || ''}`}>{ROTULO_STATUS[s.statusCodigo] || s.statusSystock}</span></td>
                  <td>{formatarData(s.dataAbertura)}</td>
                  <td className="quebra">{s.usuario || '-'}</td>
                  <td className="numero">{s.qtdItens}</td>
                  <td className="numero">{formatarMoeda(s.valorTotal)}</td>
                  <td>
                    {s.importado
                      ? <span className={`etiqueta ${s.importado.status}`}>
                          {s.importado.numero} · {ROTULO_STATUS_COMPRA[s.importado.status] || s.importado.status}
                        </span>
                      : <span className="texto-suave">Não integrado</span>}
                  </td>
                  <td className="acoes" onClick={(e) => e.stopPropagation()}>
                    {s.importado ? (
                      <button type="button" className="btn-secundario btn-pequeno"
                              onClick={() => navegar(`/compras/${s.importado.pedidoId}`)}>Abrir pedido</button>
                    ) : (
                      <button type="button" className="btn-primario btn-pequeno"
                              disabled={admin && !s.fornecedorIdPortal}
                              title={admin && !s.fornecedorIdPortal ? 'Fornecedor ainda não cadastrado no portal' : undefined}
                              onClick={() => setConfirmar({ sugestao: s })}>
                        Editar pedido
                      </button>
                    )}
                    {' '}
                    <button type="button" className="btn-secundario btn-pequeno"
                            onClick={() => setAberta(aberta === s.idPedido ? null : s.idPedido)}>
                      {aberta === s.idPedido ? 'Ocultar itens' : 'Ver itens'}
                    </button>
                  </td>
                </tr>
                {aberta === s.idPedido && (
                  <tr className="linha-detalhe">
                    <td colSpan={colunas}>
                      {(s.observacao || s.condicaoPagamento) && (
                        <p className="texto-suave" style={{ margin: '0 0 8px' }}>
                          {s.condicaoPagamento && <>Cond. pagamento: {s.condicaoPagamento}. </>}
                          {s.observacao}
                        </p>
                      )}
                      <table className="tabela-interna">
                        <thead>
                          <tr>
                            <th>Cód. interno</th><th>Cód. fábrica</th><th>Descrição</th><th>Embalagem</th>
                            <th className="numero">Qtde. sugerida</th><th className="numero">Qtde.</th>
                            <th className="numero">Preço</th><th className="numero">Últ. entrada</th><th className="numero">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.itens.map((i, n) => (
                            <tr key={`${i.idProduto}-${n}`}>
                              <td><strong>{i.idProduto}</strong></td>
                              <td>{i.codigoFabrica || '-'}</td>
                              <td className="quebra">
                                {i.descricao || <span className="texto-suave">Produto não encontrado no WinThor</span>}
                                {i.foraDoFornecedor && <span className="verificacao-nota nf-aviso"> · no WinThor é de outro fornecedor</span>}
                                {!i.foraDoFornecedor && i.fornecedorProduto && (
                                  <span className="texto-suave" title="Fornecedor do mesmo grupo no WinThor (principal/secundário)"> · fornecedor {i.fornecedorProduto}</span>
                                )}
                              </td>
                              <td>{i.embalagem || '-'}</td>
                              <td className="numero">{i.quantidadeSugerida == null ? '-' : formatarNumero(i.quantidadeSugerida)}</td>
                              <td className="numero">{formatarNumero(i.quantidade)}</td>
                              <td className="numero">{formatarMoeda(i.preco)}</td>
                              <td className="numero"><UltimaEntrada ultima={i.ultimaEntrada} preco={i.preco} /></td>
                              <td className="numero">{formatarMoeda(i.valorTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {confirmar && (
        <Modal titulo={`Editar a sugestão ${confirmar.sugestao.idPedido}`} aoFechar={() => !trazendo && setConfirmar(null)}
               rodape={(
                 <>
                   <button type="button" className="btn-secundario" disabled={trazendo} onClick={() => setConfirmar(null)}>Cancelar</button>
                   <button type="button" className="btn-primario" disabled={trazendo} onClick={() => trazer(confirmar.sugestao)}>
                     {trazendo ? 'Abrindo...' : 'Editar pedido'}
                   </button>
                 </>
               )}>
          {confirmar.erro && <div className="aviso erro">{confirmar.erro}</div>}
          <p style={{ marginTop: 0 }}>
            O portal cria um <strong>pedido de compra em digitação</strong> com os {confirmar.sugestao.qtdItens} item(ns)
            da sugestão ({formatarMoeda(confirmar.sugestao.valorTotal)}). Depois você ajusta quantidades e preços,
            informa a filial e a previsão de entrega e envia para análise.
          </p>
          <p className="texto-suave" style={{ marginBottom: 0 }}>
            As alterações ficam no portal: a sugestão no Systock não é modificada.
          </p>
        </Modal>
      )}
    </>
  )
}
