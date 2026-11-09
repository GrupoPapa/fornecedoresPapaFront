import { useMemo, useState } from 'react'

const MAX_SUGESTOES = 12

export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Codigo que vai para o campo: CODPROD do WinThor ou, para produto novo do portal, o codigo de fabrica. */
export function codigoDoProduto(p) {
  return p.codProdErp ? String(p.codProdErp) : (p.codigoFabrica || '')
}

/** Produto do catalogo com exatamente este codigo (CODPROD ou codigo de fabrica). */
export function produtoPeloCodigo(produtos, codigo) {
  const c = normalizar(String(codigo || '').trim())
  if (!c) return null
  return produtos.find((p) => (p.codProdErp && String(p.codProdErp) === c) || normalizar(p.codigoFabrica) === c) || null
}

/**
 * Campo de codigo do produto com pesquisa por nome.
 * O fornecedor digita parte do nome ou do codigo e escolhe na lista; ou digita o codigo direto.
 * aoMudar(codigo, descricao): descricao vem do catalogo quando o codigo e reconhecido.
 */
export default function ProdutoAutocomplete({ valor, aoMudar, produtos, disabled, invalido, maxLength = 60 }) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const termo = normalizar(valor.trim())

  const sugestoes = useMemo(() => {
    if (termo.length < 2) return []
    const palavras = termo.split(/\s+/).filter(Boolean)
    return produtos.filter((p) => {
      const alvo = normalizar(`${p.descricao} ${p.codigoFabrica || ''} ${p.codProdErp || ''} ${p.codBarras || ''}`)
      return palavras.every((w) => alvo.includes(w))
    }).slice(0, MAX_SUGESTOES)
  }, [produtos, termo])

  function digitar(texto) {
    const p = produtoPeloCodigo(produtos, texto)
    aoMudar(texto, p ? p.descricao : null)
    setAberto(true)
    setAtivo(0)
  }

  function escolher(p) {
    aoMudar(codigoDoProduto(p).slice(0, maxLength), p.descricao)
    setAberto(false)
  }

  function teclado(e) {
    if (!aberto || sugestoes.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => (i + 1) % sugestoes.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => (i - 1 + sugestoes.length) % sugestoes.length) }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(sugestoes[ativo] || sugestoes[0]) }
    else if (e.key === 'Escape') setAberto(false)
  }

  // ja escolhido: nao reabre a lista so porque o codigo bate com o nome de outro produto
  const escolhido = !!produtoPeloCodigo(produtos, valor)

  return (
    <div className="autocomplete">
      <input value={valor} maxLength={maxLength} disabled={disabled} autoComplete="off"
             placeholder="Código ou nome do produto"
             className={invalido ? 'invalido' : undefined}
             onChange={(e) => digitar(e.target.value)}
             onFocus={() => setAberto(true)}
             onBlur={() => setTimeout(() => setAberto(false), 150)}
             onKeyDown={teclado} />

      {aberto && !disabled && !escolhido && sugestoes.length > 0 && (
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
      {aberto && !disabled && !escolhido && termo.length >= 2 && sugestoes.length === 0 && produtos.length > 0 && (
        <ul className="sugestoes"><li className="vazio-sugestao">Nenhum produto encontrado. Você pode digitar o código direto.</li></ul>
      )}
    </div>
  )
}
