import { useState } from 'react'
import Campo from './Campo'

const SIM_NAO = [['S', 'Sim'], ['N', 'Não']]
// PCPRODUT.GTINCODAUXILIAR e NUMBER(2): guarda o PADRAO do codigo, nao o codigo
const PADRAO_GTIN = [['8', 'GTIN-8 (EAN-8)'], ['12', 'GTIN-12 (UPC-A)'],
                     ['13', 'GTIN-13 (EAN-13)'], ['14', 'GTIN-14 (DUN-14)']]
const TIPO_CARGA = [['G', 'Geral (G)'], ['E', 'Especial (E)'], ['A', 'Ambos (A)']]
const LOCAL_SEPARACAO = [['I', 'Interno (I)'], ['EF', 'Externo Ferro (EF)'], ['EG', 'Externo Geral (EG)']]
// mesmas opcoes da rotina 203 do WinThor
const NATUREZA_PRODUTO = [['ME', 'Medicamentos (ME)'], ['OT', 'Outros (OT)'],
                          ['SS', 'Serviços (SS)'], ['VC', 'Veículo (VC)']]

function Bloco({ titulo, children }) {
  return (
    <>
      <h4 className="titulo-bloco">{titulo}</h4>
      {children}
    </>
  )
}

/** Todos os campos obrigatorios do WinThor, na ordem da tela. */
const CAMPOS_OBRIGATORIOS = [
  'descricao', 'codMarca', 'codEpto', 'codSec', 'codFab', 'classificacaoFiscal', 'codNcmEx',
  'embalagem', 'unidade', 'qtUnit', 'unidadeMaster', 'qtUnitCx', 'multiplo',
  'pesoLiq', 'pesoBruto', 'codAuxiliar', 'gtinCodAuxiliar',
  'sugVenda', 'pComExt1', 'pComInt1', 'pComRep1',
  'revenda', 'temRepos', 'cestaBasicaLegis', 'aceitaVendaFracao',
  'tipoCargaProduto', 'localSeparacao', 'naturezaProduto',
  'enviaInfTecnicaNfe', 'enviaEcommerce', 'usaWms'
]

const vazio = (v) => v === null || v === undefined || String(v).trim() === ''

/**
 * O fundo avermelhado marca TODOS os campos do WinThor e continua ali mesmo
 * depois de preenchidos - e o lembrete de que cada um precisa ser conferido
 * antes de gravar no ERP.
 */
function classeCampo() {
  return 'campo-pendente'
}

function Lista({ campo, label, itens, valor, aoAlterar, erro, ajuda, desabilitado }) {
  const classe = classeCampo()
  if (!itens || itens.length === 0) {
    return (
      <Campo label={label} obrigatorio erro={erro}
             ajuda={ajuda || 'Lista do WinThor indisponível — informe o código.'}>
        <input type="number" value={valor ?? ''} disabled={desabilitado} className={classe}
               onChange={(e) => aoAlterar(campo, e.target.value)} />
      </Campo>
    )
  }
  return (
    <Campo label={label} obrigatorio erro={erro} ajuda={ajuda}>
      <select value={valor ?? ''} disabled={desabilitado} className={classe}
              onChange={(e) => aoAlterar(campo, e.target.value)}>
        <option value="">Selecione...</option>
        {itens.map((i) => <option key={i.codigo} value={i.codigo}>{i.codigo} · {i.descricao}</option>)}
      </select>
    </Campo>
  )
}

