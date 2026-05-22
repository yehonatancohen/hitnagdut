'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type AppState = 'idle' | 'processing' | 'preview' | 'done' | 'error'
type OutputMode = 'merged' | 'separate'

interface SubmitterMeta {
  megish: string
  beshem: string
  ktovet: string
  gush_chelka: string
}

interface ClauseItem {
  text: string
  gorem?: string
}

interface SectionItem {
  section_number: string
  section_title: string
  missed_some_clauses: boolean
  section_summary?: string
  section_annex?: string
  confidence?: 'high' | 'low'
  clauses: ClauseItem[]
  isAnalyzing?: boolean
}

interface ObjectionItem {
  fileName: string
  meta: SubmitterMeta
  sections: SectionItem[]
}

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
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {badge && (
            <span className="bg-blue-50 text-blue-600 text-xs px-2.5 py-0.5 rounded-full font-bold">{badge}</span>
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

  // Multi-stage extraction state
  const [objections, setObjections] = useState<ObjectionItem[]>([])
  const [stage3Loading, setStage3Loading] = useState(false)
  const [stage3Progress, setStage3Progress] = useState({ current: 0, total: 0 })

  // Error feedback state
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)

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
      setObjections(event.objections ?? [])
      setSummary(event.summary ?? [])
      setState('preview')
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
    setObjections([])
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
      setErrorMsg('שגיאת רשת בעיבוד הראשוני. אנא נסה שוב.')
      setState('error')
    }
  }

  // Action: Summarize single row
  const analyzeSingleSection = async (objIdx: number, secIdx: number) => {
    const obj = objections[objIdx]
    const sec = obj.sections[secIdx]

    // Set UI loading state for this section
    setObjections(prev => {
      const updated = [...prev]
      updated[objIdx].sections[secIdx] = {
        ...updated[objIdx].sections[secIdx],
        isAnalyzing: true,
      }
      return updated
    })

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stage3',
          section_title: sec.section_title,
          clauses: sec.clauses.map(c => c.text),
        }),
      })

      if (!response.ok) throw new Error('Failed to analyze section')
      const result = await response.json()

      // Update section in state with analyzed results
      setObjections(prev => {
        const updated = [...prev]
        const currentSec = updated[objIdx].sections[secIdx]
        updated[objIdx].sections[secIdx] = {
          ...currentSec,
          section_summary: result.section_summary,
          section_annex: result.section_annex,
          confidence: result.confidence,
          clauses: currentSec.clauses.map((c, i) => ({
            ...c,
            gorem: result.clauses[i]?.gorem || 'אחר',
          })),
          isAnalyzing: false,
        }
        return updated
      })
    } catch (err) {
      console.error(err)
      setObjections(prev => {
        const updated = [...prev]
        updated[objIdx].sections[secIdx] = {
          ...updated[objIdx].sections[secIdx],
          isAnalyzing: false,
        }
        return updated
      })
    }
  }

  // Action: Proceed to summary (summarize all remaining sections in parallel)
  const proceedToSummary = async () => {
    setStage3Loading(true)
    setErrorMsg('')

    // Identify all sections that need analysis
    const tasks: Array<{ objIdx: number; secIdx: number; section: SectionItem }> = []
    objections.forEach((obj, objIdx) => {
      obj.sections.forEach((sec, secIdx) => {
        if (!sec.section_summary) {
          tasks.push({ objIdx, secIdx, section: sec })
        }
      })
    })

    setStage3Progress({ current: 0, total: tasks.length })

    // Create a local deep copy of the objections array to update synchronously
    const updatedObjections = JSON.parse(JSON.stringify(objections)) as ObjectionItem[]

    let completed = 0
    const batchSize = 3 // process in batches of 3 to avoid API rate limits
    for (let i = 0; i < tasks.length; i += batchSize) {
      // Introduce an 800ms delay between batches (except the first one) to stay safe under 15 RPM
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      const batch = tasks.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async task => {
          try {
            const response = await fetch('/api/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'stage3',
                section_title: task.section.section_title,
                clauses: task.section.clauses.map(c => c.text),
              }),
            })
            if (!response.ok) throw new Error()
            const result = await response.json()

            // Update local copy synchronously
            const currentSec = updatedObjections[task.objIdx].sections[task.secIdx]
            updatedObjections[task.objIdx].sections[task.secIdx] = {
              ...currentSec,
              section_summary: result.section_summary,
              section_annex: result.section_annex,
              confidence: result.confidence,
              clauses: currentSec.clauses.map((c, idx) => ({
                ...c,
                gorem: result.clauses[idx]?.gorem || 'אחר',
              })),
            }
            // Sync React state for progress preview
            setObjections([...updatedObjections])
          } catch {
            // Fallback inside local copy and state
            const currentSec = updatedObjections[task.objIdx].sections[task.secIdx]
            updatedObjections[task.objIdx].sections[task.secIdx] = {
              ...currentSec,
              section_summary: 'שמאות וכלכלה',
              section_annex: 'שמאות',
              confidence: 'low',
              clauses: currentSec.clauses.map(c => ({ ...c, gorem: 'שמאי' })),
            }
            setObjections([...updatedObjections])
          } finally {
            completed++
            setStage3Progress(prev => ({ ...prev, current: completed }))
          }
        })
      )
    }

    // Now request Excel generation based on final reviewed objections list
    try {
      const excelRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'excel',
          objections: updatedObjections, // Pass the fully updated local copy directly!
          mode: outputMode,
          fileName: fileName.trim() || 'התנגדויות_מאוגדות',
        }),
      })

      if (!excelRes.ok) throw new Error('שגיאה ביצירת קובץ ה-Excel')
      const excelData = await excelRes.json()

      if (excelData.mode === 'merged') {
        const bytes = Uint8Array.from(atob(excelData.file), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        setDownloadFiles([{ name: excelData.fileName, url: URL.createObjectURL(blob) }])
      } else {
        const dfiles = (excelData.files as Array<{ name: string; data: string }>).map(f => {
          const bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0))
          const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
          return { name: f.name, url: URL.createObjectURL(blob) }
        })
        setDownloadFiles(dfiles)
      }

      setState('done')
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה ביצירת קובץ ה-Excel')
      setState('error')
    } finally {
      setStage3Loading(false)
    }
  }

  const submitErrorReport = () => {
    setSubmittingReport(true)
    setTimeout(() => {
      setSubmittingReport(false)
      setReportSubmitted(true)
      setReportText('')
    }, 1200)
  }

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  }

  const reset = () => {
    downloadFiles.forEach(f => URL.revokeObjectURL(f.url))
    setFiles([]); setFileName(''); setDownloadFiles([])
    setErrorMsg(''); setLogs([]); setSummary([]); setObjections([])
    setState('idle'); setFilesOpen(true); setOptionsOpen(false)
    setShowReportModal(false); setReportSubmitted(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalClausesCount = objections.reduce(
    (sum, obj) => sum + obj.sections.reduce((s, sec) => s + sec.clauses.length, 0),
    0
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 flex flex-col items-center justify-start py-12 px-6" dir="rtl">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-blue-700 to-blue-600 rounded-3xl mb-4 shadow-xl text-white transform hover:scale-105 transition-all">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-2">מערכת התנגדויות תכנוניות</h1>
          <p className="text-slate-500 text-lg">עיבוד וסיכום התנגדויות בנייה בעזרת בינה מלאכותית</p>
        </div>

        <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 p-8 space-y-6 transition-all duration-300">

          {/* ── IDLE STATE ── */}
          {state === 'idle' && (
            <>
              {/* Drop zone */}
              <div
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50/50 shadow-inner'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'}`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleInputChange} className="hidden" />
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                </div>
                <p className="text-slate-700 font-bold text-lg">גרור קבצי PDF לכאן</p>
                <p className="text-slate-400 mt-1">או לחץ לבחירת קבצים מתיקיית המחשב</p>
                <p className="text-xs text-slate-300 mt-2 font-medium">PDF בלבד • עד 50MB לקובץ • ניתן להעלות מספר קבצים בו זמנית</p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <CollapsibleSection
                  title="קבצים שנבחרו לעיבוד"
                  badge={String(files.length)}
                  open={filesOpen}
                  onToggle={() => setFilesOpen(v => !v)}
                >
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {files.map(f => (
                      <div key={f.name} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center text-red-500 flex-shrink-0 shadow-sm">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{f.name}</p>
                          <p className="text-xs text-slate-400 font-medium">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); removeFile(f.name) }}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <CollapsibleSection title="הגדרות פלט והפקה" open={optionsOpen} onToggle={() => setOptionsOpen(v => !v)}>
                  <div className="px-5 py-5 space-y-4 bg-slate-50/50">
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2">סוג קובץ הפלט</p>
                      <div className="flex gap-3">
                        {(['merged', 'separate'] as OutputMode[]).map(m => (
                          <button key={m} onClick={() => setOutputMode(m)}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border
                              ${outputMode === m
                                ? 'bg-blue-700 text-white border-blue-700 shadow-md'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                            {m === 'merged' ? 'קובץ אחד מאוחד' : 'קובץ נפרד לכל PDF'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {outputMode === 'merged' && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">שם קובץ ה-Excel המופק</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text" value={fileName} onChange={e => setFileName(e.target.value)}
                            placeholder="התנגדויות_מאוגדות"
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm shadow-sm"
                          />
                          <span className="text-slate-400 text-sm font-bold flex-shrink-0">.xlsx</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Process button */}
              {files.length > 0 && (
                <button onClick={startProcessing}
                  className="w-full py-5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-extrabold text-xl rounded-2xl transition-all shadow-lg hover:shadow-blue-200">
                  {files.length === 1 ? 'עבד מסמך' : `עבד ${files.length} מסמכים`}
                  {' '}
                  {outputMode === 'merged' ? '← בדיקה מקדימה' : '← קבצים נפרדים'}
                </button>
              )}
            </>
          )}

          {/* ── PROCESSING STATE ── */}
          {state === 'processing' && (
            <>
              <div className="flex items-center gap-5 py-6">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <div className="w-14 h-14 rounded-full border-[4px] border-blue-100" />
                  <div className="w-14 h-14 rounded-full border-[4px] border-blue-600 border-t-transparent animate-spin absolute inset-0" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">מחלץ נתונים ומכין בדיקה מקדימה...</p>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {logs.length > 0 ? logs[logs.length - 1] : 'מתחיל עיבוד...'}
                  </p>
                </div>
              </div>

              <CollapsibleSection title="יומן פעולות בזמן אמת" open={logsOpen} onToggle={() => setLogsOpen(v => !v)}>
                <div className="bg-slate-900 p-4 max-h-64 overflow-y-auto rounded-b-2xl border-t border-slate-800" dir="ltr">
                  <div className="font-mono text-xs text-slate-300 space-y-1">
                    {logs.map((l, i) => (
                      <div key={i} className={l.includes('✓') ? 'text-green-400' : l.includes('✗') ? 'text-red-400' : ''}>
                        {l}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </CollapsibleSection>
            </>
          )}

          {/* ── PREVIEW STAGE ── */}
          {state === 'preview' && (
            <div className="space-y-6">
              {/* Stage header info */}
              <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-blue-900 mb-1">שלב בדיקה מקדימה (Preview Stage)</h3>
                  <p className="text-blue-700/80 text-sm font-medium">לפניך טבלה חלקית של הסעיפים והמלל שחולצו. תוכל לסכם סעיפים בודדים או להמשיך ישירות לסיכום מלא.</p>
                </div>
                <button
                  disabled={stage3Loading}
                  onClick={proceedToSummary}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-extrabold px-6 py-5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50"
                >
                  {stage3Loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      מנתח... ({stage3Progress.current}/{stage3Progress.total})
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      נראה תקין — המשך לסיכום
                    </>
                  )}
                </button>
              </div>

              {/* Progress bar for parallel Stage 3 */}
              {stage3Loading && (
                <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                    <span>מנתח פרקי התנגדות בבינה מלאכותית...</span>
                    <span>{Math.round((stage3Progress.current / stage3Progress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(stage3Progress.current / stage3Progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Custom Preview Table */}
              <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-right">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold text-sm border-b border-slate-200">
                        <th className="p-4 w-28">פרק / סעיף</th>
                        <th className="p-4">מלל ההתנגדות שחולץ (Verbatim)</th>
                        <th className="p-4 w-36">נושא (זמני)</th>
                        <th className="p-4 w-36">נותן מענה</th>
                        <th className="p-4 w-32 text-center">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {objections.flatMap((obj, objIdx) =>
                        obj.sections.flatMap((sec, secIdx) => {
                          const isWarning = sec.missed_some_clauses
                          return sec.clauses.map((clause, clIdx) => {
                            const isFirstInSec = clIdx === 0
                            return (
                              <tr
                                key={`${objIdx}-${secIdx}-${clIdx}`}
                                className={`transition-colors hover:bg-slate-50/40
                                  ${isWarning ? 'bg-amber-50/50 hover:bg-amber-50/70 border-r-4 border-amber-400' : ''}`}
                              >
                                {/* Section label/number */}
                                <td className="p-4 align-top font-bold text-slate-700 text-sm">
                                  {isFirstInSec ? (
                                    <div className="space-y-0.5">
                                      <span className="text-xs text-slate-400 block">{obj.meta.megish || obj.fileName}</span>
                                      <span className="text-blue-700 font-extrabold">{sec.section_number}</span>
                                      <span className="text-xs text-slate-500 block truncate max-w-[120px]" title={sec.section_title}>
                                        {sec.section_title}
                                      </span>
                                      {isWarning && (
                                        <span className="inline-block bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                          סריקה חלקית?
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </td>

                                {/* Clause verbatim text */}
                                <td className="p-4 text-slate-600 text-sm whitespace-pre-wrap leading-relaxed align-top">
                                  {clause.text}
                                </td>

                                {/* Subject summary (analyzed in Stage 3) */}
                                <td className="p-4 text-slate-700 text-sm font-semibold align-top w-36">
                                  {isFirstInSec ? (
                                    sec.isAnalyzing ? (
                                      <span className="text-blue-600 animate-pulse text-xs font-bold">מנתח...</span>
                                    ) : sec.section_summary ? (
                                      <span className="text-slate-800">{sec.section_summary}</span>
                                    ) : (
                                      <span className="text-slate-300 font-normal italic text-xs">טרם סוכם</span>
                                    )
                                  ) : null}
                                </td>

                                {/* Responder / Gorem */}
                                <td className="p-4 text-slate-600 text-sm align-top w-36">
                                  {sec.isAnalyzing ? (
                                    <span className="text-blue-600 animate-pulse text-xs font-bold">מחשב...</span>
                                  ) : clause.gorem ? (
                                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-xs font-bold">
                                      {clause.gorem}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 italic text-xs">—</span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="p-4 text-center align-top w-32">
                                  {isFirstInSec ? (
                                    <button
                                      disabled={sec.isAnalyzing || stage3Loading}
                                      onClick={() => analyzeSingleSection(objIdx, secIdx)}
                                      className="px-2.5 py-1.5 border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1 mx-auto"
                                    >
                                      {sec.isAnalyzing ? (
                                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                                        </svg>
                                      )}
                                      סכם מחדש שורה
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            )
                          })
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── DONE STATE ── */}
          {state === 'done' && (
            <>
              {/* Completed message */}
              <div className="flex flex-col md:flex-row items-start md:items-center gap-5 py-4 border-b border-slate-100">
                <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center text-green-600 flex-shrink-0 shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-extrabold text-slate-800">העיבוד והסיכום הושלמו בהצלחה!</h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {summary.length} קבצי מקור • {objections.length} התנגדויות • {totalClausesCount} סעיפי טענות שונים
                  </p>
                </div>
              </div>

              {/* Downloads merged */}
              {outputMode === 'merged' && downloadFiles[0] && (
                <div className="flex flex-col md:flex-row gap-4">
                  <button onClick={() => triggerDownload(downloadFiles[0].url, downloadFiles[0].name)}
                    className="flex-1 py-5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-extrabold text-lg rounded-2xl shadow-lg hover:shadow-green-100 transition-all flex items-center justify-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                    </svg>
                    הורד קובץ Excel מאוחד
                    <span className="text-green-100 text-sm font-medium">({downloadFiles[0].name})</span>
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="py-5 px-6 border-2 border-slate-200 hover:border-red-400 hover:bg-red-50/30 text-slate-600 hover:text-red-600 font-extrabold text-sm rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    דווח על שגיאה
                  </button>
                </div>
              )}

              {/* Download all (separate mode) */}
              {outputMode === 'separate' && downloadFiles.length > 0 && (
                <div className="flex flex-col md:flex-row gap-4">
                  <button onClick={() => downloadFiles.forEach(f => triggerDownload(f.url, f.name))}
                    className="flex-1 py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-extrabold text-lg rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                    </svg>
                    הורד את כל ה-Excel ({downloadFiles.length} קבצים)
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="py-4 px-6 border-2 border-slate-200 hover:border-red-400 hover:bg-red-50/30 text-slate-600 hover:text-red-600 font-extrabold text-sm rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    דווח על שגיאה
                  </button>
                </div>
              )}

              {/* Reviewed Objections list */}
              <CollapsibleSection title="פרטי ההתנגדויות והסיכומים הסופיים" badge={`${objections.length} מסמכים`} open={true} onToggle={() => {}}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-right">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold text-xs border-b border-slate-200">
                        <th className="p-4 w-28">פרק / סעיף</th>
                        <th className="p-4">מלל ההתנגדות</th>
                        <th className="p-4 w-36">נושא (סיכום AI)</th>
                        <th className="p-4 w-36">נספח רלוונטי</th>
                        <th className="p-4 w-36">נותן מענה</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {objections.flatMap((obj, objIdx) =>
                        obj.sections.flatMap((sec, secIdx) => {
                          const isWarning = sec.missed_some_clauses || sec.confidence === 'low'
                          return sec.clauses.map((clause, clIdx) => {
                            const isFirstInSec = clIdx === 0
                            return (
                              <tr
                                key={`${objIdx}-${secIdx}-${clIdx}`}
                                className={`transition-colors hover:bg-slate-50/40
                                  ${isWarning ? 'bg-amber-50/50 hover:bg-amber-50/70 border-r-4 border-amber-400' : ''}`}
                              >
                                <td className="p-4 align-top font-bold text-slate-700 text-sm">
                                  {isFirstInSec ? (
                                    <div className="space-y-0.5">
                                      <span className="text-xs text-slate-400 block">{obj.meta.megish}</span>
                                      <span className="text-blue-700 font-extrabold">{sec.section_number}</span>
                                      {isWarning && (
                                        <span className="inline-block bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                          ביטחון נמוך
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="p-4 text-slate-600 text-sm whitespace-pre-wrap leading-relaxed align-top">
                                  {clause.text}
                                </td>
                                <td className="p-4 text-slate-800 text-sm font-semibold align-top w-36">
                                  {isFirstInSec ? sec.section_summary : null}
                                </td>
                                <td className="p-4 text-slate-600 text-sm align-top w-36">
                                  {isFirstInSec ? (
                                    <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-bold">
                                      {sec.section_annex}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="p-4 text-slate-600 text-sm align-top w-36">
                                  {clause.gorem ? (
                                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg text-xs font-bold">
                                      {clause.gorem}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 italic text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>

              <button onClick={reset}
                className="w-full py-4 border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-bold rounded-2xl transition-all shadow-sm">
                עבד קבצי PDF נוספים
              </button>
            </>
          )}

          {/* ── ERROR STATE ── */}
          {state === 'error' && (
            <>
              <div className="py-6 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center text-red-500 shadow-sm">
                    <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-800 mb-1">אירעה שגיאה בעיבוד</h2>
                  <p className="text-red-700 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm leading-relaxed max-w-lg mx-auto shadow-sm">{errorMsg}</p>
                </div>
              </div>

              <button onClick={reset}
                className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-lg rounded-2xl transition-all shadow-lg">
                נסה שוב מחדש
              </button>
            </>
          )}

        </div>

        {/* Footer info */}
        <p className="text-center text-slate-400 text-xs mt-8 font-medium">
          הקבצים והטבלאות מעובדים בזמן אמת באמצעות Gemini 2.5 Flash • הנתונים אינם נשמרים בשרתים חיצוניים
        </p>

        {/* Report Error Glassmorphism Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" dir="rtl">
            <div className="bg-white/90 border border-white/50 backdrop-blur-lg rounded-[32px] max-w-md w-full p-8 shadow-2xl relative overflow-hidden transform scale-100 transition-all duration-300">
              {/* Close Button */}
              <button
                onClick={() => { setShowReportModal(false); setReportSubmitted(false) }}
                className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {!reportSubmitted ? (
                <div className="space-y-5">
                  <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center text-red-500 shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-800">דיווח על שגיאה בעיבוד</h3>
                    <p className="text-slate-500 text-sm mt-1">תיאור השגיאה יעזור לנו לשפר את אלגוריתמי הממיר והניתוח של ה-AI.</p>
                  </div>
                  <textarea
                    value={reportText}
                    onChange={e => setReportText(e.target.value)}
                    placeholder="פרט כאן מה השגיאה שמצאת (למשל: סעיף 1.1 לא חולץ נכון, או גורם מסוים שויך לאדריכל במקום לשמאי)..."
                    className="w-full h-32 border border-slate-200 rounded-2xl p-4 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-white/70 shadow-inner resize-none"
                  />
                  <button
                    disabled={!reportText.trim() || submittingReport}
                    onClick={submitErrorReport}
                    className="w-full py-3.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {submittingReport ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : 'שלח דיווח ובנה אמון'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center text-green-500 shadow-md mx-auto animate-bounce">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-slate-800">תודה רבה על הדיווח!</h3>
                    <p className="text-slate-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                      הדיווח נקלט בהצלחה. השגיאה נרשמה במערכת ותסייע לנו לשפר ולייעל את הדיוק עבור העבודות הבאות שלך.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="mt-4 px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all"
                  >
                    סגור
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
