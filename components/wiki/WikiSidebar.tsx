import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const tipos = [
  { label: 'Todo o acervo', tipo: '',          icon: '◉' },
  { label: 'Livros',        tipo: 'livro',     icon: '📖' },
  { label: 'Revistas',      tipo: 'revista',   icon: '📰' },
  { label: 'Publicações',   tipo: 'publicacao',icon: '📄' },
  { label: 'Áudios',        tipo: 'audio',     icon: '🎧' },
  { label: 'Vídeos',        tipo: 'video',     icon: '🎬' },
  { label: 'Imagens',       tipo: 'imagem',    icon: '🖼' },
]

export default async function WikiSidebar() {
  const supabase  = await createClient()
  const { data: colecoes } = await supabase
    .from('colecoes')
    .select('id, nome, slug, icone')
    .order('nome')

  return (
    <aside className="hidden lg:block w-56 flex-shrink-0 bg-white border-r border-gray-200 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
      {/* Tipos */}
      <div className="border-b border-gray-100">
        <div className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-cream">Tipo</div>
        {tipos.map(t => (
          <Link
            key={t.tipo}
            href={t.tipo ? `/wiki/obras?tipo=${t.tipo}` : '/wiki'}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-cream border-l-2 border-transparent hover:border-gold transition-all"
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
      {/* Por período */}
      <div className="border-b border-gray-100">
        <div className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-cream">Por período</div>
          {[
              ['1920–1935', '1920-1935'],
              ['1935–1947', '1935-1947'],
              ['1947–1955', '1947-1955'],
              ['Pós 1955',  'pos-1955'],
            ].map(([label, value]) => (
          <Link key={value} href={`/wiki/obras?periodo=${encodeURIComponent(value)}`}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-cream border-l-2 border-transparent hover:border-gold transition-all">
          <span>📅</span>{label}
          </Link>
          ))}
      </div>

{/* Por idioma */}
<div className="border-b border-gray-100">
  <div className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-cream">Por idioma</div>
  {[
    ['🇧🇷 Português', 'pt-BR'],
    ['🇯🇵 Japonês (traduzido)', 'ja'],
  ].map(([label, value]) => (
    <Link key={value} href={`/wiki/obras?idioma=${encodeURIComponent(value)}`}
      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-cream border-l-2 border-transparent hover:border-gold transition-all">
      {label}
    </Link>
  ))}
</div>

      {/* Coleções */}
      {colecoes && colecoes.length > 0 && (
        <div>
          <div className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-cream">Coleções</div>
          {colecoes.map(c => (
            <Link
              key={c.id}
              href={`/wiki/obras?colecao=${c.slug}`}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-cream border-l-2 border-transparent hover:border-gold transition-all"
            >
              <span>{c.icone}</span>
              <span className="truncate">{c.nome}</span>
            </Link>
          ))}
        </div>
      )}
    </aside>
  )
}
