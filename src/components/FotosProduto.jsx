import { useCallback, useEffect, useMemo, useState } from 'react'
import { fotosApi } from '../api/servicos'
import { mensagemErro } from '../api/http'

const MAX_FOTOS = 5

/**
 * Galeria de fotos do produto.
 * Enquanto o produto ainda nao foi salvo (sem produtoId), os arquivos ficam numa fila
 * e o formulario envia tudo depois de criar o registro.
 */
export default function FotosProduto({
  produtoId, somenteLeitura, pendentes, aoMudarPendentes, aoErro
}) {
  const [fotos, setFotos] = useState([])
  const [previas, setPrevias] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [ampliada, setAmpliada] = useState(null)

  const carregar = useCallback(async () => {
    if (!produtoId) return
    try {
      const lista = await fotosApi.listar(produtoId)
      setFotos(lista)
      const urls = {}
      for (const foto of lista) {
        const blob = await fotosApi.conteudo(produtoId, foto.id)
        urls[foto.id] = URL.createObjectURL(blob)
      }
      setPrevias((antigas) => {
        Object.values(antigas).forEach((url) => URL.revokeObjectURL(url))
        return urls
      })
    } catch (err) {
      aoErro?.(mensagemErro(err, 'Não foi possível carregar as fotos.'))
    }
  }, [produtoId, aoErro])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => () => {
    Object.values(previas).forEach((url) => URL.revokeObjectURL(url))
  }, [previas])

  const previasPendentes = useMemo(
    () => (pendentes || []).map((arquivo) => URL.createObjectURL(arquivo)),
    [pendentes])

  useEffect(() => () => {
    previasPendentes.forEach((url) => URL.revokeObjectURL(url))
  }, [previasPendentes])

  const total = (fotos?.length || 0) + (pendentes?.length || 0)

  async function selecionar(evento) {
    const arquivos = Array.from(evento.target.files || [])
    evento.target.value = ''
    if (arquivos.length === 0) return

    const espaco = MAX_FOTOS - total
    if (espaco <= 0) {
      aoErro?.(`Limite de ${MAX_FOTOS} fotos por produto.`)
      return
    }
    const selecionados = arquivos.slice(0, espaco)

    if (!produtoId) {
      aoMudarPendentes?.([...(pendentes || []), ...selecionados])
      return
    }

    setEnviando(true)
    try {
      for (const arquivo of selecionados) {
        await fotosApi.anexar(produtoId, arquivo)
      }
      await carregar()
    } catch (err) {
      aoErro?.(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  async function excluir(foto) {
    if (!window.confirm(`Excluir a foto ${foto.nomeArquivo}?`)) return
    try {
      await fotosApi.excluir(produtoId, foto.id)
      await carregar()
    } catch (err) {
      aoErro?.(mensagemErro(err))
    }
  }

  async function tornarPrincipal(foto) {
    try {
      await fotosApi.principal(produtoId, foto.id)
      await carregar()
    } catch (err) {
      aoErro?.(mensagemErro(err))
    }
  }

  return (
    <div className="campo">
      <label>Fotos do produto</label>
      <span className="ajuda">
        Até {MAX_FOTOS} imagens em JPG, PNG ou WEBP (máx. 5 MB cada).
        {!produtoId && ' As fotos são enviadas assim que o produto for salvo.'}
      </span>

      <div className="galeria">
        {fotos.map((foto) => (
          <figure key={foto.id} className={`foto${foto.principal ? ' principal' : ''}`}>
            {previas[foto.id]
              ? <img src={previas[foto.id]} alt={foto.nomeArquivo}
                     onClick={() => setAmpliada(previas[foto.id])} />
              : <div className="foto-vazia">carregando...</div>}
            <figcaption>
              {foto.principal && <span className="marca">Principal</span>}
              {!somenteLeitura && (
                <>
                  {!foto.principal && (
                    <button type="button" className="btn-secundario btn-pequeno"
                            onClick={() => tornarPrincipal(foto)}>Principal</button>
                  )}
                  <button type="button" className="btn-perigo btn-pequeno"
                          onClick={() => excluir(foto)}>Excluir</button>
                </>
              )}
            </figcaption>
          </figure>
        ))}

        {(pendentes || []).map((arquivo, indice) => (
          <figure key={`pendente-${indice}`} className="foto pendente">
            <img src={previasPendentes[indice]} alt={arquivo.name} />
            <figcaption>
              <span className="marca">Aguardando salvar</span>
              <button type="button" className="btn-perigo btn-pequeno"
                      onClick={() => aoMudarPendentes?.(pendentes.filter((_, i) => i !== indice))}>
                Remover
              </button>
            </figcaption>
          </figure>
        ))}

        {!somenteLeitura && total < MAX_FOTOS && (
          <label className="foto adicionar">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple
                   style={{ display: 'none' }} onChange={selecionar} disabled={enviando} />
            <span>{enviando ? 'Enviando...' : '+ Adicionar foto'}</span>
          </label>
        )}
      </div>

      {ampliada && (
        <div className="fundo-modal" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}
