import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { pedidosApi, produtoErpApi, produtosApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { ehPiso, formatarDataHora, formatarNumero, ROTULO_STATUS, ROTULO_STATUS_PEDIDO } from '../utils/format'
import Campo from '../components/Campo'
import Modal from '../components/Modal'

export default function PedidoDetalhePage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { admin } = useAuth()

  const [pedido, setPedido] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [observacao, setObservacao] = useState('')
  const [analise, setAnalise] = useState(null)
  const [ressalva, setRessalva] = useState(null)
  const [statusErp, setStatusErp] = useState({})
  const [integrando, setIntegrando] = useState(false)
  const [resultadoErp, setResultadoErp] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const dados = await pedidosApi.buscar(id)
      setPedido(dados)
      setObservacao(dados.observacao || '')
    } catch (err) {
      setErro(mensagemErro(err, 'Pedido não encontrado.'))
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // situacao do complemento WinThor de cada item (visivel apenas para o admin)
  useEffect(() => {
    if (!admin || !pedido?.itens?.length) return
    let ativo = true
    Promise.all(pedido.itens.map((item) =>
      produtoErpApi.buscar(item.id)
        .then((erp) => [item.id, { completo: erp.completo, salvo: erp.salvo,
                                   integrado: erp.statusIntegracao === 'INTEGRADO',
                                   codProd: erp.codProdErp, erroErp: erp.mensagemErro,
                                   status: erp.statusIntegracao }])
        .catch(() => [item.id, { completo: false, salvo: false, integrado: false }])
    )).then((pares) => { if (ativo) setStatusErp(Object.fromEntries(pares)) })
    return () => { ativo = false }
  }, [admin, pedido])

  async function acao(fn, textoSucesso) {
    setErro(''); setMensagem('')
    try {
      await fn()
      setMensagem(textoSucesso)
      await carregar()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  if (carregando) return <p>Carregando...</p>
  if (!pedido) return <div className="aviso erro">{erro || 'Pedido não encontrado.'}</div>

  const editavel = pedido.editavel && !admin
  const emAnalise = admin && pedido.status === 'ENVIADO'
  const piso = ehPiso(pedido.fornecedorTipo)
  const itensComRessalva = (pedido.itens || []).filter((i) => i.status === 'REPROVADO')

  // o pedido so pode ser aprovado com o bloco do WinThor completo em TODOS os itens
  const erpCarregado = !emAnalise || (pedido.itens || []).every((i) => statusErp[i.id] !== undefined)
  const itensPendentesErp = emAnalise
    ? (pedido.itens || []).filter((i) => {
        const e = statusErp[i.id]
        return !e || (!e.completo && !e.integrado)
      })
    : []
  const bloqueiaAprovacao = emAnalise && (!erpCarregado || itensPendentesErp.length > 0)

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Pedido {pedido.numero}</h2>
          <p>
            {pedido.fornecedorNome}
            {' · '}{pedido.qtdItens} item(ns)
            {pedido.dataEnvio ? ` · enviado em ${formatarDataHora(pedido.dataEnvio)}` : ''}
          </p>
        </div>
        <div className="botoes">
          <span className={`etiqueta ${pedido.status}`}>{ROTULO_STATUS_PEDIDO[pedido.status]}</span>
          <button type="button" className="btn-secundario" onClick={() => navegar('/pedidos')}>Voltar</button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagem && <div className="aviso sucesso">{mensagem}</div>}

      {pedido.status === 'REPROVADO' && (
        <div className="aviso atencao">
          <strong>Pedido devolvido para correção.</strong>{' '}
          {pedido.parecer || 'Confira os itens marcados com ressalva, corrija e reenvie.'}
        </div>
      )}
      {pedido.status === 'ABERTO' && !admin && (
        <div className="aviso info">
          Vá adicionando os produtos. Quando terminar, clique em <strong>Enviar pedido</strong> —
          só nesse momento ele chega para a nossa equipe.
        </div>
      )}
      {emAnalise && itensComRessalva.length > 0 && (
        <div className="aviso atencao">
          {itensComRessalva.length} item(ns) com ressalva. Para aprovar o pedido, retire as ressalvas;
          para devolver ao fornecedor, use <strong>Devolver pedido</strong>.
        </div>
      )}
      {emAnalise && erpCarregado && itensPendentesErp.length > 0 && (
        <div className="aviso atencao">
          <strong>Dados do WinThor incompletos.</strong>{' '}
          Todos os campos do WinThor são obrigatórios para aprovar. Use <strong>Dados WinThor</strong>
          {' '}em cada item e preencha os campos com fundo avermelhado.
          {' '}Pendente(s): {itensPendentesErp.map((i) => i.codigo).join(', ')}.
        </div>
      )}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="botoes" style={{ justifyContent: 'space-between' }}>
          <div className="botoes">
            {editavel && (
              <button type="button" className="btn-primario"
                      onClick={() => navegar(`/produtos/novo?pedido=${pedido.id}`)}>
                Adicionar produto
              </button>
            )}
            {editavel && (pedido.itens || []).length > 0 && (
              <button type="button" className="btn-sucesso"
                      onClick={() => {
                        if (window.confirm(`Enviar o pedido ${pedido.numero} com ${pedido.qtdItens} item(ns)?`)) {
                          acao(() => pedidosApi.enviar(pedido.id), 'Pedido enviado para análise.')
                        }
                      }}>
                {pedido.status === 'REPROVADO' ? 'Reenviar pedido' : 'Enviar pedido'}
              </button>
            )}
            {emAnalise && (
              <>
                <button type="button" className="btn-sucesso" disabled={bloqueiaAprovacao}
                        title={bloqueiaAprovacao
                          ? (erpCarregado
                              ? 'Preencha todos os campos do WinThor dos itens pendentes.'
                              : 'Conferindo os dados do WinThor...')
                          : undefined}
                        onClick={() => setAnalise({ aprovado: true, parecer: '' })}>
                  Aprovar pedido
                </button>
                <button type="button" className="btn-perigo"
                        onClick={() => setAnalise({ aprovado: false, parecer: '' })}>
                  Devolver pedido
                </button>
              </>
            )}
            {admin && pedido.status === 'APROVADO' && (
              <>
                <button type="button" className="btn-primario" disabled={integrando}
                        onClick={async () => {
                          if (!window.confirm(
                            `Gravar os ${pedido.qtdItens} itens do pedido ${pedido.numero} no WinThor?`)) return
                          setErro(''); setMensagem(''); setIntegrando(true)
                          try {
                            setResultadoErp(await pedidosApi.integrar(pedido.id))
                            await carregar()
                          } catch (err) {
                            setErro(mensagemErro(err))
                          } finally {
                            setIntegrando(false)
                          }
                        }}>
                  {integrando ? 'Gravando...' : 'Gravar no WinThor'}
                </button>
                <button type="button" className="btn-secundario"
                        onClick={() => acao(() => pedidosApi.reabrir(pedido.id), 'Pedido reaberto.')}>
                  Reabrir pedido
                </button>
              </>
            )}
          </div>
          {editavel && pedido.status === 'ABERTO' && (
            <button type="button" className="btn-perigo"
                    onClick={() => {
                      if (window.confirm('Cancelar este pedido e excluir os itens dele?')) {
                        pedidosApi.excluir(pedido.id)
                          .then(() => navegar('/pedidos'))
                          .catch((err) => setErro(mensagemErro(err)))
                      }
                    }}>
              Cancelar pedido
            </button>
          )}
        </div>

        {editavel && (
          <Campo label="Observações do pedido" ajuda="Opcional — algo que a nossa equipe precise saber.">
            <textarea value={observacao} maxLength={500}
                      onChange={(e) => setObservacao(e.target.value)}
                      onBlur={() => {
                        if ((pedido.observacao || '') !== observacao) {
                          acao(() => pedidosApi.atualizar(pedido.id, { observacao }), 'Observação salva.')
                        }
                      }} />
          </Campo>
        )}
        {!editavel && pedido.observacao && (
          <p><strong>Observações do fornecedor:</strong> {pedido.observacao}</p>
        )}
      </div>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>EAN produto</th>
              <th>NCM</th>
              <th>Peso líq.</th>
              <th>Peso bruto</th>
              <th>{piso ? 'm² caixa' : 'Qtd. emb.'}</th>
              <th>Fotos</th>
              {admin && <th>WinThor</th>}
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(pedido.itens || []).length === 0 && (
              <tr><td colSpan={admin ? 11 : 10} className="vazio">
                Nenhum produto neste pedido{editavel ? ' — clique em "Adicionar produto".' : '.'}
              </td></tr>
            )}
            {(pedido.itens || []).map((item) => (
              <tr key={item.id}>
                <td>{item.codigo}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 220 }}>
                  {item.descricao}
                  {item.status === 'REPROVADO' && item.parecer && (
                    <div style={{ color: 'var(--cor-erro)', fontSize: 12, marginTop: 4 }}>
                      Ressalva: {item.parecer}
                    </div>
                  )}
                </td>
                <td>{item.codBarraProduto}</td>
                <td>{item.ncm}</td>
                <td>{formatarNumero(item.pesoLiquido)}</td>
                <td>{formatarNumero(item.pesoBruto)}</td>
                <td>{piso ? formatarNumero(item.m2Caixa) : item.qtdEmbalagem}</td>
                <td>{item.qtdFotos ? `${item.qtdFotos} 📷` : '-'}</td>
                {admin && (
                  <td>
                    {statusErp[item.id]?.integrado
                      ? <span className="etiqueta APROVADO" title="CODPROD no WinThor">
                          #{statusErp[item.id].codProd}
                        </span>
                      : statusErp[item.id]?.status === 'ERRO'
                        ? <span className="etiqueta REPROVADO" title={statusErp[item.id].erroErp}>Erro</span>
                        : statusErp[item.id]?.completo
                          ? <span className="etiqueta ENVIADO">Completo</span>
                          : <span className="etiqueta REPROVADO">Pendente</span>}
                  </td>
                )}
                <td><span className={`etiqueta ${item.status}`}>{ROTULO_STATUS[item.status]}</span></td>
                <td className="acoes">
                  <button type="button" className="btn-secundario btn-pequeno"
                          onClick={() => navegar(`/produtos/${item.id}?pedido=${pedido.id}`)}>
                    {item.editavel || admin ? 'Editar' : 'Ver'}
                  </button>
                  {admin && (
                    <button type="button" className="btn-secundario btn-pequeno"
                            onClick={() => navegar(`/produtos/${item.id}?pedido=${pedido.id}`)}>
                      Dados WinThor
                    </button>
                  )}
                  {emAnalise && item.status !== 'REPROVADO' && (
                    <button type="button" className="btn-perigo btn-pequeno"
                            onClick={() => setRessalva({ item, parecer: '' })}>
                      Ressalva
                    </button>
                  )}
                  {admin && item.status === 'REPROVADO' && pedido.status === 'ENVIADO' && (
                    <button type="button" className="btn-secundario btn-pequeno"
                            onClick={() => acao(() => produtosApi.retirarRessalva(item.id),
                                                'Ressalva retirada.')}>
                      Retirar ressalva
                    </button>
                  )}
                  {editavel && (
                    <button type="button" className="btn-perigo btn-pequeno"
                            onClick={() => {
                              if (window.confirm(`Remover ${item.codigo} do pedido?`)) {
                                acao(() => produtosApi.excluir(item.id), 'Item removido.')
                              }
                            }}>
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analise && (
        <Modal titulo={analise.aprovado ? `Aprovar pedido ${pedido.numero}` : `Devolver pedido ${pedido.numero}`}
               aoFechar={() => setAnalise(null)}
               rodape={
                 <>
                   <button type="button" className="btn-secundario" onClick={() => setAnalise(null)}>Cancelar</button>
                   <button type="button" className={analise.aprovado ? 'btn-sucesso' : 'btn-primario'}
                           disabled={(analise.aprovado && bloqueiaAprovacao)
                                     || (!analise.aprovado && !analise.parecer.trim()
                                         && itensComRessalva.length === 0)}
                           onClick={() => {
                             const fn = analise.aprovado
                               ? () => pedidosApi.aprovar(pedido.id, analise.parecer || null)
                               : () => pedidosApi.reprovar(pedido.id, analise.parecer || null)
                             acao(fn, analise.aprovado ? 'Pedido aprovado.' : 'Pedido devolvido ao fornecedor.')
                             setAnalise(null)
                           }}>
                     {analise.aprovado ? 'Confirmar aprovação' : 'Confirmar devolução'}
                   </button>
                 </>
               }>
          <p>
            {analise.aprovado
              ? `Todos os ${pedido.qtdItens} itens serão marcados como aprovados.`
              : 'Os itens com ressalva voltam para o fornecedor corrigir. Os demais ficam aprovados.'}
          </p>
          <Campo label={analise.aprovado ? 'Observação (opcional)' : 'Motivo da devolução'}
                 obrigatorio={!analise.aprovado && itensComRessalva.length === 0}
                 ajuda="O fornecedor verá este texto.">
            <textarea value={analise.parecer} maxLength={500}
                      onChange={(e) => setAnalise({ ...analise, parecer: e.target.value })} />
          </Campo>
        </Modal>
      )}

      {resultadoErp && (
        <Modal titulo="Gravação no WinThor" largura={720} aoFechar={() => setResultadoErp(null)}
               rodape={<button type="button" className="btn-primario"
                               onClick={() => setResultadoErp(null)}>Fechar</button>}>
          <div className={`aviso ${resultadoErp.comErro ? 'atencao' : 'sucesso'}`}>
            {resultadoErp.gravados} de {resultadoErp.total} item(ns) gravados
            {resultadoErp.comErro > 0 ? ` · ${resultadoErp.comErro} com erro` : ''}.
          </div>
          <div className="tabela-rolagem">
            <table>
              <thead><tr><th>Produto</th><th>CODPROD</th><th>Resultado</th></tr></thead>
              <tbody>
                {resultadoErp.itens.map((i) => (
                  <tr key={i.produtoId}>
                    <td>{i.codigo}</td>
                    <td>{i.codProdErp || '-'}</td>
                    <td style={{ whiteSpace: 'normal', color: i.ok ? undefined : 'var(--cor-erro)' }}>
                      {i.mensagem}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {ressalva && (
        <Modal titulo={`Ressalva em ${ressalva.item.codigo}`} aoFechar={() => setRessalva(null)}
               rodape={
                 <>
                   <button type="button" className="btn-secundario" onClick={() => setRessalva(null)}>Cancelar</button>
                   <button type="button" className="btn-primario" disabled={!ressalva.parecer.trim()}
                           onClick={() => {
                             acao(() => produtosApi.reprovar(ressalva.item.id, ressalva.parecer),
                                  'Ressalva registrada no item.')
                             setRessalva(null)
                           }}>
                     Marcar ressalva
                   </button>
                 </>
               }>
          <Campo label="O que precisa ser corrigido" obrigatorio
                 ajuda="Aparece para o fornecedor quando o pedido for devolvido.">
            <textarea value={ressalva.parecer} maxLength={500}
                      onChange={(e) => setRessalva({ ...ressalva, parecer: e.target.value })} />
          </Campo>
        </Modal>
      )}
    </>
  )
}
