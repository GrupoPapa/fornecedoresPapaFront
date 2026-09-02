export function formatarCnpj(valor) {
  const d = (valor || '').replace(/\D/g, '').padStart(14, '0').slice(0, 14)
  if (d.length !== 14) return valor || ''
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function somenteDigitos(valor) {
  return (valor || '').replace(/\D/g, '')
}

export function formatarDataHora(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatarNumero(valor, casas = 4) {
  if (valor === null || valor === undefined || valor === '') return '-'
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas
  })
}

export const ROTULO_STATUS = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado'
}

export const ROTULO_TIPO_FORNECEDOR = {
  GERAL: 'Geral',
  PISO_REVESTIMENTO: 'Piso / Revestimento'
}

export function ehPiso(tipo) {
  return tipo === 'PISO_REVESTIMENTO'
}

/** Rotulos e ajudas do formulario de produto conforme o tipo do fornecedor. */
export function rotulosProduto(tipo) {
  if (ehPiso(tipo)) {
    return {
      embalagem: 'm² por caixa',
      embalagemAjuda: 'Metros quadrados que a caixa cobre (ex.: 2,20).',
      pesoLiquido: 'Peso/m² líquido (kg)',
      pesoBruto: 'Peso/m² bruto (kg)',
      pesoBrutoAjuda: 'Deve ser maior ou igual ao peso/m² líquido.',
      caixa: '',
      caixaAjuda: '',
      pallet: 'm² por pallet',
      palletAjuda: 'Metros quadrados fechados por pallet.',
      mostrarMetroCaixa: false
    }
  }
  return {
    embalagem: 'Quantidade por embalagem',
    embalagemAjuda: 'Unidades dentro da caixa.',
    pesoLiquido: 'Peso líquido (kg)',
    pesoBruto: 'Peso bruto (kg)',
    pesoBrutoAjuda: 'Deve ser maior ou igual ao peso líquido.',
    caixa: 'Metro quadrado da caixa',
    caixaAjuda: 'Ex.: 1,44',
    pallet: 'Metro quadrado do pallet',
    palletAjuda: 'Deve ser maior ou igual ao metro quadrado da caixa.',
    mostrarMetroCaixa: true
  }
}
