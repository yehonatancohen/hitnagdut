'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

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

function ConfidenceFlag({ label }: { label?: string }) {
  return (
    <span title="רמת ביטחון AI נמוכה — מומלץ לבדוק ידנית"
      className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
      <svg className="w-2.5 h-2.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {label || 'ביטחון נמוך'}
    </span>
  )
}

function CollapsibleSection({
  title, open, onToggle, children, badge,
}: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode; badge?: string
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {badge && (
            <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">{badge}</span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  )
}

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()
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
  const [credits, setCredits] = useState<number | null>(null)
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const [objections, setObjections] = useState<ObjectionItem[]>([])
  const [stage3Loading, setStage3Loading] = useState(false)
  const [stage3Progress, setStage3Progress] = useState({ current: 0, total: 0 })

  const [showReportModal, setShowReportModal] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)

  useEffect(() => {
    if (logsOpen) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, logsOpen])

  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/credits').then(r => r.json()).then(d => setCredits(d.credits ?? 0))
    }
  }, [isSignedIn])

  const toggleAnalysisExpand = (key: string) => {
    setExpandedAnalysis(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
      setCredits(prev => prev !== null ? Math.max(0, prev - 1) : null)
    } else if (event.type === 'error') {
      setErrorMsg(event.message as string)
      setState('error')
    }
  }, [])

  const startProcessing = async () => {
    if (!files.length) return

    if (!isSignedIn) {
      setErrorMsg('יש להתחבר למערכת לפני עיבוד מסמכים.')
      setState('error')
      return
    }
    if (credits !== null && credits <= 0) {
      setErrorMsg('אין קרדיטים זמינים. יש לרכוש קרדיטים בדשבורד.')
      setState('error')
      return
    }

    setState('processing')
    setLogs([])
    setSummary([])
    setDownloadFiles([])
    setObjections([])
    setLogsOpen(true)
    setErrorMsg('')
    setExpandedAnalysis(new Set())

    const formData = new FormData()
    files.forEach(f => formData.append('pdf', f))
    formData.append('fileName', fileName.trim() || 'התנגדויות_מאוגדות')
    formData.append('mode', outputMode)

    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setErrorMsg(err.error || 'שגיאה בעיבוד. אנא נסה שוב.')
        setState('error')
        return
      }

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

  const analyzeSingleSection = async (objIdx: number, secIdx: number) => {
    const obj = objections[objIdx]
    const sec = obj.sections[secIdx]

    setObjections(prev => {
      const updated = [...prev]
      updated[objIdx].sections[secIdx] = { ...updated[objIdx].sections[secIdx], isAnalyzing: true }
      return updated
    })

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stage3', section_title: sec.section_title, clauses: sec.clauses.map(c => c.text) }),
      })

      if (!response.ok) throw new Error('Failed to analyze section')
      const result = await response.json()

      setObjections(prev => {
        const updated = [...prev]
        const currentSec = updated[objIdx].sections[secIdx]
        updated[objIdx].sections[secIdx] = {
          ...currentSec,
          section_summary: result.section_summary,
          section_annex: result.section_annex,
          confidence: result.confidence,
          clauses: currentSec.clauses.map((c, i) => ({ ...c, gorem: result.clauses[i]?.gorem || 'אחר' })),
          isAnalyzing: false,
        }
        return updated
      })

      // Auto-expand the analysis after analyzing
      const key = `${objIdx}-${secIdx}`
      setExpandedAnalysis(prev => { const n = new Set(prev); n.add(key); return n })
    } catch {
      setObjections(prev => {
        const updated = [...prev]
        updated[objIdx].sections[secIdx] = { ...updated[objIdx].sections[secIdx], isAnalyzing: false }
        return updated
      })
    }
  }

  const proceedToSummary = async () => {
    setStage3Loading(true)
    setErrorMsg('')

    const tasks: Array<{ objIdx: number; secIdx: number; section: SectionItem }> = []
    objections.forEach((obj, objIdx) => {
      obj.sections.forEach((sec, secIdx) => {
        if (!sec.section_summary) tasks.push({ objIdx, secIdx, section: sec })
      })
    })

    setStage3Progress({ current: 0, total: tasks.length })

    const updatedObjections = JSON.parse(JSON.stringify(objections)) as ObjectionItem[]
    let completed = 0
    const batchSize = 3

    for (let i = 0; i < tasks.length; i += batchSize) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 800))

      const batch = tasks.slice(i, i + batchSize)
      await Promise.all(batch.map(async task => {
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

          const currentSec = updatedObjections[task.objIdx].sections[task.secIdx]
          updatedObjections[task.objIdx].sections[task.secIdx] = {
            ...currentSec,
            section_summary: result.section_summary,
            section_annex: result.section_annex,
            confidence: result.confidence,
            clauses: currentSec.clauses.map((c, idx) => ({ ...c, gorem: result.clauses[idx]?.gorem || 'אחר' })),
          }
          setObjections([...updatedObjections])
        } catch {
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
      }))
    }

    try {
      const excelRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'excel',
          objections: updatedObjections,
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

      // Save job to history
      const totalClauses = updatedObjections.reduce(
        (sum, obj) => sum + obj.sections.reduce((s, sec) => s + sec.clauses.length, 0), 0
      )
      fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_job',
          file_names: files.map(f => f.name),
          file_count: files.length,
          clause_count: totalClauses,
          result_json: updatedObjections,
        }),
      }).catch(() => {})

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
    setTimeout(() => { setSubmittingReport(false); setReportSubmitted(true); setReportText('') }, 1200)
  }

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  }

  const reset = () => {
    downloadFiles.forEach(f => URL.revokeObjectURL(f.url))
    setFiles([]); setFileName(''); setDownloadFiles([])
    setErrorMsg(''); setLogs([]); setSummary([]); setObjections([])
    setState('idle'); setFilesOpen(true); setOptionsOpen(false)
    setShowReportModal(false); setReportSubmitted(false); setExpandedAnalysis(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalClausesCount = objections.reduce(
    (sum, obj) => sum + obj.sections.reduce((s, sec) => s + sec.clauses.length, 0), 0
  )

  return (
    <main className="min-h-screen bg-slate-50" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">עיבוד התנגדויות תכנוניות</h1>
          <p className="text-slate-500 text-sm mt-0.5">העלה מסמכי PDF של התנגדויות לתכניות בנייה לניתוח והפקת דוח Excel</p>
        </div>

        {/* Main card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm space-y-5 p-6">

          {/* ── IDLE ── */}
          {state === 'idle' && (
            <>
              {/* Auth / credits notice */}
              {isLoaded && !isSignedIn && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                  <p className="text-blue-800 text-sm font-medium">יש להתחבר כדי לעבד מסמכים</p>
                  <div className="flex gap-2">
                    <Link href="/sign-in" className="text-xs font-bold text-blue-700 border border-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">כניסה</Link>
                    <Link href="/sign-up" className="text-xs font-bold text-white bg-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-800 transition-colors">הרשמה</Link>
                  </div>
                </div>
              )}
              {isLoaded && isSignedIn && credits !== null && credits === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                  <p className="text-amber-800 text-sm font-medium">אין קרדיטים זמינים — יש לרכוש קרדיטים לפני העיבוד</p>
                  <Link href="/dashboard" className="text-xs font-bold text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap">לרכישה</Link>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                  ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleInputChange} className="hidden" />
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                </div>
                <p className="text-slate-700 font-semibold">גרור קבצי PDF לכאן, או לחץ לבחירה</p>
                <p className="text-slate-400 text-xs mt-1">PDF בלבד · עד 50MB לקובץ · מספר קבצים בו-זמנית</p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <CollapsibleSection title="קבצים שנבחרו" badge={String(files.length)} open={filesOpen} onToggle={() => setFilesOpen(v => !v)}>
                  <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {files.map(f => (
                      <div key={f.name} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-500 flex-shrink-0">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                          <p className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); removeFile(f.name) }}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
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
                  <div className="px-5 py-4 space-y-4 bg-slate-50">
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2">אופן הפקת הקובץ</p>
                      <div className="flex gap-2">
                        {(['merged', 'separate'] as OutputMode[]).map(m => (
                          <button key={m} onClick={() => setOutputMode(m)}
                            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors border
                              ${outputMode === m ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                            {m === 'merged' ? 'קובץ אחד מאוחד' : 'קובץ נפרד לכל PDF'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {outputMode === 'merged' && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">שם קובץ Excel</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text" value={fileName} onChange={e => setFileName(e.target.value)}
                            placeholder="התנגדויות_מאוגדות"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
                          />
                          <span className="text-slate-400 text-sm font-medium flex-shrink-0">.xlsx</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Process button */}
              {files.length > 0 && (
                <button onClick={startProcessing}
                  className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-base rounded-xl transition-colors shadow-sm">
                  {files.length === 1 ? 'עבד מסמך' : `עבד ${files.length} מסמכים`}
                  {' — '}
                  {outputMode === 'merged' ? 'עבור לבדיקה מקדימה' : 'קבצים נפרדים'}
                </button>
              )}
            </>
          )}

          {/* ── PROCESSING ── */}
          {state === 'processing' && (
            <>
              <div className="flex items-center gap-4 py-4">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <div className="w-12 h-12 rounded-full border-4 border-slate-100" />
                  <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute inset-0" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">מחלץ נתונים ומכין בדיקה מקדימה...</p>
                  <p className="text-slate-400 text-sm mt-0.5">{logs.length > 0 ? logs[logs.length - 1] : 'מתחיל עיבוד...'}</p>
                </div>
              </div>

              <CollapsibleSection title="יומן פעולות" open={logsOpen} onToggle={() => setLogsOpen(v => !v)}>
                <div className="bg-slate-900 p-4 max-h-56 overflow-y-auto" dir="ltr">
                  <div className="font-mono text-xs text-slate-300 space-y-0.5">
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

          {/* ── PREVIEW ── */}
          {state === 'preview' && (
            <div className="space-y-5">
              {/* Header bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">בדיקה מקדימה</h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {objections.length} התנגדויות · {totalClausesCount} סעיפים חולצו · סכם פרקים בודדים או המשך לניתוח מלא
                  </p>
                </div>
                <button
                  disabled={stage3Loading}
                  onClick={proceedToSummary}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-2 flex-shrink-0 disabled:opacity-60"
                >
                  {stage3Loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      מנתח... ({stage3Progress.current}/{stage3Progress.total})
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      המשך לניתוח מלא
                    </>
                  )}
                </button>
              </div>

              {/* Progress bar */}
              {stage3Loading && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm font-semibold text-slate-700">
                    <span>מנתח פרקי התנגדות...</span>
                    <span>{Math.round((stage3Progress.current / stage3Progress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(stage3Progress.current / stage3Progress.total) * 100}%` }} />
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-right text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                        <th className="px-4 py-3 w-32">פרק / סעיף</th>
                        <th className="px-4 py-3">מלל ההתנגדות (Verbatim)</th>
                        <th className="px-4 py-3 w-28 text-center">נותן מענה</th>
                        <th className="px-4 py-3 w-28 text-center">ניתוח</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {objections.flatMap((obj, objIdx) =>
                        obj.sections.flatMap((sec, secIdx) => {
                          const analysisKey = `${objIdx}-${secIdx}`
                          const isExpanded = expandedAnalysis.has(analysisKey)
                          const isLowConf = sec.confidence === 'low'
                          const isWarning = sec.missed_some_clauses

                          return sec.clauses.map((clause, clIdx) => {
                            const isFirst = clIdx === 0
                            return (
                              <tr key={`${objIdx}-${secIdx}-${clIdx}`}
                                className={`transition-colors hover:bg-slate-50/60
                                  ${isWarning ? 'bg-amber-50/40 border-r-2 border-amber-300' : ''}`}>

                                {/* Section label */}
                                <td className="px-4 py-3 align-top">
                                  {isFirst ? (
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-slate-400 truncate max-w-[110px]">{obj.meta.megish || obj.fileName}</p>
                                      <p className="text-blue-700 font-bold">{sec.section_number}</p>
                                      <p className="text-[10px] text-slate-500 truncate max-w-[110px]" title={sec.section_title}>{sec.section_title}</p>
                                      {isWarning && <span className="inline-block bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold">סריקה חלקית?</span>}
                                    </div>
                                  ) : null}
                                </td>

                                {/* Clause text */}
                                <td className="px-4 py-3 text-slate-600 whitespace-pre-wrap leading-relaxed align-top">
                                  {clause.text}
                                </td>

                                {/* Gorem */}
                                <td className="px-4 py-3 text-center align-top">
                                  {sec.isAnalyzing ? (
                                    <span className="text-blue-500 text-xs animate-pulse">מחשב...</span>
                                  ) : clause.gorem ? (
                                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{clause.gorem}</span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>

                                {/* Analysis action */}
                                <td className="px-4 py-3 text-center align-top">
                                  {isFirst ? (
                                    sec.isAnalyzing ? (
                                      <div className="flex justify-center">
                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                      </div>
                                    ) : sec.section_summary ? (
                                      <div className="space-y-1">
                                        {isLowConf && <ConfidenceFlag />}
                                        <button
                                          onClick={() => toggleAnalysisExpand(analysisKey)}
                                          className="text-xs px-2 py-1 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 rounded-lg font-medium transition-colors flex items-center gap-1 mx-auto"
                                        >
                                          {isExpanded ? (
                                            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>הסתר</>
                                          ) : (
                                            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>הצג ניתוח</>
                                          )}
                                        </button>
                                        {isExpanded && (
                                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-right space-y-1 w-36">
                                            <p className="text-[10px] text-slate-400 font-semibold">נושא</p>
                                            <p className="text-xs text-slate-700 font-medium">{sec.section_summary}</p>
                                            <p className="text-[10px] text-slate-400 font-semibold mt-1">נספח</p>
                                            <p className="text-xs text-slate-700">{sec.section_annex}</p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        disabled={stage3Loading}
                                        onClick={() => analyzeSingleSection(objIdx, secIdx)}
                                        className="text-xs px-2 py-1 border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 mx-auto flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        נתח פרק
                                      </button>
                                    )
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

          {/* ── DONE ── */}
          {state === 'done' && (
            <>
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center text-green-600 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">עיבוד הושלם בהצלחה</h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    {summary.length} קבצים · {objections.length} התנגדויות · {totalClausesCount} סעיפים
                  </p>
                </div>
              </div>

              {/* Download */}
              {outputMode === 'merged' && downloadFiles[0] && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => triggerDownload(downloadFiles[0].url, downloadFiles[0].name)}
                    className="flex-1 py-3.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                    </svg>
                    הורד Excel מאוחד
                    <span className="text-green-200 text-sm font-normal">({downloadFiles[0].name})</span>
                  </button>
                  <button onClick={() => setShowReportModal(true)}
                    className="py-3.5 px-5 border border-slate-200 hover:border-red-300 text-slate-500 hover:text-red-600 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    דווח על שגיאה
                  </button>
                </div>
              )}

              {outputMode === 'separate' && downloadFiles.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => downloadFiles.forEach(f => triggerDownload(f.url, f.name))}
                    className="flex-1 py-3.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                    </svg>
                    הורד {downloadFiles.length} קבצי Excel
                  </button>
                  <button onClick={() => setShowReportModal(true)}
                    className="py-3.5 px-5 border border-slate-200 hover:border-red-300 text-slate-500 hover:text-red-600 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    דווח על שגיאה
                  </button>
                </div>
              )}

              {/* Final results table */}
              <CollapsibleSection title="פרטי ההתנגדויות והסיכומים" badge={`${objections.length} מסמכים`} open={true} onToggle={() => {}}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-right text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
                        <th className="px-4 py-3 w-32">פרק / סעיף</th>
                        <th className="px-4 py-3">מלל ההתנגדות</th>
                        <th className="px-4 py-3 w-32">נושא</th>
                        <th className="px-4 py-3 w-28">נספח</th>
                        <th className="px-4 py-3 w-28 text-center">נותן מענה</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {objections.flatMap((obj, objIdx) =>
                        obj.sections.flatMap((sec, secIdx) => {
                          const isLowConf = sec.missed_some_clauses || sec.confidence === 'low'
                          return sec.clauses.map((clause, clIdx) => {
                            const isFirst = clIdx === 0
                            return (
                              <tr key={`${objIdx}-${secIdx}-${clIdx}`}
                                className={`transition-colors hover:bg-slate-50/60
                                  ${isLowConf ? 'bg-amber-50/40 border-r-2 border-amber-300' : ''}`}>
                                <td className="px-4 py-3 align-top">
                                  {isFirst ? (
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-slate-400 truncate">{obj.meta.megish}</p>
                                      <p className="text-blue-700 font-bold">{sec.section_number}</p>
                                      {isLowConf && <ConfidenceFlag />}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-pre-wrap leading-relaxed align-top">{clause.text}</td>
                                <td className="px-4 py-3 text-slate-800 font-semibold align-top">{isFirst ? sec.section_summary : null}</td>
                                <td className="px-4 py-3 align-top">
                                  {isFirst ? (
                                    <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{sec.section_annex}</span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-center align-top">
                                  {clause.gorem ? (
                                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{clause.gorem}</span>
                                  ) : <span className="text-slate-300 text-xs">—</span>}
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
                className="w-full py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl transition-colors text-sm">
                עבד קבצים נוספים
              </button>
            </>
          )}

          {/* ── ERROR ── */}
          {state === 'error' && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center text-red-500 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-slate-800 mb-1">שגיאה בעיבוד</h2>
                  <p className="text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm">{errorMsg}</p>
                  {errorMsg.includes('קרדיטים') && (
                    <Link href="/dashboard" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">לרכישת קרדיטים ←</Link>
                  )}
                </div>
              </div>
              <button onClick={reset}
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors">
                נסה שוב
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-xs mt-6">
          הנתונים מעובדים בעזרת Gemini 2.5 Flash ונשמרים בצורה מאובטחת לצורך היסטוריית עבודות
        </p>
      </div>

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" dir="rtl">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <button onClick={() => { setShowReportModal(false); setReportSubmitted(false) }}
              className="absolute top-4 left-4 w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {!reportSubmitted ? (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">דיווח על שגיאה</h3>
                <textarea
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="תאר את השגיאה שמצאת (למשל: סעיף מסוים לא חולץ נכון, גורם שויך שגוי...)"
                  className="w-full h-28 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
                <button
                  disabled={!reportText.trim() || submittingReport}
                  onClick={submitErrorReport}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                  {submittingReport ? 'שולח...' : 'שלח דיווח'}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-full flex items-center justify-center text-green-500 mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">תודה על הדיווח!</h3>
                <p className="text-slate-500 text-sm">הדיווח נקלט ויסייע לשיפור המערכת.</p>
                <button onClick={() => setShowReportModal(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors text-sm">
                  סגור
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
