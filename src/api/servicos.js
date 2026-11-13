import http from './http'

export const authApi = {
  login: (usuario, senha) => http.post('/api/auth/login', { usuario, senha }).then((r) => r.data),
  me: () => http.get('/api/auth/me').then((r) => r.data),
  trocarSenha: (senhaAtual, novaSenha) =>
    http.post('/api/auth/trocar-senha', { senhaAtual, novaSenha })
}

export const produtosApi = {
  listar: (params) => http.get('/api/produtos', { params }).then((r) => r.data),
  resumo: () => http.get('/api/produtos/resumo').then((r) => r.data),
  conferirCodigos: (params) =>
    http.get('/api/produtos/conferir-codigos', { params, timeout: 20000 }).then((r) => r.data),
  catalogo: (fornecedorId) =>
    http.get('/api/produtos/catalogo', { params: fornecedorId ? { fornecedorId } : {}, timeout: 60000 }).then((r) => r.data),
  buscar: (id) => http.get(`/api/produtos/${id}`).then((r) => r.data),
  historico: (id) => http.get(`/api/produtos/${id}/historico`).then((r) => r.data),
  criar: (dados, fornecedorId, pedidoId) => {
    const params = {}
    if (fornecedorId) params.fornecedorId = fornecedorId
    if (pedidoId) params.pedidoId = pedidoId
    return http.post('/api/produtos', dados, { params }).then((r) => r.data)
  },
  atualizar: (id, dados) => http.put(`/api/produtos/${id}`, dados).then((r) => r.data),
  enviar: (id) => http.post(`/api/produtos/${id}/enviar`).then((r) => r.data),
  excluir: (id) => http.delete(`/api/produtos/${id}`),
  aprovar: (id, parecer) =>
    http.post(`/api/admin/produtos/${id}/aprovar`, { parecer }).then((r) => r.data),
  reprovar: (id, parecer) =>
    http.post(`/api/admin/produtos/${id}/reprovar`, { parecer }).then((r) => r.data),
  reabrir: (id) => http.post(`/api/admin/produtos/${id}/reabrir`).then((r) => r.data),
  retirarRessalva: (id) =>
    http.post(`/api/admin/produtos/${id}/retirar-ressalva`).then((r) => r.data),
  exportar: (params) => http.get('/api/produtos/exportar', { params, responseType: 'blob' })
}

export const pedidosApi = {
  listar: (params) => http.get('/api/pedidos', { params }).then((r) => r.data),
  aberto: () => http.get('/api/pedidos/aberto').then((r) => r.data),
  abrir: (fornecedorId) =>
    http.post('/api/pedidos/abrir', null, { params: fornecedorId ? { fornecedorId } : {} })
      .then((r) => r.data),
  buscar: (id) => http.get(`/api/pedidos/${id}`).then((r) => r.data),
  atualizar: (id, dados) => http.put(`/api/pedidos/${id}`, dados).then((r) => r.data),
  enviar: (id) => http.post(`/api/pedidos/${id}/enviar`).then((r) => r.data),
  excluir: (id) => http.delete(`/api/pedidos/${id}`),
  aprovar: (id, parecer) =>
    http.post(`/api/admin/pedidos/${id}/aprovar`, { parecer }).then((r) => r.data),
  reprovar: (id, parecer) =>
    http.post(`/api/admin/pedidos/${id}/reprovar`, { parecer }).then((r) => r.data),
  reabrir: (id) => http.post(`/api/admin/pedidos/${id}/reabrir`).then((r) => r.data),
  integrar: (id) => http.post(`/api/admin/pedidos/${id}/integrar`).then((r) => r.data)
}

export const fotosApi = {
  listar: (produtoId) => http.get(`/api/produtos/${produtoId}/fotos`).then((r) => r.data),
  anexar: (produtoId, arquivo) => {
    const dados = new FormData()
    dados.append('arquivo', arquivo)
    return http.post(`/api/produtos/${produtoId}/fotos`, dados).then((r) => r.data)
  },
  // a imagem vem autenticada, por isso e baixada como blob e exibida via object URL
  conteudo: (produtoId, fotoId) =>
    http.get(`/api/produtos/${produtoId}/fotos/${fotoId}`, { responseType: 'blob' }).then((r) => r.data),
  principal: (produtoId, fotoId) =>
    http.patch(`/api/produtos/${produtoId}/fotos/${fotoId}/principal`),
  excluir: (produtoId, fotoId) => http.delete(`/api/produtos/${produtoId}/fotos/${fotoId}`)
}

