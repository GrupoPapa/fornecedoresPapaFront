export default function Modal({ titulo, children, rodape, aoFechar, largura }) {
  return (
    <div className="fundo-modal" onClick={aoFechar}>
      <div className="modal" style={largura ? { maxWidth: largura } : undefined}
           onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{titulo}</h3>
          <button type="button" className="btn-secundario btn-pequeno" onClick={aoFechar}>Fechar</button>
        </header>
        <div className="corpo">{children}</div>
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  )
}
