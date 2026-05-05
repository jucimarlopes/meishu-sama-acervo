'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ─── tipos ────────────────────────────────────────────────────────────────────
interface IngestaoLog {
  id: string;
  obra_id: string | null;
  arquivo_nome: string | null;
  status: string;
  etapa_atual: string;
  progresso_pct: number;
  total_chunks: number;
  chunks_ok: number;
  mensagem: string | null;
}

interface PipelineStep {
  id: string;
  label: string;
  icon: string;
  etapas: string[];
  pct: number;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'upload',    label: 'Upload do arquivo',       icon: '📤', etapas: ['baixando'],   pct: 10 },
  { id: 'url',       label: 'Gerando URL segura',       icon: '🔗', etapas: ['baixando'],   pct: 15 },
  { id: 'firecrawl', label: 'Extraindo conteúdo',       icon: '🔥', etapas: ['firecrawl'],  pct: 30 },
  { id: 'metadados', label: 'Analisando metadados',     icon: '🤖', etapas: ['metadados'],  pct: 45 },
  { id: 'idioma',    label: 'Verificando idioma',       icon: '🌐', etapas: ['traduzindo'], pct: 55 },
  { id: 'chunks',    label: 'Dividindo em trechos',     icon: '✂️', etapas: ['chunks'],     pct: 65 },
  { id: 'embedding', label: 'Gerando embeddings',       icon: '🧮', etapas: [],             pct: 90 },
  { id: 'concluido', label: 'Indexação concluída',      icon: '✅', etapas: ['concluido'],  pct: 100 },
];

const N8N_WEBHOOK = 'https://n8n.56.126.146.159.nip.io/webhook/meishu-upload';

