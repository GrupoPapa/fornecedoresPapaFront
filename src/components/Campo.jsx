export default function Campo({ label, erro, ajuda, children, obrigatorio }) {
  return (
    <div className="campo">
      <label>
        {label} {obrigatorio && <span style={{ color: 'var(--cor-erro)' }}>*</span>}
      </label>
      {children}
      {ajuda && !erro && <span className="ajuda">{ajuda}</span>}
      {erro && <span className="erro">{erro}</span>}
    </div>
  )
}
