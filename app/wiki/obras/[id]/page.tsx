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

  const colecaoNome: string | null = (obra as any).colecoes?.nome ?? null

  const infoRows: Array<{ label: string; valor: string }> = [
    { label: 'Tipo',    valor: obra.tipo },
    { label: 'Idioma',  valor: obra.idioma_original === 'ja' ? 'Japonês (traduzido)' : 'Português' },
    ...(obra.volume   ? [{ label: 'Volume',  valor: String(obra.volume) }]  : []),
    ...(obra.ano      ? [{ label: 'Ano',     valor: String(obra.ano) }]     : []),
    ...(obra.paginas  ? [{ label: 'Páginas', valor: String(obra.paginas) }] : []),
    ...(obra.editora  ? [{ label: 'Editora', valor: obra.editora }]         : []),
    ...(colecaoNome   ? [{ label: 'Coleção', valor: colecaoNome }]          : []),
  ]

  return (
    <div className="max-w-4xl">
      <nav className="text-sm text-gray-400 mb-4 flex gap-1.5 items-center">
        <Link href="/wiki" className="hover:text-navy">Início</Link>
        <span>›</span>
        <Link href="/wiki/obras" className="hover:text-navy">Obras</Link>
        <span>›</span>
        <span className="text-gray-700 truncate">{obra.titulo}</span>
      </nav>

      <div className="float-right clear-right ml-5 mb-4 w-64 border border-gray-300 bg-white text-sm">
        <div className="bg-navy text-white font-serif text-sm px-3 py-2 text-center">{obra.titulo}</div>
        <table className="w-full border-collapse">
          <tbody>
            {infoRows.map(({ label, valor }) => (
              <tr key={label} className="border-b border-gray-100">
                <td className="px-2.5 py-1.5 font-medium text-gray-500 w-2/5">{label}</td>
                <td className="px-2.5 py-1.5">{valor}</td>
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

      <h1 className="font-serif text-2xl font-normal text-navy mb-1">{obra.titulo}</h1>
      {obra.subtitulo && <p className="text-gray-500 mb-4">{obra.subtitulo}</p>}

      {obra.tags && obra.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {(obra.tags as string[]).map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tag}</span>
          ))}
        </div>
      )}

      <div className="clear-both">
        <h2 className="font-serif text-xl text-navy border-b border-gray-200 pb-2 mb-4">
          Conteúdo <span className="text-sm font-sans text-gray-400">({count ?? 0} trechos indexados)</span>
        </h2>
        {!trechos || trechos.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum trecho disponível.</p>
        ) : (
          <div className="max-w-3xl mx-auto">
            {trechos.map((t, i) => (
              <div key={t.id} className={`${i > 0 ? 'border-t border-gray-100' : ''}`}>
                {t.pagina && (
                  <span className="text-xs text-gray-300 float-right ml-4 mt-5">p.{t.pagina}</span>
                )}
                <p className="text-base leading-8 text-gray-800 text-justify py-4 px-2 indent-8">
                {t.conteudo}
                </p>
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
