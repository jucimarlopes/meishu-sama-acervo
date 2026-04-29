import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const tipoLabel: Record<string, string> = {
  livro: 'Livro', revista: 'Revista', publicacao: 'Publicação',
  audio: 'Áudio', video: 'Vídeo',    imagem: 'Imagem'
}
const tipoCor: Record<string, string> = {
  livro: 'bg-blue-100 text-blue-800', revista: 'bg-purple-100 text-purple-800',
  publicacao: 'bg-green-100 text-green-800', audio: 'bg-orange-100 text-orange-800',
  video: 'bg-pink-100 text-pink-800', imagem: 'bg-cyan-100 text-cyan-800'
}

export default async function ObrasPage({
  searchParams
}: {
  searchParams: { tipo?: string; colecao?: string }
}) {
  const supabase = await createClient()

  let query = supabase
    .from('obras')
    .select('id, titulo, tipo, idioma_original, volume, ano, colecao_id')
    .eq('status_ingestao', 'concluido')
    .order('titulo')

  if (searchParams.tipo)    query = query.eq('tipo', searchParams.tipo)

  const { data: obras } = await query

  const titulo = searchParams.tipo
    ? `${tipoLabel[searchParams.tipo] ?? searchParams.tipo}s`
    : 'Todo o Acervo'

  return (
    <div>
      <h1 className="font-serif text-navy text-2xl border-b-2 border-gold pb-2 mb-6">{titulo}</h1>

      {!obras || obras.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-serif text-lg">Nenhuma obra encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {obras.map(obra => (
            <Link key={obra.id} href={`/wiki/obras/${obra.id}`}
              className="bg-white border border-gray-200 rounded-md p-4 hover:border-navy hover:shadow-sm transition-all block">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${tipoCor[obra.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                  {tipoLabel[obra.tipo] ?? obra.tipo}
                </span>
                <div className="flex gap-1">
                  {obra.volume && <span className="text-xs text-gray-400">Vol. {obra.volume}</span>}
                  {obra.idioma_original === 'ja' && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 rounded">JP→PT</span>
                  )}
                </div>
              </div>
              <h3 className="font-serif text-base font-medium text-gray-900 leading-tight">{obra.titulo}</h3>
              {obra.ano && <p className="text-xs text-gray-400 mt-1">{obra.ano}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
