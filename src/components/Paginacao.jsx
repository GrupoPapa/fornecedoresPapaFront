export default function Paginacao({ pagina, totalPaginas, totalElementos, aoMudar }) {
  if (!totalElementos) return null
  return (
    <div className="paginacao">
      <span>{totalElementos} registro(s) · página {pagina + 1} de {Math.max(totalPaginas, 1)}</span>
      <button type="button" className="btn-secundario btn-pequeno"
              disabled={pagina <= 0} onClick={() => aoMudar(pagina - 1)}>Anterior</button>
      <button type="button" className="btn-secundario btn-pequeno"
              disabled={pagina + 1 >= totalPaginas} onClick={() => aoMudar(pagina + 1)}>Próxima</button>
    </div>
  )
}