export const fornecedoresApi = {
  listar: (params) => http.get('/api/admin/fornecedores', { params }).then((r) => r.data),
  todos: () => http.get('/api/admin/fornecedores/todos').then((r) => r.data),
  criar: (dados) => http.post('/api/admin/fornecedores', dados).then((r) => r.data),
  atualizar: (id, dados) => http.put(`/api/admin/fornecedores/${id}`, dados).then((r) => r.data)
}

export const erpApi = {
  fornecedores: (termo) =>
    http.get('/api/admin/erp/fornecedores', { params: { termo, limite: 100 } }).then((r) => r.data),
  importarFornecedor: (codFornec) =>
    http.post(`/api/admin/erp/fornecedores/${codFornec}/importar`).then((r) => r.data),
  marcas: () => http.get('/api/admin/erp/marcas').then((r) => r.data),
  departamentos: () => http.get('/api/admin/erp/departamentos').then((r) => r.data),
  secoes: (codEpto) =>
    http.get('/api/admin/erp/secoes', { params: codEpto ? { codEpto } : {} }).then((r) => r.data)
}

export const produtoErpApi = {
  buscar: (produtoId) => http.get(`/api/admin/produtos/${produtoId}/erp`).then((r) => r.data),
  salvar: (produtoId, dados) =>
    http.put(`/api/admin/produtos/${produtoId}/erp`, dados).then((r) => r.data),
  integrar: (produtoId) =>
    http.post(`/api/admin/produtos/${produtoId}/erp/integrar`).then((r) => r.data)
}

export const usuariosApi = {
  listar: (params) => http.get('/api/admin/usuarios', { params }).then((r) => r.data),
  criar: (dados) => http.post('/api/admin/usuarios', dados).then((r) => r.data),
  atualizar: (id, dados) => http.put(`/api/admin/usuarios/${id}`, dados).then((r) => r.data),
  definirSenha: (id, senha, enviarEmail) =>
    http.post(`/api/admin/usuarios/${id}/senha`,
      { senha: senha || null, enviarEmail }).then((r) => r.data),
  situacao: (id, ativo) =>
    http.patch(`/api/admin/usuarios/${id}/situacao`, null, { params: { ativo } }).then((r) => r.data)
}

export const comprasApi = {
  listar: (params) => http.get('/api/pedidos-compra', { params }).then((r) => r.data),
  catalogo: (fornecedorId) =>
    http.get('/api/pedidos-compra/catalogo', { params: fornecedorId ? { fornecedorId } : {} })
      .then((r) => r.data),
  filiais: () => http.get('/api/pedidos-compra/filiais').then((r) => r.data),
  configuracao: () => http.get('/api/pedidos-compra/configuracao').then((r) => r.data),
  buscar: (id) => http.get(`/api/pedidos-compra/${id}`).then((r) => r.data),
  criar: (dados, fornecedorId) =>
    http.post('/api/pedidos-compra', dados, { params: fornecedorId ? { fornecedorId } : {} })
      .then((r) => r.data),
  atualizar: (id, dados) => http.put(`/api/pedidos-compra/${id}`, dados).then((r) => r.data),
  enviar: (id) => http.post(`/api/pedidos-compra/${id}/enviar`).then((r) => r.data),
  cancelar: (id, parecer) =>
    http.post(`/api/pedidos-compra/${id}/cancelar`, { parecer }).then((r) => r.data),
  historico: (id) => http.get(`/api/pedidos-compra/${id}/historico`).then((r) => r.data),
  situacaoWinthor: (id) => http.get(`/api/pedidos-compra/${id}/winthor`).then((r) => r.data),
  exportar: (params) =>
    http.get('/api/pedidos-compra/exportar', { params, responseType: 'blob' }),
  // setor fiscal
  comparativo: (id) => http.get(`/api/admin/pedidos-compra/${id}/comparativo`).then((r) => r.data),
  resolverDivergencia: (id, dados) =>
    http.post(`/api/admin/pedidos-compra/${id}/resolver-divergencia`, dados || {}).then((r) => r.data),
  aprovar: (id, dados) =>
    http.post(`/api/admin/pedidos-compra/${id}/aprovar`, dados || {}).then((r) => r.data),
  revisar: (id, parecer) =>
    http.post(`/api/admin/pedidos-compra/${id}/revisar`, { parecer }).then((r) => r.data),
  reprovar: (id, parecer) =>
    http.post(`/api/admin/pedidos-compra/${id}/reprovar`, { parecer }).then((r) => r.data),
  gerarSugestao: (id) =>
    http.post(`/api/admin/pedidos-compra/${id}/gerar-sugestao`).then((r) => r.data),
  voltarAnalise: (id) =>
    http.post(`/api/admin/pedidos-compra/${id}/voltar-analise`).then((r) => r.data)
}