function Opcoes({ campo, label, opcoes, valor, aoAlterar, erro, ajuda, desabilitado }) {
  return (
    <Campo label={label} obrigatorio erro={erro} ajuda={ajuda}>
      <select value={valor ?? ''} disabled={desabilitado} className={classeCampo()}
              onChange={(e) => aoAlterar(campo, e.target.value)}>
        <option value="">Selecione...</option>
        {opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
    </Campo>
  )
}

function Texto({ campo, label, valor, aoAlterar, erro, ajuda, max, tipo, passo, desabilitado }) {
  const classe = [classeCampo(), erro ? 'invalido' : null].filter(Boolean).join(' ')
  return (
    <Campo label={label} obrigatorio erro={erro} ajuda={ajuda}>
      <input type={tipo || 'text'} step={passo} maxLength={max} value={valor ?? ''}
             disabled={desabilitado} className={classe || undefined}
             onChange={(e) => aoAlterar(campo, e.target.value)} />
    </Campo>
  )
}

export default function CamposWinthor({
  form, erros = {}, aoAlterar, marcas, departamentos, secoes, somenteLeitura
}) {
  // o bloco abre travado: os valores ja vem do que o fornecedor mandou e so
  // sao alterados depois de clicar em "Editar dados"
  const [editando, setEditando] = useState(false)
  const travado = somenteLeitura || !editando
  const faltam = CAMPOS_OBRIGATORIOS.filter((c) => vazio(form[c])).length

  const p = (campo, extras = {}) => ({
    campo, valor: form[campo], aoAlterar, erro: erros[campo],
    desabilitado: travado, ...extras
  })

  return (
    <div className="bloco-winthor">
      <div className="cabecalho-bloco">
        <h3>Dados do WinThor</h3>
        <span className="legenda-origem">
          <b className="amostra pendente" />
          {faltam > 0
            ? `${faltam} campo(s) ainda em branco`
            : 'todos preenchidos — confira antes de gravar'}
          {!somenteLeitura && (
            <button type="button" className="btn-secundario btn-pequeno"
                    style={{ marginLeft: 10 }}
                    onClick={() => setEditando((v) => !v)}>
              {editando ? 'Concluir edição' : 'Editar dados'}
            </button>
          )}
        </span>
      </div>
      {!somenteLeitura && !editando && (
        <div className="aviso info" style={{ marginTop: 4 }}>
          Os campos vieram preenchidos com o que o fornecedor enviou e com os padrões da casa.
          Clique em <strong>Editar dados</strong> para alterar qualquer um deles.
        </div>
      )}

      <Bloco titulo="Identificação">
        <Texto {...p('descricao', { label: 'Descrição no WinThor', max: 40,
                                    ajuda: 'Máximo de 40 caracteres (limite do WinThor).' })} />
        <div className="grade">
          <Lista campo="codMarca" label="Marca" itens={marcas} valor={form.codMarca}
                 aoAlterar={aoAlterar} erro={erros.codMarca} desabilitado={travado} />
          <Lista campo="codEpto" label="Departamento" itens={departamentos} valor={form.codEpto}
                 aoAlterar={(c, v) => { aoAlterar('codEpto', v); aoAlterar('codSec', '') }}
                 erro={erros.codEpto} desabilitado={travado} />
          <Lista campo="codSec" label="Seção" itens={secoes} valor={form.codSec}
                 aoAlterar={aoAlterar} erro={erros.codSec} desabilitado={travado}
                 ajuda={form.codEpto ? undefined : 'Escolha o departamento primeiro.'} />
        </div>
        <div className="grade">
          <Texto {...p('codFab', { label: 'Código de fábrica (CODFAB)', max: 30 })} />
          <Texto {...p('classificacaoFiscal', { label: 'NCM (classificação fiscal)', max: 10 })} />
          <Texto {...p('codNcmEx', { label: 'CODNCMEX', max: 20,
                                     ajuda: 'Código do NCM/EX no WinThor.' })} />
        </div>
      </Bloco>

      <Bloco titulo="Embalagem e medidas">
        <div className="grade">
          <Texto {...p('embalagem', { label: 'Embalagem', max: 12 })} />
          <Texto {...p('unidade', { label: 'Unidade', max: 2, ajuda: 'Ex.: UN, CX, M2' })} />
          <Texto {...p('qtUnit', { label: 'Qt. unitária (QTUNIT)', tipo: 'number', passo: '0.01' })} />
          <Texto {...p('unidadeMaster', { label: 'Unidade master', max: 2 })} />
        </div>
        <div className="grade">
          <Texto {...p('qtUnitCx', { label: 'Qt. por caixa (QTUNITCX)', tipo: 'number', passo: '0.01' })} />
          <Texto {...p('multiplo', { label: 'Múltiplo', tipo: 'number', passo: '0.000001' })} />
          <Texto {...p('pesoLiq', { label: 'Peso líquido', tipo: 'number', passo: '0.000001' })} />
          <Texto {...p('pesoBruto', { label: 'Peso bruto', tipo: 'number', passo: '0.000001' })} />
        </div>
        <div className="grade">
          <Texto {...p('codAuxiliar', { label: 'Código de barras (CODAUXILIAR)', max: 14,
                                        ajuda: 'Somente números — no WinThor a coluna é numérica.' })} />
          <Opcoes {...p('gtinCodAuxiliar', { label: 'Padrão do GTIN (GTINCODAUXILIAR)',
                                             opcoes: PADRAO_GTIN,
                                             ajuda: 'Padrão do código acima (13 para EAN-13).' })} />
        </div>
      </Bloco>

      <Bloco titulo="Comercial">
        <div className="grade">
          <Texto {...p('sugVenda', { label: 'Sugerir preço de venda (SUGVENDA)', tipo: 'number',
                                     passo: '1', ajuda: 'Código do WinThor. 0 = não sugerir.' })} />
          <Texto {...p('pComExt1', { label: '% comissão externa', tipo: 'number', passo: '0.01' })} />
          <Texto {...p('pComInt1', { label: '% comissão interna', tipo: 'number', passo: '0.01' })} />
          <Texto {...p('pComRep1', { label: '% comissão representante', tipo: 'number', passo: '0.01' })} />
        </div>
        <div className="grade">
          <Opcoes {...p('revenda', { label: 'Revenda', opcoes: SIM_NAO })} />
          <Texto {...p('temRepos', { label: 'Tempo de reposição (dias)', tipo: 'number',
                                     passo: '1', ajuda: 'PCPRODUT.TEMREPOS. Mais usado na casa: 30.' })} />
          <Opcoes {...p('cestaBasicaLegis', { label: 'Cesta básica', opcoes: SIM_NAO })} />
          <Opcoes {...p('aceitaVendaFracao', { label: 'Aceita venda fração', opcoes: SIM_NAO })} />
        </div>
      </Bloco>

      <Bloco titulo="Logística e integrações">
        <div className="grade">
          <Opcoes {...p('tipoCargaProduto', { label: 'Tipo carga produto', opcoes: TIPO_CARGA })} />
          <Opcoes {...p('localSeparacao', { label: 'Local de separação', opcoes: LOCAL_SEPARACAO })} />
          <Opcoes {...p('naturezaProduto', { label: 'Natureza do produto',
                                             opcoes: NATUREZA_PRODUTO, ajuda: 'Padrão: Outros (OT)' })} />
        </div>
        <div className="grade">
          <Opcoes {...p('enviaInfTecnicaNfe', { label: 'Envia info técnica NFe', opcoes: SIM_NAO })} />
          <Opcoes {...p('enviaEcommerce', { label: 'Envia e-commerce', opcoes: SIM_NAO })} />
          <Opcoes {...p('usaWms', { label: 'Usa WMS', opcoes: SIM_NAO })} />
        </div>
      </Bloco>
    </div>
  )
}
