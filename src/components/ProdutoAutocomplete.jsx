import { useMemo, useState } from 'react'

const MAX_SUGESTOES = 12

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Codigo que vai para o campo: CODPROD do WinThor ou, para produto novo do portal, o codigo de fabrica. */
export function codigoDoProduto(p) {
  return p.codProdErp ? String(p.codProdErp) : (p.codigoFabrica || '')
}

/**
 * Campo de codigo(s) do produto com pesquisa por nome.
 * O fornecedor digita parte do nome ou do codigo; ao escolher, o codigo substitui o
 * trecho que estava sendo digitado (depois da ultima virgula). Varios produtos = codigos separados por virgula.
 */
export default function ProdutoAutocomplete({ valor, aoMudar, produtos, disabled, invalido, maxLength = 200 }) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)

  const partes = valor.split(',')
  const termo = normalizar(partes[partes.length - 1].trim())

  const sugestoes = useMemo(() => {
    if (termo.length < 2) return []
    const palavras = termo.split(/\s+/).filter(Boolean)
    return produtos.filter((p) => {
      const alvo = normalizar(`${p.descricao} ${p.codigoFabrica || ''} ${p.codProdErp || ''} ${p.codBarras || ''}`)
      return palavras.every((w) => alvo.includes(w))
    }).slice(0, MAX_SUGESTOES)
  }, [produtos, termo])

  // nomes dos codigos ja informados, para o fornecedor conferir
  const reconhecidos = useMemo(() => {
    const porCodigo = new Map()
    produtos.forEach((p) => {
      if (p.codProdErp) porCodigo.set(String(p.codProdErp), p)
      if (p.codigoFabrica) porCodigo.set(normalizar(p.codigoFabrica), p)
    })
    return valor.split(',').map((c) => c.trim()).filter(Boolean)
      .map((c) => ({ codigo: c, produto: porCodigo.get(c) || porCodigo.get(normalizar(c)) }))
      .filter((x) => x.produto)
  }, [valor, produtos])

  function escolher(p) {
    const anteriores = partes.slice(0, -1).map((s) => s.trim()).filter(Boolean)
    aoMudar([...anteriores, codigoDoProduto(p)].join(', ').slice(0, maxLength))
    setAberto(false)
  }

  function teclado(e) {
    if (!aberto || sugestoes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => (i + 1) % sugestoes.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => (i - 1 + sugestoes.length) % sugestoes.length) }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(sugestoes[ativo] || sugestoes[0]) }
    else if (e.key === 'Escape') setAberto(false)
  }

  return (
    <div className="autocomplete">
      <input value={valor} maxLength={maxLength} disabled={disabled} autoComplete="off"
             placeholder="Digite o código ou o nome do produto"
             className={invalido ? 'invalido' : undefined}
             onChange={(e) => { aoMudar(e.target.value); setAberto(true); setAtivo(0) }}
             onFocus={() => setAberto(true)}
             onBlur={() => setTimeout(() => setAberto(false), 150)}
             onKeyDown={teclado} />

      {aberto && !disabled && sugestoes.length > 0 && (
        <ul className="sugestoes" role="listbox">
          {sugestoes.map((p, i) => (
            <li key={`${p.origem}-${p.codProdErp || p.produtoId}`} role="option" aria-selected={i === ativo}
                className={i === ativo ? 'ativo' : undefined}
                onMouseDown={(e) => { e.preventDefault(); escolher(p) }}
                onMouseEnter={() => setAtivo(i)}>
              <strong>{codigoDoProduto(p)}</strong> <span>{p.descricao}</span>
              <small>
                {p.codProdErp ? 'WinThor' : 'Produto novo do portal'}
                {p.codigoFabrica && p.codProdErp ? ` · fábrica ${p.codigoFabrica}` : ''}
                {p.embalagem ? ` · ${p.embalagem}` : ''}
              </small>
            </li>
          ))}
        </ul>
      )}
      {aberto && !disabled && termo.length >= 2 && sugestoes.length === 0 && produtos.length > 0 && (
        <ul className="sugestoes"><li className="vazio-sugestao">Nenhum produto encontrado. Você pode digitar o código direto.</li></ul>
      )}

      {reconhecidos.length > 0 && (
        <ul className="produtos-reconhecidos">
          {reconhecidos.map(({ codigo, produto }) => (
            <li key={codigo}><strong>{codigo}</strong> {produto.descricao}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
