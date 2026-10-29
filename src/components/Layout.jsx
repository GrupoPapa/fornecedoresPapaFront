import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { usuario, admin, sair } = useAuth()

  const classe = ({ isActive }) => (isActive ? 'ativo' : undefined)

  return (
    <div className="app">
      <header className="topo">
        <h1>Portal do Fornecedor</h1>
        <div className="usuario">
          <span>
            {usuario?.nome}
            {usuario?.fornecedorNome ? ` · ${usuario.fornecedorNome}` : ' · Administrador'}
          </span>
          <button type="button" className="sair" onClick={sair}>Sair</button>
        </div>
      </header>

      <nav className="menu">
        <NavLink to="/pedidos" className={classe}>Cadastro de produtos</NavLink>
        <NavLink to="/compras" className={classe}>Pedidos de compra</NavLink>
        <NavLink to="/produtos" className={classe}>Todos os produtos</NavLink>
        {admin && <NavLink to="/admin/fornecedores" className={classe}>Fornecedores</NavLink>}
        {admin && <NavLink to="/admin/usuarios" className={classe}>Usuários</NavLink>}
        {admin && <NavLink to="/trocar-senha" className={classe}>Minha senha</NavLink>}
      </nav>

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
