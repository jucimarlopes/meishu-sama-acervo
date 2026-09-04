'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type Resultado = {
  trecho_id:   string
  obra_id:     string
  obra_titulo: string
  obra_tipo:   string
  colecao_nome: string | null
  conteudo:    string
  conteudo_hl: string
  pagina:      number | null
  chunk_index: number | null
  score:       number
  match_type:  string
}
const tipos = ['','livro','revista','publicacao','audio','video','imagem']
const tipoLabel: Record<string, string> = {
  '':'Todos','livro':'Livros','revista':'Revistas','publicacao':'Publicações',
  'audio':'Áudios','video':'Vídeos','imagem':'Imagens'
}

function BuscaContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [query,    setQuery]    = useState(searchParams.get('q') || '')
  const [tipo,     setTipo]     = useState('')
  const [results,  setResults]  = useState<Resultado[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); buscar(q, tipo) }
  }, [searchParams])

  async function buscar(q: string, t: string) {
    if (!q.trim()) return
    setLoading(true); setSearched(true)
    try {
      const params = new URLSearchParams({ q, limit: '30' })
      if (t) params.set('tipo', t)
      const res  = await fetch(`/api/busca?${params}`)
      const data = await res.json()
      setResults(data.results || [])
    } finally { setLoading(false) }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/wiki/busca?q=${encodeURIComponent(query.trim())}`)
    buscar(query.trim(), tipo)
  }

  return (
    <div>
      {/* Barra de busca */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar nos ensinamentos..."
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
        <button type="submit" className="px-5 py-2.5 bg-navy text-white rounded-md text-sm font-medium hover:bg-navy-light transition-colors">
          Buscar
        </button>
      </form>

      {/* Filtros de tipo */}
      {searched && (
        <div className="flex flex-wrap gap-2 mb-5">
          {tipos.map(t => (
            <button key={t}
              onClick={() => { setTipo(t); buscar(query, t) }}
              className={`px-3 py-1 rounded-full text-sm border transition-all ${
                tipo === t ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy'
              }`}>
              {tipoLabel[t]}
            </button>
          ))}
        </div>
      )}

      {/* Estado de carregamento */}
      {loading && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">🔍</div>
          <p className="font-serif text-lg">Buscando nos ensinamentos...</p>
        </div>
      )}

      {/* Resultados */}
      {!loading && searched && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {results.length} resultado(s) para <strong>"{query}"</strong>
          </p>
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-serif text-lg">Nenhum resultado encontrado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map(r => {
                const PAGE_SIZE = 100
                const paginaDoTrecho = r.chunk_index != null ? Math.floor(r.chunk_index / PAGE_SIZE) + 1 : 1
                return (
              <a href={`/wiki/obras/${r.obra_id}?q=${encodeURIComponent(query)}&pagina=${paginaDoTrecho}#trecho-${r.chunk_index}`} key={r.trecho_id} className="block bg-white border border-gray-200 rounded-md p-4 hover:border-navy hover:shadow-sm transition-all cursor-pointer">                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">{tipoLabel[r.obra_tipo]}</span>
                    {r.match_type === 'hybrid' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">híbrido</span>}
                    {r.pagina && <span className="text-xs text-gray-400 ml-auto">pág. {r.pagina}</span>}
                  </div>
                  <h3 className="font-serif text-base font-medium text-navy mb-1">{r.obra_titulo}</h3>
                  {r.colecao_nome && <p className="text-xs text-gray-400 mb-2">{r.colecao_nome}</p>}
                  <p
                    className="text-sm text-gray-700 leading-relaxed whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: r.conteudo_hl || r.conteudo.substring(0, 300) + '...' }}
                  />
                </a>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Estado inicial */}
      {!searched && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="font-serif text-xl">Pesquise nos ensinamentos</p>
          <p className="text-sm mt-2">Digite uma palavra ou tema para encontrar trechos relevantes em todo o acervo.</p>
        </div>
      )}
    </div>
  )
}

export default function BuscaPage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-gray-400">Carregando...</div>}>
      <BuscaContent />
    </Suspense>
  )
}
