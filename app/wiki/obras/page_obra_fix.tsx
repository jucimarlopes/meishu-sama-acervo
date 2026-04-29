import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ObraPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: obra } = await supabase
    .from('obras')
    .select('*, colecoes(nome, slug)')
    .eq('id', params.id)
    .single()

  if (!obra) notFound()

  const { data: trechos, count } = await supabase
    .from('trechos')
    .select('id, conteudo, pagina, chunk_index', { count: 'exact' })
    .eq('obra_id', params.id)
    .order('chunk_index')
    .limit(50)

  type InfoRow = [string, string]

  const infoRows: InfoRow[] = ([
    ['Tipo',    obra.tipo],
    ['Idioma',  obra.idioma_original === 'ja' ? 'Japonês (traduzido)' : 'Português'],
    obra.volume  ? ['Volume',  String(obra.volume)]  : null,
    obra.ano     ? ['Ano',     String(obra.ano)]     : null,
    obra.paginas ? ['Páginas', String(obra.paginas)] : null,
    obra.editora ? ['Editora', obra.editora]         : null,
    (obra as any).colecoes?.nome ? ['Coleção', (obra as any).colecoes.nome] : null,
  ] as (InfoRow | null)[]).filter((r): r is InfoRow => r !== null && Boolean(r[0]) && Boolean(r[1]))

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-4 flex gap-1.5 items-center">
        <Link href="/wiki" className="hover:text-navy">Início</Link>
        <span>›</span>
        <Link href="/wiki/obras" className="hover:text-navy">Obras</Link>
        <span>›</span>
        <span className="text-gray-700 truncate">{obra.titulo}</span>
      </nav>

      {/* Infobox flutuante */}
      <div className="float-right clear-right ml-5 mb-4 w-64 border border-gray-300 bg-white text-sm">
        <div className="bg-navy text-white font-serif text-sm px-3 py-2 text-center">{obra.titulo}</div>
        <table className="w-full border-collapse">
          <tbody>
            {infoRows.map(([k, v]) => (
              <tr key={k} className="border-b border-gray-100">
                <td className="px-2.5 py-1.5 font-medium text-gray-500 w-2/5">{k}</td>
                <td className="px-2.5 py-1.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {obra.arquivo_url && (
          <div className="p-2.5 border-t border-gray-200">
            <a href={obra.arquivo_url} target="_blank" rel="noopener noreferrer"
              className="block text-center text-xs py-1.5 bg-navy text-white rounded hover:bg-navy-light transition-colors">
              📄 Abrir arquivo original
            </a>
          </div>
        )}
      </div>

      {/* Título e conteúdo */}
      <h1 className="font-serif text-2xl font-normal text-navy mb-1">{obra.titulo}</h1>
      {obra.subtitulo && <p className="text-gray-500 mb-4">{obra.subtitulo}</p>}

      {obra.tags && obra.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {obra.tags.map((tag: string) => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tag}</span>
          ))}
        </div>
      )}

      {/* Trechos */}
      <div className="clear-both">
        <h2 className="font-serif text-xl text-navy border-b border-gray-200 pb-2 mb-4">
          Conteúdo <span className="text-sm font-sans text-gray-400">({count ?? 0} trechos indexados)</span>
        </h2>

        {!trechos || trechos.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum trecho disponível.</p>
        ) : (
          <div className="space-y-0 font-serif text-base leading-relaxed text-gray-800">
            {trechos.map((t, i) => (
              <div key={t.id} className={`py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                {t.pagina && <span className="text-xs text-gray-300 float-right ml-2">p.{t.pagina}</span>}
                <p>{t.conteudo}</p>
              </div>
            ))}
            {count && count > 50 && (
              <p className="text-sm text-gray-400 pt-3 border-t border-gray-100">
                Mostrando 50 de {count} trechos. Use a busca para explorar o conteúdo completo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
