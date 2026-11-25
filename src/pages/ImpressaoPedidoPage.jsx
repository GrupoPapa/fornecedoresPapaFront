import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { comprasApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { formatarData } from '../utils/format'
import './ImpressaoPedidoPage.css'

/**
 * Pedido de compra do WinThor no layout da rotina 210 ("Emitir Pedido de Compra"),
 * pronto para imprimir ou salvar em PDF pelo navegador.
 * Rotas: /compras/:id/impressao/:numPed (pedido do portal) e /admin/impressao-pedido/:numPed.
 */
export default function ImpressaoPedidoPage() {
  const { id, numPed } = useParams()
  const [pedido, setPedido] = useState(null)
  const [erro, setErro] = useState('')
  const imprimiu = useRef(false)

  useEffect(() => {
    const busca = id ? comprasApi.impressaoWinthor(id, numPed) : comprasApi.impressaoWinthorAdmin(numPed)
    busca.then(setPedido).catch((err) => setErro(mensagemErro(err, 'Não foi possível ler o pedido no WinThor.')))
  }, [id, numPed])

  useEffect(() => {
    if (!pedido) return
    const forn = (pedido.fornecedor?.nome || '').split(/\s+/)[0].toLowerCase()
    document.title = `pedido_${pedido.numPed}${forn ? '_' + forn : ''}` // nome sugerido do PDF
    if (!imprimiu.current) {
      imprimiu.current = true
      setTimeout(() => window.print(), 400)
    }
  }, [pedido])

  if (erro) return <div className="impressao-barra"><div className="aviso erro">{erro}</div></div>
  if (!pedido) return <div className="impressao-barra"><p>Carregando o pedido {numPed} do WinThor...</p></div>

  const e = pedido.empresa || {}
  const f = pedido.fornecedor || {}
  const itens = pedido.itens || []

  return (
    <>
      <div className="impressao-barra nao-imprimir">
        <span>Pedido <strong>{pedido.numPed}</strong> · use <strong>Salvar como PDF</strong> na janela de impressão para gerar o arquivo.</span>
        <div className="botoes">
          <button type="button" className="btn-primario" onClick={() => window.print()}>Imprimir / Salvar PDF</button>
          <button type="button" className="btn-secundario" onClick={() => window.close()}>Fechar</button>
        </div>
      </div>

      <div className="folha-pedido">
        <div className="pc-titulo">210 - Emitir Pedido de Compra</div>
        <div className="pc-linha">
          <span><b>Número do Pedido:</b>&nbsp; {pedido.numPed}</span>
          <span><b>Data:</b>&nbsp; {formatarData(pedido.data)}</span>
        </div>
        {pedido.unidadeEmissao && <div className="pc-negrito">*** PEDIDO EMITIDO NA {pedido.unidadeEmissao} ***</div>}

        <table className="pc-bloco pc-empresa">
          <tbody>
            <tr>
              <td className="rot">Empresa</td><td>{e.codigo}&nbsp;&nbsp; {e.razaoSocial}</td>
              <td className="pc-tipo" rowSpan={2}>{pedido.tipoPedido}</td>
              <td className="rot">CNPJ:</td><td>{somenteDigitos(e.cnpj)}</td>
            </tr>
            <tr>
              <td className="rot">Endereço</td><td>{e.endereco}</td>
              <td className="rot">IE:</td><td>{e.ie}</td>
            </tr>
            <tr>
              <td className="rot">Cidade</td><td>{e.cidade}</td>
              <td><b>UF</b> {e.uf}&nbsp;&nbsp; <b>CEP:</b> {formatarCep(e.cep)}</td>
              <td className="rot">Suframa:</td><td>{e.suframa}</td>
            </tr>
          </tbody>
        </table>

        <table className="pc-bloco pc-fornecedor">
          <tbody>
            <tr>
              <td className="rot">Fornecedor</td><td>{f.nome}</td>
              <td><b>Código</b> {f.codigo}</td>
              <td colSpan={2}><b>Telefone:</b> {f.telefone}</td>
            </tr>
            <tr><td className="rot">CNPJ</td><td colSpan={4}>{somenteDigitos(f.cnpj)}</td></tr>
            <tr>
              <td className="rot">Endereço</td><td>{f.endereco}</td>
              <td colSpan={3}><b>Bairro:</b> {f.bairro}</td>
            </tr>
            <tr>
              <td className="rot">Cidade:</td><td>{f.cidade}</td>
              <td colSpan={3}><b>UF</b> {f.uf}&nbsp;&nbsp; <b>CEP:</b> {formatarCep(f.cep)}</td>
            </tr>
          </tbody>
        </table>

        <div className="pc-condicoes">
          <div>
            <div><b>Telefone:</b></div>
            <div><b>Condições de Pagamento:</b>&nbsp; {pedido.condicaoPagamento}{pedido.condicaoPagamento && <b className="pc-dias">DIAS</b>}</div>
            <div><b>Frete:</b>&nbsp;&nbsp; {pedido.frete}</div>
            <div><b>Transportador:</b>&nbsp; {pedido.transportador}</div>
          </div>
          <table className="pc-datas">
            <thead><tr><th>Faturamento</th><th>Embarque</th><th>Entrega</th></tr></thead>
            <tbody><tr>
              <td>{formatarData(pedido.dataFaturamento)}</td>
              <td>{formatarData(pedido.dataEmbarque)}</td>
              <td>{formatarData(pedido.dataEntrega)}</td>
            </tr></tbody>
          </table>
        </div>

        <table className="pc-itens">
          <thead>
            <tr>
              <th>Cód.Fáb.</th><th className="esq">Código&nbsp; Descrição</th><th>Embalagem</th><th>Und</th>
              <th className="num">Qt. Pedida</th><th className="num">Vl. IPI</th>
              <th className="num">P. Líquido</th><th className="num">Vlr. Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i, n) => (
              <tr key={n}>
                <td>{i.codFab}</td>
                <td className="esq">{i.codProd} {i.descricao}</td>
                <td>{i.embalagem}</td>
                <td>{i.unidade}</td>
                <td className="num">{num(i.qtPedida, 0, 4)}</td>
                <td className="num">{num(i.valorIpi, 2, 2)}</td>
                <td className="num">{num(i.precoLiquido, 6, 6)}</td>
                <td className="num">{num(i.valorTotal, 2, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pc-rodape-valores">
          <div className="pc-volumes">
            <div className="pc-qtd-itens">{itens.length}&nbsp; Itens</div>
            <div><b>Volumes</b> {num(pedido.volumes, 2, 2)}</div>
            <div><b>Peso</b> &nbsp;&nbsp;&nbsp;{num(pedido.peso, 2, 2)}</div>
          </div>
          <div className="pc-icms">
            <div><b>Base Icms:</b><span>{num(pedido.baseIcms, 2, 2)}</span></div>
            <div><b>Valor Icms:</b><span>{num(pedido.valorIcms, 2, 2)}</span></div>
            <div className="pequeno"><b>Incluiu Pedido:</b> {pedido.incluiuPedido}</div>
            <div className="pequeno"><b>Alterou Pedido:</b> {pedido.alterouPedido}</div>
          </div>
          <table className="pc-totais">
            <tbody>
              <tr><th>Total bruto:</th><td>{num(pedido.totalBruto, 2, 2)}</td></tr>
              <tr><th>Desc. Suframa</th><td>{num(pedido.descontoSuframa, 2, 2)}</td></tr>
              <tr><th>Total Líquido:</th><td>{num(pedido.totalLiquido, 2, 2)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="pc-obs"><b>Observações:</b> <span>{pedido.observacoes}</span></div>

        <div className="pc-avisos">
          {(pedido.rodape || []).map((t, n) => (
            <div key={n} className={n === 0 ? 'pc-aviso-nf' : 'pc-aviso-link'}>{t}</div>
          ))}
        </div>
        {pedido.origem && <div className="pc-origem">{pedido.origem}</div>}

        <div className="pc-assinaturas">
          <div>Assinatura Fornecedor</div>
          <div>{e.razaoSocial}</div>
        </div>
      </div>
    </>
  )
}

function num(v, minCasas, maxCasas) {
  if (v === null || v === undefined || v === '') return ''
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: minCasas, maximumFractionDigits: maxCasas })
}

function somenteDigitos(v) {
  return v ? String(v).replace(/\D/g, '') || v : ''
}

function formatarCep(v) {
  const d = somenteDigitos(v)
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (v || '')
}

