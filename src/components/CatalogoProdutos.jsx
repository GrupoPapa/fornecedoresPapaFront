import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { produtosApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { formatarData, formatarNumero, ROTULO_STATUS } from '../utils/format'
import Campo from './Campo'
import Paginacao from './Paginacao'

const POR_PAGINA = 50

function normalizar(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function csv(valor) {
  if (valor === null || valor === undefined) return ''
  const t = String(valor)
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/**
 * Todos os produtos do fornecedor: os que ja estao no WinThor (antigos e os novos ja gravados la)
 * e os cadastrados pelo portal que ainda aguardam cadastro no WinThor.
 */
export default function CatalogoProdutos({ admin, fornecedores }) {
  const navegar = useNavigate()
  const [fornecedorId, setFornecedorId] = useState('')
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState({ termo: '', origem: '', situacao: '' })
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    if (admin && !fornecedorId) { setDados(null); return }
    let ativo = true
    setCarregando(true)
    setErro('')
    produtosApi.catalogo(admin ? fornecedorId : null)
      .then((d) => ativo && setDados(d))
      .catch((err) => ativo && setErro(mensagemErro(err, 'Não foi possível carregar os produtos.')))
      .finally(() => ativo && setCarregando(false))
    return () => { ativo = false }
  }, [admin, fornecedorId])

  const filtrados = useMemo(() => {
    const lista = dados?.produtos || []
    const palavras = normalizar(filtros.termo).split(/\s+/).filter(Boolean)
    return lista.filter((p) => {
      if (filtros.origem && p.origem !== filtros.origem) return false
      if (filtros.situacao === 'ATIVO' && p.foraDeLinha) return false
      if (filtros.situacao === 'FORA_DE_LINHA' && !p.foraDeLinha) return false
      if (!palavras.length) return true
      const alvo = normalizar(`${p.codProd || ''} ${p.codigoFabrica || ''} ${p.descricao || ''} ${p.ean || ''} ${p.ncm || ''}`)
      return palavras.every((w) => alvo.includes(w))
    })
  }, [dados, filtros])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtrados.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)
  const foraDeLinha = (dados?.produtos || []).filter((p) => p.foraDeLinha).length

  function filtrar(campo, valor) {
    setPagina(0)
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function exportar() {
    const cab = ['Origem', 'Cod. WinThor', 'Cod. fabrica', 'Descricao', 'EAN', 'NCM', 'Embalagem', 'Unidade',
      'Qtd/m2 embalagem', 'Peso liquido', 'Peso bruto', 'Cadastro', 'Situacao', 'Pedido de cadastro']
    const linhas = filtrados.map((p) => [
      p.origem === 'WINTHOR' ? 'WinThor' : 'Novo (portal)', p.codProd, p.codigoFabrica, p.descricao, p.ean, p.ncm,
      p.embalagem, p.unidade, p.qtdEmbalagem, p.pesoLiquido, p.pesoBruto, formatarData(p.dataCadastro),
      p.origem === 'WINTHOR' ? (p.foraDeLinha ? 'Fora de linha' : 'Ativo') : (ROTULO_STATUS[p.status] || p.status),
      p.pedidoNumero
    ].map(csv).join(';'))
    const conteudo = '﻿' + [cab.join(';'), ...linhas].join('\r\n')
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'todos-os-produtos.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Todos os produtos</h2>
          <p>{admin
            ? 'Produtos do fornecedor já cadastrados no WinThor e os novos enviados pelo portal.'
            : 'Seus produtos já cadastrados no WinThor e os novos que você cadastrou pelo portal.'}</p>
        </div>
        <div className="botoes">
          <button type="button" className="btn-secundario" disabled={!filtrados.length} onClick={exportar}>
            Exportar planilha (CSV)
          </button>
        </div>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {dados?.aviso && <div className="aviso atencao">{dados.aviso}</div>}

      {dados && (
        <div className="cartoes-resumo">
          <div className="cartao-resumo"><span>Total</span><strong>{dados.produtos.length}</strong></div>
          <div className="cartao-resumo"><span>No WinThor</span><strong>{dados.qtdWinthor}</strong></div>
          <div className="cartao-resumo"><span>Novos (aguardando WinThor)</span><strong>{dados.qtdPortal}</strong></div>
          <div className="cartao-resumo"><span>Fora de linha</span><strong>{foraDeLinha}</strong></div>
        </div>
      )}

      <div className="filtros">
        {admin && (
          <Campo label="Fornecedor">
            <select value={fornecedorId} onChange={(e) => { setPagina(0); setFornecedorId(e.target.value) }}>
              <option value="">Selecione...</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codFornecedorErp ? `${f.codFornecedorErp} - ` : ''}{f.razaoSocial}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo label="Buscar">
          <input type="search" value={filtros.termo} placeholder="Código, cód. fábrica, descrição, EAN ou NCM"
                 onChange={(e) => filtrar('termo', e.target.value)} />
        </Campo>
        <Campo label="Origem">
          <select value={filtros.origem} onChange={(e) => filtrar('origem', e.target.value)}>
            <option value="">Todas</option>
            <option value="WINTHOR">Já no WinThor</option>
            <option value="PORTAL">Novos pelo portal</option>
          </select>
        </Campo>
        <Campo label="Situação">
          <select value={filtros.situacao} onChange={(e) => filtrar('situacao', e.target.value)}>
            <option value="">Todas</option>
            <option value="ATIVO">Ativos</option>
            <option value="FORA_DE_LINHA">Fora de linha</option>
          </select>
        </Campo>
      </div>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Origem</th>
              <th>Cód. WinThor</th>
              <th>Cód. fábrica</th>
              <th>Descrição</th>
              <th>EAN</th>
              <th>NCM</th>
              <th>Embalagem</th>
              <th className="numero">Peso líq.</th>
              <th className="numero">Peso bruto</th>
              <th>Cadastro</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {admin && !fornecedorId && (
              <tr><td colSpan={11} className="vazio">Selecione o fornecedor para ver todos os produtos dele.</td></tr>
            )}
            {carregando && <tr><td colSpan={11} className="vazio">Carregando os produtos do WinThor...</td></tr>}
            {!carregando && dados && visiveis.length === 0 && (
              <tr><td colSpan={11} className="vazio">Nenhum produto encontrado.</td></tr>
            )}
            {!carregando && visiveis.map((p) => (
              <tr key={p.origem === 'WINTHOR' ? `W${p.codProd}` : `P${p.produtoId}`}
                  className={p.origem === 'PORTAL' ? 'linha-clicavel' : undefined}
                  onClick={p.origem === 'PORTAL' ? () => navegar(`/produtos/${p.produtoId}`) : undefined}
                  title={p.origem === 'PORTAL' ? 'Abrir o cadastro do produto' : undefined}>
                <td>
                  {p.origem === 'WINTHOR'
                    ? <span className="etiqueta origem-winthor">WinThor</span>
                    : <span className="etiqueta origem-portal">Novo</span>}
                </td>
                <td><strong>{p.codProd || '-'}</strong></td>
                <td>{p.codigoFabrica || '-'}</td>
                <td className="quebra">{p.descricao}</td>
                <td>{p.ean || '-'}</td>
                <td>{p.ncm || '-'}</td>
                <td>{p.embalagem || (p.qtdEmbalagem ? formatarNumero(p.qtdEmbalagem) : '-')}</td>
                <td className="numero">{formatarNumero(p.pesoLiquido)}</td>
                <td className="numero">{formatarNumero(p.pesoBruto)}</td>
                <td>{formatarData(p.dataCadastro)}</td>
                <td>
                  {p.origem === 'WINTHOR'
                    ? (p.foraDeLinha ? <span className="etiqueta CANCELADO">Fora de linha</span>
                      : <span className="etiqueta APROVADO">Ativo</span>)
                    : (
                      <>
                        <span className={`etiqueta ${p.status}`}>{ROTULO_STATUS[p.status] || p.status}</span>
                        {p.pedidoNumero && <span className="texto-suave"> · pedido {p.pedidoNumero}</span>}
                      </>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtrados.length > POR_PAGINA && (
        <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} totalElementos={filtrados.length} aoMudar={setPagina} />
      )}
    </>
  )
}
