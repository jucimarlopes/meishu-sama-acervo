import WikiHeader from '@/components/wiki/WikiHeader'
import WikiSidebar from '@/components/wiki/WikiSidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen flex flex-col">
      <WikiHeader />
      <div className="flex flex-1">
        <WikiSidebar />
        <main className="flex-1 min-w-0 p-5 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
