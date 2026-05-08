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

const FASES = [
  { key: 'upload',    icon: '☁️',  label: 'Upload do arquivo' },
  { key: 'baixando',  icon: '🔗',  label: 'Gerando URL segura' },
  { key: 'firecrawl', icon: '🔥',  label: 'Extraindo conteúdo' },
  { key: 'metadados', icon: '🤖',  label: 'Analisando metadados' },
  { key: 'traduzindo',icon: '🌐',  label: 'Verificando idioma' },
  { key: 'chunks',    icon: '✂️',  label: 'Dividindo em trechos' },
  { key: 'embeddings',icon: '🧮',  label: 'Gerando embeddings' },
  { key: 'concluido', icon: '✅',  label: 'Indexação concluída' },
]

const ORDEM = FASES.map(f => f.key)

function faseIndex(key: string) {
  const i = ORDEM.indexOf(key)
  return i === -1 ? 0 : i
}

export default function UploadPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(Date.now())

  function pararPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearInterval(timeoutRef.current)
  }

  function iniciarPolling(log_id: string) {
    setStatus('processando')
    lastUpdateRef.current = Date.now()

    // Watchdog: se não houver atualização em 90s, mostra erro
    timeoutRef.current = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 90_000) {
        pararPolling()
        setStatus('erro')
        setErro('O processamento não respondeu em 90 segundos. Verifique o n8n e tente novamente.')
      }
    }, 5000)

    intervalRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('ingestao_log')
        .select('etapa_atual, progresso_pct, status, mensagem')
        .eq('id', log_id)
        .single()

      if (data) {
        lastUpdateRef.current = Date.now()
        setProgresso(data)
        if (data.status === 'concluido') { pararPolling(); setStatus('concluido') }
        if (data.status === 'erro') {
          pararPolling()
          setStatus('erro')
          setErro(data.mensagem || 'Erro no processamento. Verifique o n8n.')
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

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setStatus('erro')
        setErro(data.error || 'Erro ao enviar arquivo')
        return
      }
      iniciarPolling(data.log_id)
    } catch (err: any) {
      setStatus('erro')
      setErro(err.message || 'Erro de conexão ao enviar arquivo')
    }
  }

  function resetar() {
    pararPolling()
    setStatus('idle')
    setProgresso(null)
    setErro('')
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const pct = progresso?.progresso_pct ?? 0
  const etapaAtual = progresso?.etapa_atual ?? 'upload'
  const etapaIdx = faseIndex(etapaAtual)

  return (
    <div className="min-h-screen bg-[#e8f6ff] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8">
        <h1 className="text-2xl font-bold text-[#1e73be] mb-1">Indexar novo documento</h1>
        <p className="text-sm text-gray-500 mb-6">PDF ou DOCX — processamento automático via n8n + Gemini</p>

        {/* IDLE: formulário de seleção */}
        {status === 'idle' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className="border-2 border-dashed border-[#1e73be] rounded-xl p-8 text-center cursor-pointer hover:bg-[#e8f6ff] transition"
              onClick={() => fileRef.current?.click()}
            >
              {fileName
                ? <p className="text-[#1e73be] font-medium text-sm">📄 {fileName}</p>
                : <><p className="text-gray-500 text-sm">Clique para selecionar um arquivo</p><p className="text-xs text-gray-400 mt-1">PDF, DOCX</p></>
              }
              <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
                onChange={e => setFileName(e.target.files?.[0]?.name || '')} />
            </div>
            <button type="submit" disabled={!fileName}
              className="w-full bg-[#1e73be] text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
              Enviar e Processar
            </button>
          </form>
        )}

        {/* PROCESSANDO: barra + fases */}
        {(status === 'uploading' || status === 'processando') && (
          <div className="space-y-5">
            {/* Nome do arquivo */}
            {fileName && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                <span>📄</span><span className="truncate">{fileName}</span>
              </div>
            )}

            {/* Barra de progresso */}
            <div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 bg-[#1e73be] rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>Iniciando...</span>
                <span className="font-semibold text-[#1e73be]">{pct}%</span>
              </div>
            </div>

            {/* Lista de fases */}
            <div className="space-y-2">
              {FASES.map((fase, i) => {
                const isDone = i < etapaIdx
                const isActive = i === etapaIdx
                const isPending = i > etapaIdx
                return (
                  <div key={fase.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    isActive ? 'bg-[#e8f6ff] border border-[#1e73be]/30' :
                    isDone   ? 'opacity-50' : 'opacity-30'
                  }`}>
                    <span className="text-lg w-7 text-center">
                      {isDone ? '✅' : fase.icon}
                    </span>
                    <span className={`text-sm ${isActive ? 'text-[#1e73be] font-semibold' : 'text-gray-500'}`}>
                      {fase.label}
                    </span>
                    {isActive && (
                      <span className="ml-auto">
                        <span className="inline-block w-3 h-3 rounded-full bg-[#1e73be] animate-pulse" />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CONCLUÍDO */}
        {status === 'concluido' && (
          <div className="text-center space-y-4">
            <div className="text-5xl">✅</div>
            <p className="text-green-600 font-semibold">
              {progresso?.mensagem || 'Documento indexado com sucesso!'}
            </p>
            <div className="flex gap-3">
              <a href="/wiki"
                className="flex-1 bg-[#1e73be] text-white py-2 rounded-xl text-center text-sm font-medium hover:bg-blue-700 transition">
                Ver na Wiki
              </a>
              <button onClick={resetar}
                className="flex-1 border border-[#1e73be] text-[#1e73be] py-2 rounded-xl text-sm font-medium hover:bg-[#e8f6ff] transition">
                Enviar outro
              </button>
            </div>
          </div>
        )}

        {/* ERRO */}
        {status === 'erro' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <span className="text-xl">❌</span>
              <div>
                <p className="text-red-700 font-semibold text-sm">Erro ao processar documento</p>
                <p className="text-red-600 text-xs mt-1">{erro}</p>
              </div>
            </div>
            <button onClick={resetar}
              className="w-full border border-red-400 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition">
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
