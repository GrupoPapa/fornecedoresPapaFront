import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/servicos'
import { mensagemErro } from '../api/http'
import { useAuth } from '../context/AuthContext'
import Campo from '../components/Campo'

export default function TrocarSenhaPage() {
  const { usuario, atualizarUsuario, sair } = useAuth()
  const navegar = useNavigate()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const obrigatoria = false

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    if (novaSenha !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.')
      return
    }
    if (novaSenha.length < 8) {
      setErro('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }
    setCarregando(true)
    try {
      await authApi.trocarSenha(senhaAtual, novaSenha)
      atualizarUsuario({ ...usuario, trocarSenha: false })
      setSucesso('Senha alterada com sucesso.')
      setSenhaAtual(''); setNovaSenha(''); setConfirmacao('')
      setTimeout(() => navegar('/produtos', { replace: true }), 800)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="pagina-login">
      <form className="caixa-login" onSubmit={enviar}>
        <h1>Alterar senha</h1>
        <p className="sub">
          {obrigatoria
            ? 'Por segurança, defina uma nova senha antes de usar o portal.'
            : 'Defina uma nova senha de acesso.'}
        </p>

        {erro && <div className="aviso erro">{erro}</div>}
        {sucesso && <div className="aviso sucesso">{sucesso}</div>}

        <div className="formulario">
          <Campo label="Senha atual" obrigatorio>
            <input type="password" value={senhaAtual} autoComplete="current-password" required
                   onChange={(e) => setSenhaAtual(e.target.value)} />
          </Campo>
          <Campo label="Nova senha" obrigatorio ajuda="Mínimo de 8 caracteres.">
            <input type="password" value={novaSenha} autoComplete="new-password" required
                   onChange={(e) => setNovaSenha(e.target.value)} />
          </Campo>
          <Campo label="Confirme a nova senha" obrigatorio>
            <input type="password" value={confirmacao} autoComplete="new-password" required
                   onChange={(e) => setConfirmacao(e.target.value)} />
          </Campo>
          <button type="submit" className="btn-primario" disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
          <button type="button" className="btn-secundario"
                  onClick={() => (obrigatoria ? sair() : navegar('/produtos'))}>
            {obrigatoria ? 'Sair' : 'Voltar'}
          </button>
        </div>
      </form>
    </div>
  )
}
