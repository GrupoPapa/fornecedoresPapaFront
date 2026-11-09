import { useState } from 'react'
import { mensagemErro } from '../api/http'
import Modal from './Modal'

/** Le a mensagem de erro de um download (resposta blob vira texto JSON). */
async function erroDeBlob(err, padrao) {
  const dados = err?.response?.data
  if (dados instanceof Blob) {
    try {
      const json = JSON.parse(await dados.text())
      return json.mensagem || padrao
    } catch {
      return padrao
    }
  }
  return mensagemErro(err, padrao)
}

export function salvarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Importacao por planilha: baixar o modelo, escolher o arquivo preenchido e importar.
 * Se a planilha tiver erros, nada e importado e a lista aparece linha a linha.
 */
export default function ImportarPlanilha({ titulo, explicacao, nomeModelo, baixarModelo, importar, aoConcluir, aoFechar }) {
  const [arquivo, setArquivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState('')
  const [errosPlanilha, setErrosPlanilha] = useState([])

  async function modelo() {
    setErro('')
    setBaixando(true)
    try {
      salvarArquivo(await baixarModelo(), nomeModelo)
    } catch (err) {
      setErro(await erroDeBlob(err, 'Não foi possível gerar o modelo.'))
    } finally {
      setBaixando(false)
    }
  }

  async function enviar() {
    if (!arquivo) return
    setErro('')
    setErrosPlanilha([])
    setEnviando(true)
    try {
      aoConcluir(await importar(arquivo))
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível importar a planilha.'))
      setErrosPlanilha(err?.response?.data?.errosPlanilha || [])
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={titulo} largura={760} aoFechar={enviando ? () => {} : aoFechar}
           rodape={(
             <>
               <button type="button" className="btn-secundario" disabled={enviando} onClick={aoFechar}>Fechar</button>
               <button type="button" className="btn-primario" disabled={!arquivo || enviando} onClick={enviar}>
                 {enviando ? 'Importando...' : 'Importar planilha'}
               </button>
             </>
           )}>
      <div className="formulario">
        <ol className="passos-importacao">
          <li>
            <strong>Baixe o modelo</strong> e envie para o fornecedor preencher (ou preencha você mesmo).
            <div>
              <button type="button" className="btn-secundario btn-pequeno" disabled={baixando} onClick={modelo}>
                {baixando ? 'Gerando...' : 'Baixar modelo Excel'}
              </button>
            </div>
          </li>
          <li>
            <strong>Escolha a planilha preenchida</strong> (.xlsx).
            <div>
              <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                     disabled={enviando}
                     onChange={(e) => { setArquivo(e.target.files?.[0] || null); setErro(''); setErrosPlanilha([]) }} />
            </div>
          </li>
          <li><strong>Importe.</strong> {explicacao}</li>
        </ol>

        {erro && <div className="aviso erro">{erro}</div>}
        {errosPlanilha.length > 0 && (
          <div className="tabela-rolagem erros-planilha">
            <table>
              <thead><tr><th className="numero">Linha</th><th>Coluna</th><th>Problema</th></tr></thead>
              <tbody>
                {errosPlanilha.map((e, i) => (
                  <tr key={i}>
                    <td className="numero">{e.linha || '-'}</td>
                    <td>{e.coluna || '-'}</td>
                    <td className="quebra">{e.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
