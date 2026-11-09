import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RotaProtegida({ children, somenteAdmin = false, somenteFar = false }) {
  const { usuario, admin } = useAuth()
  const local = useLocation()

  if (!usuario) {
    return <Navigate to="/login" state={{ de: local.pathname }} replace />
  }
  if (somenteAdmin && !admin) {
    return <Navigate to="/pedidos" replace />
  }
  if (somenteFar && !admin && !usuario.farHabilitado) {
    return <Navigate to="/pedidos" replace />
  }
  return children
}
