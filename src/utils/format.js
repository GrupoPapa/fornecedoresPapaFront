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

export const ROTULO_STATUS_PEDIDO = {
  ABERTO: 'Em preenchimento',
  ENVIADO: 'Aguardando análise',
  APROVADO: 'Aprovado',
  REPROVADO: 'Devolvido para correção'
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
      mostrarMetroCaixa: false,
      mostrarMetroPallet: true
    }
  }
  return {
    embalagem: 'Quantidade por embalagem / caixa MASTER',
    embalagemAjuda: 'Unidades dentro da caixa master.',
    pesoLiquido: 'Peso líquido (kg)',
    pesoBruto: 'Peso bruto (kg)',
    pesoBrutoAjuda: 'Deve ser maior ou igual ao peso líquido.',
    caixa: 'Metro quadrado da caixa',
    caixaAjuda: 'Ex.: 1,44',
    pallet: 'Metro quadrado do pallet',
    palletAjuda: 'Deve ser maior ou igual ao metro quadrado da caixa.',
    // medidas de caixa/pallet sao pedidas apenas para piso e revestimento
    mostrarMetroCaixa: false,
    mostrarMetroPallet: false
  }
}

export const ROTULO_STATUS_COMPRA = {
  RASCUNHO: 'Em digitação',
  DIVERGENCIA: 'Divergência de cadastro',
  EM_ANALISE: 'Em análise fiscal',
  REPROVADO: 'Devolvido para reavaliação',
  APROVADO: 'Aprovado',
  CANCELADO: 'Cancelado'
}

export const ROTULO_TIPO_COMPRA = {
  NORMAL: 'Normal',
  BONIFICADO: 'Bonificado'
}

export function formatarMoeda(valor, casas = 2) {
  if (valor === null || valor === undefined || valor === '') return '-'
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 2)
  })
}

/** Datas no formato ISO (AAAA-MM-DD), sem converter fuso. */
export function formatarData(iso) {
  if (!iso) return '-'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** Aceita "1.234,56", "1234,56" ou "1234.56". Devolve null se não for número. */
export function lerDecimal(texto) {
  if (texto === null || texto === undefined) return null
  let t = String(texto).trim().replace(/\s/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Mostra um número para edição no padrão brasileiro, sem separador de milhar. */
export function decimalParaTexto(valor) {
  if (valor === null || valor === undefined || valor === '') return ''
  return String(valor).replace('.', ',')
}

export function hojeIso() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
