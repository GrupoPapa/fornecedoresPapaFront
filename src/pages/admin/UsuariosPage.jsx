import { useCallback, useEffect, useState } from 'react'
import { fornecedoresApi, usuariosApi } from '../../api/servicos'
import { errosPorCampo, mensagemErro } from '../../api/http'
import { formatarDataHora } from '../../utils/format'
import Campo from '../../components/Campo'
import Modal from '../../components/Modal'
import Paginacao from '../../components/Paginacao'

const VAZIO = { nome: '', email: '', perfil: 'FORNECEDOR', fornecedorId: '',
  senhaProvisoria: '', ativo: true, enviarEmail: true }

export default function UsuariosPage() {
  const [dados, setDados] = useState({ conteudo: [], pagina: 0, totalPaginas: 0, totalElementos: 0 })
  const [fornecedores, setFornecedores] = useState([])
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [edicao, setEdicao] = useState(null)
  const [erros, setErros] = useState({})
  const [senhaGerada, setSenhaGerada] = useState(null)
  const [definindoSenha, setDefinindoSenha] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = { pagina, tamanho: 20 }
      if (termo.trim()) params.termo = termo.trim()
      setDados(await usuariosApi.listar(params))
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }, [pagina, termo])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { fornecedoresApi.todos().then(setFornecedores).catch(() => setFornecedores([])) }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro(''); setErros({})
    const envio = {
      nome: edicao.nome,
      email: edicao.email,
      perfil: edicao.perfil,
      fornecedorId: edicao.perfil === 'FORNECEDOR' ? Number(edicao.fornecedorId) : null,
      senhaProvisoria: edicao.senhaProvisoria || null,
      ativo: edicao.ativo,
      enviarEmail: edicao.enviarEmail !== false
    }
    try {
      if (edicao.id) {
        await usuariosApi.atualizar(edicao.id, envio)
        setMensagem('Usuário atualizado.')
        setEdicao(null)
      } else {
        const resposta = await usuariosApi.criar(envio)
        setEdicao(null)
        setSenhaGerada(resposta)
      }
      carregar()
    } catch (err) {
      setErro(mensagemErro(err))
      setErros(errosPorCampo(err))
    }
  }

  async function salvarSenha() {
    setErro('')
    try {
      const resposta = await usuariosApi.definirSenha(
        definindoSenha.usuario.id, definindoSenha.senha, definindoSenha.enviarEmail !== false)
      setDefinindoSenha(null)
      setSenhaGerada(resposta)
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  async function alternarSituacao(usuario) {
    setErro('')
    try {
      await usuariosApi.situacao(usuario.id, !usuario.ativo)
      carregar()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h2>Usuários</h2>
          <p>Crie o acesso do fornecedor e informe a senha a ele. A senha é definida por vocês — o fornecedor não a altera.</p>
        </div>
        <button type="button" className="btn-primario" onClick={() => { setEdicao({ ...VAZIO }); setErros({}) }}>
          Novo usuário
        </button>
      </div>

      {erro && <div className="aviso erro">{erro}</div>}
      {mensagem && <div className="aviso sucesso">{mensagem}</div>}

      <div className="filtros">
        <Campo label="Buscar">
          <input type="search" value={termo} placeholder="Nome ou e-mail"
                 onChange={(e) => { setPagina(0); setTermo(e.target.value) }} />
        </Campo>
      </div>

      <div className="tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>Perfil</th><th>Fornecedor</th>
              <th>Situação</th><th>Último acesso</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={7} className="vazio">Carregando...</td></tr>}
            {!carregando && dados.conteudo.length === 0 &&
              <tr><td colSpan={7} className="vazio">Nenhum usuário cadastrado.</td></tr>}
            {!carregando && dados.conteudo.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>{u.perfil === 'ADMIN' ? 'Administrador' : 'Fornecedor'}</td>
                <td>{u.fornecedorNome || '-'}</td>
                <td>{u.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>{formatarDataHora(u.ultimoAcesso)}</td>
                <td className="acoes">
                  <button type="button" className="btn-secundario btn-pequeno"
                          onClick={() => { setEdicao({ ...u, fornecedorId: u.fornecedorId ?? '', senhaProvisoria: '' }); setErros({}) }}>
                    Editar
                  </button>
                  <button type="button" className="btn-secundario btn-pequeno"
                          onClick={() => setDefinindoSenha({ usuario: u, senha: '', enviarEmail: true })}>
                    Definir senha
                  </button>
                  <button type="button" className="btn-perigo btn-pequeno" onClick={() => alternarSituacao(u)}>
                    {u.ativo ? 'Inativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas}
                 totalElementos={dados.totalElementos} aoMudar={setPagina} />

      {edicao && (
        <Modal titulo={edicao.id ? 'Editar usuário' : 'Novo usuário'} aoFechar={() => setEdicao(null)}>
          <form className="formulario" onSubmit={salvar}>
            <Campo label="Nome" obrigatorio erro={erros.nome}>
              <input value={edicao.nome} required maxLength={150}
                     onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            </Campo>
            <Campo label="E-mail (login)" obrigatorio erro={erros.email}>
              <input type="email" value={edicao.email} required maxLength={150}
                     onChange={(e) => setEdicao({ ...edicao, email: e.target.value })} />
            </Campo>
            <div className="grade">
              <Campo label="Perfil" obrigatorio erro={erros.perfil}>
                <select value={edicao.perfil}
                        onChange={(e) => setEdicao({ ...edicao, perfil: e.target.value })}>
                  <option value="FORNECEDOR">Fornecedor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </Campo>
              {edicao.perfil === 'FORNECEDOR' && (
                <Campo label="Fornecedor" obrigatorio erro={erros.fornecedorId}>
                  <select value={edicao.fornecedorId} required
                          onChange={(e) => setEdicao({ ...edicao, fornecedorId: e.target.value })}>
                    <option value="">Selecione...</option>
                    {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
                  </select>
                </Campo>
              )}
              <Campo label="Situação">
                <select value={edicao.ativo ? '1' : '0'}
                        onChange={(e) => setEdicao({ ...edicao, ativo: e.target.value === '1' })}>
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </Campo>
            </div>
            {!edicao.id && (
              <>
                <Campo label="Senha de acesso" erro={erros.senhaProvisoria}
                       ajuda="Mínimo de 8 caracteres. Em branco, o sistema gera uma para você repassar.">
                  <input value={edicao.senhaProvisoria}
                         onChange={(e) => setEdicao({ ...edicao, senhaProvisoria: e.target.value })} />
                </Campo>
                <label className="caixa-selecao">
                  <input type="checkbox" checked={edicao.enviarEmail !== false}
                         onChange={(e) => setEdicao({ ...edicao, enviarEmail: e.target.checked })} />
                  <span>Enviar os dados de acesso para o e-mail informado</span>
                </label>
              </>
            )}
            <div className="botoes" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secundario" onClick={() => setEdicao(null)}>Cancelar</button>
              <button type="submit" className="btn-primario">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {definindoSenha && (
        <Modal titulo={`Senha de ${definindoSenha.usuario.nome}`} aoFechar={() => setDefinindoSenha(null)}
               rodape={
                 <>
                   <button type="button" className="btn-secundario"
                           onClick={() => setDefinindoSenha(null)}>Cancelar</button>
                   <button type="button" className="btn-primario" onClick={salvarSenha}>Salvar senha</button>
                 </>
               }>
          <Campo label="Nova senha"
                 ajuda="Mínimo de 8 caracteres. Em branco, o sistema gera uma automaticamente.">
            <input value={definindoSenha.senha} autoFocus
                   onChange={(e) => setDefinindoSenha({ ...definindoSenha, senha: e.target.value })} />
          </Campo>
          <label className="caixa-selecao">
            <input type="checkbox" checked={definindoSenha.enviarEmail !== false}
                   onChange={(e) => setDefinindoSenha({ ...definindoSenha, enviarEmail: e.target.checked })} />
            <span>Enviar a nova senha para {definindoSenha.usuario.email}</span>
          </label>
        </Modal>
      )}

      {senhaGerada && (
        <Modal titulo="Senha de acesso" aoFechar={() => setSenhaGerada(null)}
               rodape={<button type="button" className="btn-primario" onClick={() => setSenhaGerada(null)}>Fechar</button>}>
          {senhaGerada.emailEnviado === true && (
            <div className="aviso sucesso">
              Dados de acesso enviados para <strong>{senhaGerada.email}</strong>.
            </div>
          )}
          {senhaGerada.emailEnviado === false && (
            <div className="aviso atencao">
              {senhaGerada.avisoEmail || 'O e-mail não pôde ser enviado.'}
            </div>
          )}
          <div className="aviso atencao">
            Anote os dados abaixo. A senha não será exibida novamente.
          </div>
          <p>
            <strong>Login:</strong>{' '}
            {senhaGerada.codigoFornecedor
              ? <>código <code style={{ fontSize: 16 }}>{senhaGerada.codigoFornecedor}</code> (ou {senhaGerada.email})</>
              : senhaGerada.email}
          </p>
          <p><strong>Senha:</strong> <code style={{ fontSize: 16 }}>{senhaGerada.senhaProvisoria}</code></p>
          <p>Esta senha vale até que vocês a alterem por aqui. O fornecedor não precisa (nem pode) trocá-la.</p>
        </Modal>
      )}
    </>
  )
}
