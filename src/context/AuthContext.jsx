import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { authApi } from '../api/servicos'

const AuthContext = createContext(null)

function lerUsuarioSalvo() {
  try {
    const bruto = localStorage.getItem('cfp_usuario')
    return bruto ? JSON.parse(bruto) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(lerUsuarioSalvo)

  const entrar = useCallback(async (usuario, senha) => {
    const dados = await authApi.login(usuario, senha)
    localStorage.setItem('cfp_token', dados.token)
    localStorage.setItem('cfp_usuario', JSON.stringify(dados.usuario))
    setUsuario(dados.usuario)
    return dados.usuario
  }, [])

  const sair = useCallback(() => {
    localStorage.removeItem('cfp_token')
    localStorage.removeItem('cfp_usuario')
    setUsuario(null)
  }, [])

  const atualizarUsuario = useCallback((novo) => {
    localStorage.setItem('cfp_usuario', JSON.stringify(novo))
    setUsuario(novo)
  }, [])

  const valor = useMemo(() => ({
    usuario,
    autenticado: !!usuario,
    admin: usuario?.perfil === 'ADMIN',
    entrar,
    sair,
    atualizarUsuario
  }), [usuario, entrar, sair, atualizarUsuario])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
