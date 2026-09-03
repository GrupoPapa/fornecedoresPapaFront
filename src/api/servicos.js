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
