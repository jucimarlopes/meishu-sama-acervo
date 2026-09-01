import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query     = searchParams.get('q') || ''
  const tipo      = searchParams.get('tipo') || null
  const limit     = parseInt(searchParams.get('limit') || '20')

  if (!query.trim()) return NextResponse.json({ results: [] })

  try {
    // 1. Gerar embedding da query via Gemini (opcional — se falhar, cai pra busca só por texto)
    let embedding: number[] | null = null
    try {
      const embedResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text: query }] },
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: 1536
          })
        }
      )
      const embedData = await embedResp.json()
      embedding = embedData.embedding?.values ?? null
      if (!embedding) {
        console.error('[busca] Gemini não retornou embedding:', JSON.stringify(embedData).slice(0, 300))
      }
    } catch (embedErr) {
      console.error('[busca] Falha ao gerar embedding, caindo para busca só por texto:', embedErr)
    }

    // 2. Busca híbrida no Supabase — sem embedding, roda só a parte de texto (semantic_weight: 0)
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('busca_hibrida', {
      query_text:       query,
      query_embedding:  embedding ?? new Array(1536).fill(0),
      match_count:      limit,
      full_text_weight: 1.0,
      semantic_weight:  embedding ? 1.0 : 0.0,
      rrf_k:            50,
      filtro_tipo:      tipo
    })

    if (error) throw error

    return NextResponse.json({ results: data || [], busca_semantica: !!embedding })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg, results: [] }, { status: 500 })
  }
}