/** Monta o corpo multipart da FAR: 'dados' em JSON + comprovante opcional. */
function corpoFar(dados, comprovante) {
  const corpo = new FormData()
  corpo.append('dados', new Blob([JSON.stringify(dados)], { type: 'application/json' }))
  if (comprovante) corpo.append('comprovante', comprovante)
  return corpo
}

export const farApi = {
  listar: (params) => http.get('/api/far', { params }).then((r) => r.data),
  motivos: () => http.get('/api/far/motivos').then((r) => r.data),
  verificarNota: (numero, fornecedorId) =>
    http.get('/api/far/verificar-nota', { params: fornecedorId ? { numero, fornecedorId } : { numero } }).then((r) => r.data),
  criarMotivoFar: (dados) => http.post('/api/far/motivos', dados).then((r) => r.data),
  buscar: (id) => http.get(`/api/far/${id}`).then((r) => r.data),
  criar: (dados, comprovante, fornecedorId) =>
    http.post('/api/far', corpoFar(dados, comprovante), { params: fornecedorId ? { fornecedorId } : {} })
      .then((r) => r.data),
  atualizar: (id, dados, comprovante) =>
    http.put(`/api/far/${id}`, corpoFar(dados, comprovante)).then((r) => r.data),
  historico: (id) => http.get(`/api/far/${id}/historico`).then((r) => r.data),
  anexos: (id) => http.get(`/api/far/${id}/anexos`).then((r) => r.data),
  anexar: (id, arquivo, tipo) => {
    const corpo = new FormData()
    corpo.append('arquivo', arquivo)
    return http.post(`/api/far/${id}/anexos`, corpo, { params: { tipo } }).then((r) => r.data)
  },
  conteudoAnexo: (id, anexoId) =>
    http.get(`/api/far/${id}/anexos/${anexoId}`, { responseType: 'blob' }).then((r) => r.data),
  excluirAnexo: (id, anexoId) => http.delete(`/api/far/${id}/anexos/${anexoId}`),
  exportar: (params) => http.get('/api/far/exportar', { params, responseType: 'blob' }),
  // equipe interna
  fornecedores: () => http.get('/api/admin/far/fornecedores').then((r) => r.data),
  todosMotivos: () => http.get('/api/admin/far/motivos').then((r) => r.data),
  criarMotivo: (dados) => http.post('/api/admin/far/motivos', dados).then((r) => r.data),
  atualizarMotivo: (id, dados) => http.put(`/api/admin/far/motivos/${id}`, dados).then((r) => r.data),
  vincularBaixa: (id, dados) => http.post(`/api/admin/far/${id}/baixa-fiscal`, dados || {}).then((r) => r.data),
  desfazerBaixa: (id, motivo) =>
    http.post(`/api/admin/far/${id}/baixa-fiscal/desfazer`, { motivo }).then((r) => r.data)
}

/** Planilhas modelo e importacao (cadastro de produtos e pedido de compra). */
function enviarPlanilha(url, arquivo, fornecedorId) {
  const corpo = new FormData()
  corpo.append('arquivo', arquivo)
  return http.post(url, corpo, { params: fornecedorId ? { fornecedorId } : {}, timeout: 180000 }).then((r) => r.data)
}

export const importacaoApi = {
  modeloProdutos: (fornecedorId) => http.get('/api/importacao/produtos/modelo',
    { params: fornecedorId ? { fornecedorId } : {}, responseType: 'blob', timeout: 60000 }).then((r) => r.data),
  importarProdutos: (arquivo, fornecedorId) => enviarPlanilha('/api/importacao/produtos', arquivo, fornecedorId),
  modeloCompra: (fornecedorId) => http.get('/api/importacao/pedidos-compra/modelo',
    { params: fornecedorId ? { fornecedorId } : {}, responseType: 'blob', timeout: 60000 }).then((r) => r.data),
  importarCompra: (arquivo, fornecedorId) => enviarPlanilha('/api/importacao/pedidos-compra', arquivo, fornecedorId)
}
