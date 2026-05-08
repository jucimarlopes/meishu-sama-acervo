'use client'

import { useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Status = 'idle' | 'uploading' | 'processando' | 'concluido' | 'erro'

interface Progresso {
  etapa_atual: string
  progresso_pct: number
  status: string
  mensagem?: string
}

const ETAPAS: Record<string, string> = {
  upload: 'Enviando arquivo...',
  baixando: 'Obtendo arquivo do storage...',
  firecrawl: 'Extraindo texto (Firecrawl)...',
  metadados: 'Identificando metadados (Gemini)...',
  traduzindo: 'Traduzindo japonês → PT-BR...',
  chunks: 'Dividindo em trechos...',
  embeddings: 'Gerando embeddings...',
  concluido: 'Concluído!',
}

export default function UploadPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  function pararPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  function iniciarPolling(log_id: string) {
    setStatus('processando')
    intervalRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('ingestao_log')
        .select('etapa_atual, progresso_pct, status, mensagem')
        .eq('id', log_id)
        .single()

      if (data) {
        setProgresso(data)
        if (data.status === 'concluido') {
          pararPolling()
          setStatus('concluido')
        }
        if (data.status === 'erro') {
          pararPolling()
          setStatus('erro')
          setErro(data.mensagem || 'Erro no processamento')
        }
      }
    }, 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setStatus('uploading')
    setErro('')
    setProgresso({ etapa_atual: 'upload', progresso_pct: 5, status: 'processando' })

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setStatus('erro')
      setErro(data.error || 'Erro ao enviar arquivo')
      return
    }

    iniciarPolling(data.log_id)
  }

  const pct = progresso?.progresso_pct ?? 0
  const etapaLabel = progresso ? (ETAPAS[progresso.etapa_atual] ?? progresso.etapa_atual) : ''

  return (
    <div className="min-h-screen bg-[#e8f6ff] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-[#1e73be] mb-2">Enviar Documento</h1>
        <p className="text-sm text-gray-500 mb-6">
          PDF ou DOCX — processamento automático via n8n + Gemini
        </p>

        {status === 'idle' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className="border-2 border-dashed border-[#1e73be] rounded-xl p-8 text-center cursor-pointer hover:bg-[#e8f6ff] transition"
              onClick={() => fileRef.current?.click()}
            >
              <p className="text-gray-500 text-sm">Clique para selecionar um arquivo</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={() => setStatus('idle')}
              />
            </div>
            {fileRef.current?.files?.[0] && (
              <p className="text-sm text-gray-600">📄 {fileRef.current.files[0].name}</p>
            )}
            <button
              type="submit"
              className="w-full bg-[#1e73be] text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              Enviar e Processar
            </button>
          </form>
        )}

        {(status === 'uploading' || status === 'processando') && (
          <div className="space-y-4">
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-4 bg-[#1e73be] rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>{etapaLabel}</span>
              <span className="font-semibold text-[#1e73be]">{pct}%</span>
            </div>
          </div>
        )}

        {status === 'concluido' && (
          <div className="text-center space-y-4">
            <div className="text-5xl">✅</div>
            <p className="text-green-600 font-semibold">{progresso?.mensagem || 'Documento indexado com sucesso!'}</p>
            <div className="flex gap-3">
              <a
                href="/wiki"
                className="flex-1 bg-[#1e73be] text-white py-2 rounded-xl text-center text-sm font-medium hover:bg-blue-700 transition"
              >
                Ver na Wiki
              </a>
              <button
                onClick={() => { setStatus('idle'); setProgresso(null); if (fileRef.current) fileRef.current.value = '' }}
                className="flex-1 border border-[#1e73be] text-[#1e73be] py-2 rounded-xl text-sm font-medium hover:bg-[#e8f6ff] transition"
              >
                Enviar outro
              </button>
            </div>
          </div>
        )}

        {status === 'erro' && (
          <div className="text-center space-y-4">
            <div className="text-5xl">❌</div>
            <p className="text-red-600 text-sm">{erro}</p>
            <button
              onClick={() => { setStatus('idle'); setErro('') }}
              className="w-full border border-red-400 text-red-600 py-2 rounded-xl text-sm hover:bg-red-50 transition"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
