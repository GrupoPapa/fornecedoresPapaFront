import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { authApi } from '../api/servicos'
import { useAuth } from '../context/AuthContext'
import { formatarCnpj } from '../utils/format'

export default function Layout() {
  const { usuario, admin, sair, atualizarUsuario } = useAuth()

  // recarrega o usuario ao abrir o portal: libera/esconde modulos (ex.: FAR) sem novo login
  useEffect(() => {
    authApi.me().then(atualizarUsuario).catch(() => {})
  }, [atualizarUsuario])

  const classe = ({ isActive }) => (isActive ? 'ativo' : undefined)

  return (
    <div className="app">
      <header className="topo">
        <h1>Portal do Fornecedor</h1>
        <div className="usuario">
          <div className="identificacao">
            <span>
              {usuario?.nome}
              {usuario?.fornecedorNome ? ` · ${usuario.fornecedorNome}` : ' · Administrador'}
            </span>
            {usuario?.fornecedorNome && (usuario.fornecedorCodErp || usuario.fornecedorCnpj) && (
              <span className="dados-fornecedor">
                {usuario.fornecedorCodErp && <>Cód. <strong>{usuario.fornecedorCodErp}</strong></>}
                {usuario.fornecedorCodErp && usuario.fornecedorCnpj && ' · '}
                {usuario.fornecedorCnpj && <>CNPJ <strong>{formatarCnpj(usuario.fornecedorCnpj)}</strong></>}
              </span>
            )}
          </div>
          <button type="button" className="sair" onClick={sair}>Sair</button>
        </div>
      </header>

      <nav className="menu">
        <NavLink to="/pedidos" className={classe}>Cadastro de produtos</NavLink>
        <NavLink to="/compras" className={classe}>Pedidos de compra</NavLink>
        <NavLink to="/produtos" className={classe}>Todos os produtos</NavLink>
        {usuario?.farHabilitado && <NavLink to="/far" className={classe}>Controle de avarias (FAR)</NavLink>}
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
