import axios from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('cfp_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('cfp_token')
      localStorage.removeItem('cfp_usuario')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

const ROTULO_CAMPO = {
  codigo: 'Código de fábrica do produto',
  codigoProduto: 'Código do produto',
  qtdProdutos: 'Qtd. de produtos',
  quantidade: 'Quantidade',
  motivoReprovacao: 'Motivo da reprovação',
  itens: 'Produtos',
  motivoId: 'Motivo',
  dataVisita: 'Data da visita',
  descricao: 'Descrição',
  codBarraCaixa: 'Cód. barras da caixa MASTER (DUN)',
  codBarraProduto: 'Cód. barras do produto',
  ncm: 'NCM',
  pesoLiquido: 'Peso líquido',
  pesoBruto: 'Peso bruto',
  metroCaixa: 'Metro quadrado da caixa',
  metroPallet: 'Metro quadrado do pallet',
  qtdEmbalagem: 'Quantidade por embalagem / caixa MASTER',
  m2Caixa: 'm² por caixa',
  m2Pallet: 'm² por pallet',
  tipo: 'Tipo de fornecedor',
  observacao: 'Observações',
  cnpj: 'CNPJ',
  razaoSocial: 'Razão social',
  nomeFantasia: 'Nome fantasia',
  email: 'E-mail',
  telefone: 'Telefone',
  nome: 'Nome',
  perfil: 'Perfil',
  fornecedorId: 'Fornecedor',
  codFilialCompra: 'Filial de compra',
  senhaProvisoria: 'Senha provisória',
  novaSenha: 'Nova senha',
  senhaAtual: 'Senha atual',
  usuario: 'E-mail ou código do fornecedor'
}

/** Rotulo do campo; itens de lista ("itens[2].quantidade") viram "Produto 3 - Quantidade". */
function rotuloCampo(campo) {
  const item = /^itens\[(\d+)\]\.(\w+)$/.exec(campo || '')
  if (item) return `Produto ${Number(item[1]) + 1} - ${ROTULO_CAMPO[item[2]] || item[2]}`
  return ROTULO_CAMPO[campo] || campo
}

/** Extrai a mensagem de erro da API em um texto amigavel, identificando o campo. */
export function mensagemErro(error, padrao = 'Não foi possível concluir a operação.') {
  const data = error?.response?.data
  if (!data) return error?.message || padrao
  if (data.campos?.length) {
    return data.campos
      .map((c) => `${rotuloCampo(c.campo)}: ${c.mensagem}`)
      .join(' · ')
  }
  return data.mensagem || padrao
}

/** Erros por campo, para destacar os inputs do formulario. */
export function errosPorCampo(error) {
  const campos = error?.response?.data?.campos || []
  return campos.reduce((acc, c) => ({ ...acc, [c.campo]: c.mensagem }), {})
}

export default http
