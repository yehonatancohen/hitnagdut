'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AppState = 'idle' | 'processing' | 'done' | 'error'
type OutputMode = 'merged' | 'separate'

interface SummaryItem {
  fileName: string
  megish: string
  clauses: number
  failed?: boolean
}

interface DownloadFile {
  name: string
  url: string
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function CollapsibleSection({
  title, open, onToggle, children, badge,
}: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode; badge?: string
}) {
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {badge && (
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

export default function Home() {
  const [state, setState] = useState<AppState>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [fileName, setFileName] = useState('')
  const [outputMode, setOutputMode] = useState<OutputMode>('merged')
  const [isDragging, setIsDragging] = useState(false)
  const [filesOpen, setFilesOpen] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [summary, setSummary] = useState<SummaryItem[]>([])
  const [downloadFiles, setDownloadFiles] = useState<DownloadFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsOpen) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, logsOpen])

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter(f => f.name.toLowerCase().endsWith('.pdf') && f.size <= 50 * 1024 * 1024)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...valid.filter(f => !existing.has(f.name))]
    })
  }

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name))

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const handleSSEEvent = useCallback((event: any) => {
    if (event.type === 'log') {
      setLogs(prev => [...prev, event.message as string])
    } else if (event.type === 'done') {
      setSummary(event.summary ?? [])
      if (event.mode === 'merged') {
        const bytes = Uint8Array.from(atob(event.file as string), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        setDownloadFiles([{ name: event.fileName as string, url: URL.createObjectURL(blob) }])
      } else {
        const dfiles = (event.files as Array<{ name: string; data: string }>).map(f => {
          const bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0))
          const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
          return { name: f.name, url: URL.createObjectURL(blob) }
        })
        setDownloadFiles(dfiles)
      }
      setState('done')
    } else if (event.type === 'error') {
      setErrorMsg(event.message as string)
      setState('error')
    }
  }, [])

  const startProcessing = async () => {
    if (!files.length) return
    setState('processing')
    setLogs([])
    setSummary([])
    setDownloadFiles([])
    setLogsOpen(true)
    setErrorMsg('')

    const formData = new FormData()
    files.forEach(f => formData.append('pdf', f))
    formData.append('fileName', fileName.trim() || 'התנגדויות_מאוגדות')
    formData.append('mode', outputMode)

    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData })
      if (!res.body) throw new Error('no body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (line.startsWith('data: ')) {
              try { handleSSEEvent(JSON.parse(line.slice(6))) } catch {}
            }
          }
        }
      }
    } catch {
      setErrorMsg('שגיאת רשת. אנא נסה שוב.')
      setState('error')
    }
  }

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  }

  const reset = () => {
    downloadFiles.forEach(f => URL.revokeObjectURL(f.url))
    setFiles([]); setFileName(''); setDownloadFiles([])
    setErrorMsg(''); setLogs([]); setSummary([])
    setState('idle'); setFilesOpen(true); setOptionsOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalClauses = summary.reduce((s, r) => s + r.clauses, 0)
  const failedCount = summary.filter(r => r.failed).length

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-700 rounded-2xl mb-4 shadow-lg">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">ממיר התנגדויות תכנוניות</h1>
          <p className="text-slate-500 text-lg">העלה קבצי PDF — קבל טבלת Excel מאוגדת</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-4">

          {/* ── IDLE ── */}
          {state === 'idle' && (
            <>
              {/* Drop zone */}
              <div
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                  ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleInputChange} className="hidden" />
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                </div>
                <p className="text-slate-600 font-medium">גרור קבצי PDF לכאן</p>
                <p className="text-slate-400 text-sm mt-1">או לחץ לבחירת קבצים</p>
                <p className="text-xs text-slate-300 mt-1">PDF בלבד • עד 50MB לקובץ • ניתן להעלות מספר קבצים</p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <CollapsibleSection
                  title="קבצים שנבחרו"
                  badge={String(files.length)}
                  open={filesOpen}
                  onToggle={() => setFilesOpen(v => !v)}
                >
                  <div className="divide-y divide-slate-100">
                    {files.map(f => (
                      <div key={f.name} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{f.name}</p>
                          <p className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); removeFile(f.name) }}
                          className="w-6 h-6 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Options */}
              {files.length > 0 && (
                <CollapsibleSection title="הגדרות פלט" open={optionsOpen} onToggle={() => setOptionsOpen(v => !v)}>
                  <div className="px-4 py-4 space-y-4">
                    {/* Output mode toggle */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">סוג הפלט</p>
                      <div className="flex gap-2">
                        {(['merged', 'separate'] as OutputMode[]).map(m => (
                          <button key={m} onClick={() => setOutputMode(m)}
                            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all border
                              ${outputMode === m
                                ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                            {m === 'merged' ? 'קובץ אחד מאוחד' : 'קובץ נפרד לכל PDF'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* File name (merged only) */}
                    {outputMode === 'merged' && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">שם הקובץ</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text" value={fileName} onChange={e => setFileName(e.target.value)}
                            placeholder="התנגדויות_מאוגדות"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                          />
                          <span className="text-slate-400 text-sm flex-shrink-0">.xlsx</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Process button */}
              {files.length > 0 && (
                <button onClick={startProcessing}
                  className="w-full py-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold text-lg rounded-2xl transition-all shadow-md">
                  {files.length === 1 ? 'עבד מסמך' : `עבד ${files.length} מסמכים`}
                  {' '}
                  {outputMode === 'merged' ? '← Excel אחד' : '← קובץ לכל מסמך'}
                </button>
              )}
            </>
          )}

          {/* ── PROCESSING ── */}
          {state === 'processing' && (
            <>
              {/* Spinner + status */}
              <div className="flex items-center gap-4 py-3">
                <div className="relative w-11 h-11 flex-shrink-0">
                  <div className="w-11 h-11 rounded-full border-[3px] border-blue-100" />
                  <div className="w-11 h-11 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin absolute inset-0" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">מעבד מסמכים...</p>
                  <p className="text-slate-400 text-sm">
                    {logs.length > 0 ? logs[logs.length - 1] : 'מתחיל עיבוד...'}
                  </p>
                </div>
              </div>

              {/* Live log */}
              <CollapsibleSection title="לוג עיבוד" open={logsOpen} onToggle={() => setLogsOpen(v => !v)}>
                <div className="bg-slate-50 p-3 max-h-64 overflow-y-auto" dir="ltr">
                  <div className="font-mono text-xs text-slate-600 space-y-0.5">
                    {logs.map((l, i) => (
                      <div key={i} className={l.startsWith('  ✓') ? 'text-green-600' : l.startsWith('  ✗') ? 'text-red-500' : ''}>
                        {l}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </CollapsibleSection>
            </>
          )}

          {/* ── DONE ── */}
          {state === 'done' && (
            <>
              {/* Header */}
              <div className="flex items-center gap-4 py-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800">העיבוד הושלם!</p>
                  <p className="text-slate-500 text-sm">
                    {summary.length} קבצים • {totalClauses} סעיפים
                    {failedCount > 0 && <span className="text-red-500 mr-1"> • {failedCount} נכשלו</span>}
                  </p>
                </div>
              </div>

              {/* Download merged */}
              {outputMode === 'merged' && downloadFiles[0] && (
                <button onClick={() => triggerDownload(downloadFiles[0].url, downloadFiles[0].name)}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-2xl transition-all shadow-md flex items-center justify-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                  </svg>
                  הורד Excel
                  <span className="text-green-200 text-sm font-normal">{downloadFiles[0].name}</span>
                </button>
              )}

              {/* Download all (separate mode) */}
              {outputMode === 'separate' && downloadFiles.length > 0 && (
                <button onClick={() => downloadFiles.forEach(f => triggerDownload(f.url, f.name))}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                  </svg>
                  הורד את כולם ({downloadFiles.length} קבצים)
                </button>
              )}

              {/* Summary table */}
              <CollapsibleSection title="סיכום עיבוד" badge={`${summary.length} קבצים`} open={true} onToggle={() => {}}>
                <div className="divide-y divide-slate-100">
                  {/* Table header */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 text-xs font-medium text-slate-400">
                    <span className="w-5 text-center">#</span>
                    <span className="flex-1">מגיש</span>
                    <span className="w-16 text-center">סעיפים</span>
                    {outputMode === 'separate' && <span className="w-14" />}
                  </div>
                  {summary.map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${item.failed ? 'bg-red-50' : ''}`}>
                      <span className="text-xs text-slate-400 w-5 text-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.megish || item.fileName}</p>
                        {item.failed && <p className="text-xs text-red-400">שגיאה בעיבוד</p>}
                      </div>
                      <span className={`w-16 text-center text-sm font-semibold flex-shrink-0
                        ${item.failed ? 'text-red-400' : item.clauses === 0 ? 'text-slate-300' : 'text-blue-600'}`}>
                        {item.failed ? '—' : item.clauses}
                      </span>
                      {outputMode === 'separate' && (
                        <div className="w-14 flex-shrink-0">
                          {!item.failed && downloadFiles[i] ? (
                            <button
                              onClick={() => triggerDownload(downloadFiles[i].url, downloadFiles[i].name)}
                              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                              </svg>
                              הורד
                            </button>
                          ) : (
                            <span className="text-xs text-red-300 text-center block">—</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Log (collapsible, collapsed by default after done) */}
              <CollapsibleSection title="לוג עיבוד" open={logsOpen} onToggle={() => setLogsOpen(v => !v)}>
                <div className="bg-slate-50 p-3 max-h-48 overflow-y-auto" dir="ltr">
                  <div className="font-mono text-xs text-slate-500 space-y-0.5">
                    {logs.map((l, i) => (
                      <div key={i} className={l.startsWith('  ✓') ? 'text-green-600' : l.startsWith('  ✗') ? 'text-red-500' : ''}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleSection>

              <button onClick={reset}
                className="w-full py-3 border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-medium rounded-2xl transition-all">
                עבד מסמכים נוספים
              </button>
            </>
          )}

          {/* ── ERROR ── */}
          {state === 'error' && (
            <>
              <div className="py-4 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800 mb-2">שגיאה בעיבוד</p>
                  <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm leading-relaxed">{errorMsg}</p>
                </div>
              </div>

              {logs.length > 0 && (
                <CollapsibleSection title="לוג עיבוד" open={logsOpen} onToggle={() => setLogsOpen(v => !v)}>
                  <div className="bg-slate-50 p-3 max-h-48 overflow-y-auto" dir="ltr">
                    <div className="font-mono text-xs text-slate-500 space-y-0.5">
                      {logs.map((l, i) => (
                        <div key={i} className={l.startsWith('  ✓') ? 'text-green-600' : l.startsWith('  ✗') ? 'text-red-500' : ''}>
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              <button onClick={reset}
                className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-lg rounded-2xl transition-all shadow-md">
                נסה שוב
              </button>
            </>
          )}

        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          המסמכים מעובדים באמצעות Gemini AI • הנתונים אינם נשמרים
        </p>
      </div>
    </main>
  )
}
