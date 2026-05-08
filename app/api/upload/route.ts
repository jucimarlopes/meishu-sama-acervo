import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEBHOOK_URL = 'https://n8n.56.126.146.159.nip.io/webhook/meishu-upload'
const BUCKET = 'documentos'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const colecao_id = formData.get('colecao_id') as string | null

    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })

    const ext = file.name.split('.').pop()
    const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storage_path = `${BUCKET}/${Date.now()}_${nomeSeguro}`

    // 1. Criar registro na tabela obras
    const { data: obra, error: obraErr } = await supabase
      .from('obras')
      .insert({
        titulo: file.name.replace(/\.[^.]+$/, ''),
        arquivo_nome: file.name,
        mime_type: file.type,
        status_ingestao: 'aguardando',
        colecao_id: colecao_id || null,
      })
      .select('id')
      .single()

    if (obraErr) return NextResponse.json({ error: obraErr.message }, { status: 500 })

    // 2. Criar registro no ingestao_log
    const { data: log, error: logErr } = await supabase
      .from('ingestao_log')
      .insert({
        obra_id: obra.id,
        arquivo_nome: file.name,
        status: 'aguardando',
        etapa_atual: 'upload',
        progresso_pct: 0,
      })
      .select('id')
      .single()

    if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 })

    // 3. Upload para Supabase Storage
    const bytes = await file.arrayBuffer()
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(`${Date.now()}_${nomeSeguro}`, bytes, { contentType: file.type })

    if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 })

    // 4. Chamar webhook do n8n
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        log_id: log.id,
        obra_id: obra.id,
        storage_path: storage_path,
        arquivo_nome: file.name,
        mime_type: file.type,
      }),
    })

    return NextResponse.json({ log_id: log.id, obra_id: obra.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
