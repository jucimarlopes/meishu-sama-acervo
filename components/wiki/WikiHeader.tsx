'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function WikiHeader() {
  const [query, setQuery] = useState('')
  const router  = useRouter()
  const supabase = createClient()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) router.push(`/wiki/busca?q=${encodeURIComponent(query.trim())}`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <header className="sticky top-0 z-50 bg-navy border-b-2 border-gold">
      <div className="flex items-center gap-4 px-4 py-2.5">
        {/* Logo */}
        <Link href="/wiki" className="flex items-center gap-2.5 flex-shrink-0 text-white no-underline">
          <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center font-serif text-navy text-lg font-semibold">光</div>
          <div className="hidden sm:block">
            <div className="font-serif text-white text-base leading-tight">Acervo Meishu-Sama</div>
            <div className="text-white/50 text-xs font-sans">Biblioteca Digital</div>
          </div>
        </Link>

        {/* Busca */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl relative">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar no acervo..."
            className="w-full py-1.5 pl-3.5 pr-10 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm font-sans outline-none focus:bg-white/18 focus:border-gold transition-all"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-lg">⌕</button>
        </form>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-sans">
          {[
            ['Início',      '/wiki'],
            ['Livros',      '/wiki/obras?tipo=livro'],
            ['Revistas',    '/wiki/obras?tipo=revista'],
            ['Publicações', '/wiki/obras?tipo=publicacao'],
            ['Áudios',      '/wiki/obras?tipo=audio'],
            ['Vídeos',      '/wiki/obras?tipo=video'],
            ['Imagens',     '/wiki/obras?tipo=imagem'],
          ].map(([label, href]) => (
            <Link key={label} href={href} className="px-3 py-1 text-white/70 hover:text-white border-b-2 border-transparent hover:border-gold transition-all">
              {label}
            </Link>
          ))}
        </nav>

        <button onClick={handleLogout} className="ml-auto text-white/50 hover:text-white text-sm font-sans flex-shrink-0">
          Sair
        </button>
      </div>
    </header>
  )
}
