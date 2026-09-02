import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { mensagemErro } from '../api/http'
import Campo from '../components/Campo'

export default function LoginPage() {
  const { entrar, usuario } = useAuth()
  const navegar = useNavigate()
  const local = useLocation()
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  if (usuario) {
    return <Navigate to={local.state?.de || '/produtos'} replace />
  }

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await entrar(login.trim(), senha)
      navegar(local.state?.de || '/produtos', { replace: true })
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível entrar. Verifique os dados informados.'))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="pagina-login">
      <form className="caixa-login" onSubmit={enviar}>
        <h1>Portal do Fornecedor</h1>
        <p className="sub">Cadastro de produtos · entre com o seu código de fornecedor ou e-mail.</p>

        {erro && <div className="aviso erro">{erro}</div>}

        <div className="formulario">
          <Campo label="Código do fornecedor ou e-mail" obrigatorio>
            <input type="text" value={login} autoComplete="username" required
                   onChange={(e) => setLogin(e.target.value)} placeholder="Ex.: 2448 ou seu@email.com.br" />
          </Campo>
          <Campo label="Senha" obrigatorio>
            <input type="password" value={senha} autoComplete="current-password" required
                   onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
          </Campo>
          <button type="submit" className="btn-primario" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
