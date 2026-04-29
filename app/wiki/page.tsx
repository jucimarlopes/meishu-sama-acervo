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

export default async function WikiHome() {
  const supabase = await createClient()

  const { data: obras } = await supabase
    .from('obras')
    .select('id, titulo, tipo, status_ingestao, idioma_original, created_at, colecao_id')
    .eq('status_ingestao', 'concluido')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: stats } = await supabase
    .from('trechos')
    .select('id', { count: 'exact', head: true })

  const totalTrechos = stats?.length ?? 0

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-navy to-navy-light text-white rounded-lg p-8 mb-8 text-center">
        <h1 className="font-serif text-3xl font-normal mb-2">Obras e Ensinamentos de Meishu-Sama</h1>
        <p className="text-white/60 text-sm mb-6">Mokiti Okada (1882–1955) · Fundador da Igreja Messiânica Mundial</p>
        <div className="flex justify-center gap-8 text-center">
          <div>
            <div className="text-2xl font-serif text-gold">{obras?.length ?? 0}</div>
            <div className="text-white/50 text-xs mt-0.5">Obras indexadas</div>
          </div>
          <div>
            <div className="text-2xl font-serif text-gold">{totalTrechos.toLocaleString('pt-BR')}</div>
            <div className="text-white/50 text-xs mt-0.5">Trechos pesquisáveis</div>
          </div>
        </div>
      </div>

      {/* Obras recentes */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-navy text-xl border-b-2 border-gold pb-1.5">Acervo disponível</h2>
        <Link href="/wiki/obras" className="text-sm text-blue-600 hover:underline">Ver todos →</Link>
      </div>

      {!obras || obras.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-serif text-lg">Nenhuma obra indexada ainda.</p>
          <p className="text-sm mt-1">Adicione arquivos na pasta do Google Drive para começar.</p>
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
                {obra.idioma_original === 'ja' && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">JP→PT</span>
                )}
              </div>
              <h3 className="font-serif text-base font-medium text-gray-900 leading-tight">{obra.titulo}</h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
