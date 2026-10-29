import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RotaProtegida from './components/RotaProtegida'
import LoginPage from './pages/LoginPage'
import TrocarSenhaPage from './pages/TrocarSenhaPage'
import PedidosPage from './pages/PedidosPage'
import PedidoDetalhePage from './pages/PedidoDetalhePage'
import ProdutosPage from './pages/ProdutosPage'
import ProdutoFormPage from './pages/ProdutoFormPage'
import PedidosCompraPage from './pages/PedidosCompraPage'
import PedidoCompraPage from './pages/PedidoCompraPage'
import FornecedoresPage from './pages/admin/FornecedoresPage'
import UsuariosPage from './pages/admin/UsuariosPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/pedidos/:id" element={<PedidoDetalhePage />} />
        <Route path="/compras" element={<PedidosCompraPage />} />
        <Route path="/compras/novo" element={<PedidoCompraPage />} />
        <Route path="/compras/:id" element={<PedidoCompraPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/produtos/novo" element={<ProdutoFormPage />} />
        <Route path="/produtos/:id" element={<ProdutoFormPage />} />
        <Route path="/admin/fornecedores"
               element={<RotaProtegida somenteAdmin><FornecedoresPage /></RotaProtegida>} />
        <Route path="/admin/usuarios"
               element={<RotaProtegida somenteAdmin><UsuariosPage /></RotaProtegida>} />
      </Route>

      <Route path="/trocar-senha" element={
        <RotaProtegida><TrocarSenhaPage /></RotaProtegida>
      } />

      <Route path="/" element={<Navigate to="/pedidos" replace />} />
      <Route path="*" element={<Navigate to="/pedidos" replace />} />
    </Routes>
  )
}