// ─── helpers ──────────────────────────────────────────────────────────────────
function getStepStatus(step: PipelineStep, log: IngestaoLog | null): 'done' | 'active' | 'pending' | 'error' {
  if (!log) return 'pending';
  if (log.status === 'erro' && step.etapas.includes(log.etapa_atual)) return 'error';
  if (log.progresso_pct >= step.pct) return 'done';
  if (step.etapas.includes(log.etapa_atual)) return 'active';
  if (log.progresso_pct > 0 && log.progresso_pct < step.pct) {
    const prevStep = PIPELINE_STEPS[PIPELINE_STEPS.indexOf(step) - 1];
    if (prevStep && log.progresso_pct >= prevStep.pct) return 'active';
  }
  return 'pending';
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function AdminUploadPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin]           = useState<boolean | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const [file, setFile]                 = useState<File | null>(null);
  const [phase, setPhase]               = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [log, setLog]                   = useState<IngestaoLog | null>(null);
  const [errorMsg, setErrorMsg]         = useState('');
  const [colecaoId, setColecaoId]       = useState('');
  const [colecoes, setColecoes]         = useState<{ id: string; nome: string }[]>([]);
  const subscriptionRef                 = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // ── verificar admin ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('admin_users').select('id').eq('user_id', user.id).single();
      if (!data) { router.push('/'); return; }
      setIsAdmin(true);
      const { data: cols } = await supabase.from('colecoes').select('id, nome').order('nome');
      setColecoes(cols || []);
    })();
  }, []);

  // ── drag & drop ──
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.type === 'application/pdf' || f.name.endsWith('.docx'))) {
      setFile(f);
      setErrorMsg('');
    } else {
      setErrorMsg('Apenas arquivos PDF ou DOCX são aceitos.');
    }
  }, []);

  // ── upload e disparo ──
  const startIngestion = async () => {
    if (!file) return;
    setPhase('uploading');
    setErrorMsg('');
    setLog(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');

      // 1. Upload para Supabase Storage
      const ext         = file.name.split('.').pop();
      const uuid        = crypto.randomUUID();
      const storagePath = `acervo-uploads/${uuid}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('acervo-uploads')
        .upload(uuid + '.' + ext, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      // 2. Criar registro de obra (mínimo)
      const obraPayload: Record<string, unknown> = {
        tipo:              'livro',
        titulo:            file.name.replace(/\.[^.]+$/, ''),
        arquivo_gdrive_id: storagePath,
        arquivo_url:       storagePath,
        mime_type:         file.type,
        status_ingestao:   'processando',
        origem:            'upload',
      };
      if (colecaoId) obraPayload.colecao_id = colecaoId;

      const { data: obraData, error: obraError } = await supabase
        .from('obras')
        .insert(obraPayload)
        .select('id')
        .single();
      if (obraError) throw obraError;

      // 3. Criar registro de log
      const { data: logData, error: logError } = await supabase
        .from('ingestao_log')
        .insert({
          obra_id:      obraData.id,
          arquivo_nome: file.name,
          gdrive_file_id: storagePath,
          status:       'processando',
          etapa_atual:  'aguardando',
          progresso_pct: 5,
          origem:       'upload',
        })
        .select()
        .single();
      if (logError) throw logError;

      setLog(logData as IngestaoLog);

      // 4. Subscription realtime
      subscriptionRef.current = supabase
        .channel(`log-${logData.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'ingestao_log',
          filter: `id=eq.${logData.id}`,
        }, (payload) => {
          setLog(payload.new as IngestaoLog);
          if (payload.new.status === 'concluido') setPhase('done');
          if (payload.new.status === 'erro') { setPhase('error'); setErrorMsg(payload.new.mensagem || 'Erro desconhecido.'); }
        })
        .subscribe();

      setPhase('processing');

      // 5. Chamar webhook n8n
      await fetch(N8N_WEBHOOK, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id:       logData.id,
          obra_id:      obraData.id,
          storage_path: storagePath,
          arquivo_nome: file.name,
          mime_type:    file.type,
        }),
      });

    } catch (err: unknown) {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao iniciar processamento.');
    }
  };

  const reset = () => {
    subscriptionRef.current?.unsubscribe();
    setFile(null); setLog(null); setPhase('idle'); setErrorMsg(''); setColecaoId('');
  };

  // ── guards ──
  if (isAdmin === null) return (
    <div style={styles.loadingWrap}>
      <div style={styles.spinner} />
      <p style={{ color: '#1e73be', marginTop: 16 }}>Verificando permissões…</p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Cabeçalho */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={() => router.push('/')} style={styles.backBtn}>← Voltar</button>
          <div>
            <h1 style={styles.title}>Indexar novo documento</h1>
            <p style={styles.subtitle}>Apenas administradores · Acervo de Meishu-Sama</p>
          </div>
          <div style={styles.adminBadge}>🔐 Admin</div>
        </div>
      </header>

      <main style={styles.main}>
        {/* ── FASE IDLE / UPLOADING ── */}
        {(phase === 'idle' || phase === 'uploading') && (
          <div style={styles.card}>

            {/* Drop Zone */}
            <div
              style={{ ...styles.dropZone, ...(dragOver ? styles.dropZoneActive : {}), ...(file ? styles.dropZoneFile : {}) }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setErrorMsg(''); }
                }}
              />
              {file ? (
                <div style={styles.filePreview}>
                  <span style={styles.fileIcon}>{file.name.endsWith('.pdf') ? '📄' : '📝'}</span>
                  <div>
                    <p style={styles.fileName}>{file.name}</p>
                    <p style={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} style={styles.removeBtn}>✕</button>
                </div>
              ) : (
                <div style={styles.dropPlaceholder}>
                  <span style={{ fontSize: 48 }}>📁</span>
                  <p style={styles.dropLabel}>Arraste um arquivo aqui ou <span style={{ color: '#1e73be', textDecoration: 'underline', cursor: 'pointer' }}>clique para selecionar</span></p>
                  <p style={styles.dropHint}>PDF ou DOCX · máx. 50 MB</p>
                </div>
              )}
            </div>

            {/* Seleção de coleção */}
            {file && (
              <div style={styles.selectWrap}>
                <label style={styles.selectLabel}>Coleção (opcional)</label>
                <select
                  value={colecaoId}
                  onChange={(e) => setColecaoId(e.target.value)}
                  style={styles.select}
                >
                  <option value="">— Sem coleção —</option>
                  {colecoes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {errorMsg && <p style={styles.errorMsg}>⚠️ {errorMsg}</p>}

            <button
              onClick={startIngestion}
              disabled={!file || phase === 'uploading'}
              style={{ ...styles.btnPrimary, ...(!file ? styles.btnDisabled : {}) }}
            >
              {phase === 'uploading' ? (
                <><span style={styles.btnSpinner} /> Enviando…</>
              ) : (
                '🚀 Iniciar Indexação'
              )}
            </button>
          </div>
        )}

        {/* ── FASE PROCESSING / DONE / ERROR ── */}
        {(phase === 'processing' || phase === 'done' || phase === 'error') && (
          <div style={styles.card}>

            {/* Arquivo */}
            <div style={styles.fileBar}>
              <span>{file?.name.endsWith('.pdf') ? '📄' : '📝'} <strong>{file?.name}</strong></span>
              <span style={{ color: '#888', fontSize: 13 }}>{file ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
            </div>

            {/* Barra de progresso global */}
            <div style={styles.progressBarWrap}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${log?.progresso_pct ?? 0}%`,
                  background: phase === 'error' ? '#e53e3e' : phase === 'done' ? '#38a169' : '#1e73be',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <div style={styles.progressLabel}>
              <span>{log?.etapa_atual === 'concluido' ? 'Concluído!' : log?.etapa_atual ? `Etapa: ${log.etapa_atual}` : 'Iniciando…'}</span>
              <span style={{ fontWeight: 700, color: '#1e73be' }}>{log?.progresso_pct ?? 0}%</span>
            </div>

            {/* Pipeline visual */}
            <div style={styles.pipeline}>
              {PIPELINE_STEPS.map((step, idx) => {
                const status = getStepStatus(step, log);
                return (
                  <div key={step.id} style={styles.stepRow}>
                    {/* Conector */}
                    {idx > 0 && (
                      <div style={{ ...styles.connector, background: status === 'done' || status === 'active' ? '#1e73be' : '#dde8f5' }} />
                    )}
                    {/* Nó */}
                    <div style={{ ...styles.stepNode, ...styles[`step_${status}` as keyof typeof styles] }}>
                      {status === 'active' ? (
                        <span style={styles.pulseRing}>
                          <span style={styles.pulseCore}>{step.icon}</span>
                        </span>
                      ) : status === 'done' ? '✓' : status === 'error' ? '✕' : step.icon}
                    </div>
                    {/* Label */}
                    <div style={styles.stepLabel}>
                      <span style={{ ...styles.stepName, ...(status === 'active' ? { color: '#1e73be', fontWeight: 700 } : status === 'done' ? { color: '#38a169' } : status === 'error' ? { color: '#e53e3e' } : { color: '#9ab' }) }}>
                        {step.label}
                      </span>
                      {status === 'active' && log?.etapa_atual === 'chunks' && log.total_chunks > 0 && (
                        <span style={styles.chunkBadge}>{log.chunks_ok}/{log.total_chunks} trechos</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resultado final */}
            {phase === 'done' && (
              <div style={styles.resultBox}>
                <p style={{ color: '#276749', fontWeight: 600, fontSize: 15 }}>
                  ✅ {log?.mensagem || 'Documento indexado com sucesso!'}
                </p>
                <div style={styles.resultActions}>
                  {log?.obra_id && (
                    <button onClick={() => router.push(`/obras/${log.obra_id}`)} style={styles.btnSecondary}>
                      📖 Ver obra
                    </button>
                  )}
                  <button onClick={reset} style={styles.btnPrimary}>+ Novo documento</button>
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div style={{ ...styles.resultBox, background: '#fff5f5', border: '1px solid #fed7d7' }}>
                <p style={{ color: '#c53030', fontWeight: 600 }}>❌ {errorMsg}</p>
                <button onClick={reset} style={{ ...styles.btnPrimary, background: '#e53e3e' }}>Tentar novamente</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── estilos ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#e8f6ff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100vh', background: '#e8f6ff',
  },
  spinner: {
    width: 40, height: 40, borderRadius: '50%',
    border: '4px solid #dde8f5', borderTopColor: '#1e73be',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    background: '#1e73be',
    boxShadow: '0 2px 12px rgba(30,115,190,0.3)',
  },
  headerInner: {
    maxWidth: 760, margin: '0 auto', padding: '20px 24px',
    display: 'flex', alignItems: 'center', gap: 16,
  },
  backBtn: {
    background: 'rgba(255,255,255,0.15)', border: 'none',
    color: '#fff', borderRadius: 8, padding: '8px 14px',
    cursor: 'pointer', fontSize: 14, fontFamily: 'system-ui, sans-serif',
    whiteSpace: 'nowrap',
  },
  title: {
    margin: 0, color: '#fff', fontSize: 22, fontWeight: 700,
  },
  subtitle: {
    margin: '4px 0 0', color: 'rgba(255,255,255,0.75)', fontSize: 13,
  },
  adminBadge: {
    marginLeft: 'auto', background: '#f6a623', color: '#fff',
    borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  main: {
    maxWidth: 760, margin: '0 auto', padding: '32px 24px',
  },
  card: {
    background: '#fff', borderRadius: 16,
    boxShadow: '0 4px 24px rgba(30,115,190,0.10)',
    padding: 32, display: 'flex', flexDirection: 'column', gap: 20,
  },
  dropZone: {
    border: '2px dashed #b8d4ef', borderRadius: 12,
    padding: 40, cursor: 'pointer', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 160,
  },
  dropZoneActive: {
    borderColor: '#1e73be', background: '#f0f8ff',
  },
  dropZoneFile: {
    borderColor: '#1e73be', background: '#f7fcff', cursor: 'default',
  },
  dropPlaceholder: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
  },
  dropLabel: {
    margin: 0, fontSize: 15, color: '#445',
  },
  dropHint: {
    margin: 0, fontSize: 13, color: '#9ab',
  },
  filePreview: {
    display: 'flex', alignItems: 'center', gap: 16, width: '100%',
  },
  fileIcon: { fontSize: 36 },
  fileName: { margin: 0, fontWeight: 600, color: '#223', fontSize: 15 },
  fileSize: { margin: '3px 0 0', color: '#9ab', fontSize: 13 },
  removeBtn: {
    marginLeft: 'auto', background: 'none', border: '1px solid #dde', borderRadius: 6,
    padding: '4px 10px', cursor: 'pointer', color: '#779', fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
  },
  selectWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  selectLabel: { fontSize: 13, fontWeight: 600, color: '#556' },
  select: {
    border: '1px solid #dde8f5', borderRadius: 8, padding: '10px 14px',
    fontSize: 14, color: '#334', background: '#fafcff',
    fontFamily: 'system-ui, sans-serif', outline: 'none',
  },
  errorMsg: {
    background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8,
    padding: '12px 16px', color: '#c53030', margin: 0, fontSize: 14,
  },
  btnPrimary: {
    background: '#1e73be', color: '#fff', border: 'none', borderRadius: 10,
    padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'system-ui, sans-serif', transition: 'opacity 0.2s',
  },
  btnSecondary: {
    background: 'transparent', color: '#1e73be', border: '2px solid #1e73be',
    borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  btnSpinner: {
    display: 'inline-block', width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite',
  },
  fileBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: '#f0f8ff', borderRadius: 8,
    fontSize: 14, color: '#334',
  },
  progressBarWrap: {
    height: 10, background: '#dde8f5', borderRadius: 999, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', borderRadius: 999,
  },
  progressLabel: {
    display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#556',
  },
  pipeline: {
    display: 'flex', flexDirection: 'column', gap: 0,
    padding: '8px 0',
  },
  stepRow: {
    display: 'flex', alignItems: 'center', gap: 16, position: 'relative',
  },
  connector: {
    position: 'absolute', left: 20, top: -14,
    width: 2, height: 14, zIndex: 0,
  },
  stepNode: {
    width: 42, height: 42, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, flexShrink: 0, zIndex: 1, position: 'relative',
    transition: 'all 0.3s',
  },
  step_done: {
    background: '#c6f6d5', color: '#276749', border: '2px solid #38a169',
    fontSize: 20, fontWeight: 700,
  },
  step_active: {
    background: '#ebf4ff', border: '2px solid #1e73be',
  },
  step_pending: {
    background: '#f0f5ff', border: '2px solid #dde8f5', fontSize: 20,
  },
  step_error: {
    background: '#fff5f5', border: '2px solid #e53e3e', color: '#e53e3e',
  },
  pulseRing: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  pulseCore: { fontSize: 20 },
  stepLabel: {
    display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0',
  },
  stepName: { fontSize: 14, transition: 'color 0.3s' },
  chunkBadge: {
    fontSize: 12, color: '#f6a623', fontWeight: 600,
    background: '#fffbf0', border: '1px solid #f6a623',
    borderRadius: 20, padding: '2px 10px', display: 'inline-block',
    width: 'fit-content',
  },
  resultBox: {
    background: '#f0fff4', border: '1px solid #c6f6d5',
    borderRadius: 10, padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  resultActions: { display: 'flex', gap: 12, flexWrap: 'wrap' },
};
