import { NextRequest } from 'next/server'
import { runStage1, runStage2, runStage3ForSection, generateExcel } from '@/lib/pipeline'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  // Handle JSON Actions (Stage 3 and Excel generation)
  if (req.headers.get('content-type')?.includes('application/json')) {
    const body = await req.json()
    const { action } = body

    if (action === 'stage3') {
      const { section_title, clauses } = body
      try {
        const result = await runStage3ForSection(section_title, clauses)
        return Response.json(result)
      } catch (err: any) {
        return Response.json({ error: err.message || 'Stage 3 failed' }, { status: 500 })
      }
    }

    if (action === 'excel') {
      const { objections, mode, fileName } = body
      try {
        if (mode === 'separate') {
          const files: Array<{ name: string; data: string }> = []
          for (let i = 0; i < objections.length; i++) {
            const obj = objections[i]
            const safeName = (obj.meta.megish || `התנגדות ${i + 1}`).replace(/[/\\?%*:|"<>]/g, '_')
            const buf = await generateExcel([obj])
            files.push({ name: `${safeName}.xlsx`, data: buf.toString('base64') })
          }
          return Response.json({ mode: 'separate', files })
        } else {
          const buf = await generateExcel(objections)
          const base64 = buf.toString('base64')
          return Response.json({ mode: 'merged', file: base64, fileName: (fileName || 'התנגדויות_מאוגדות') + '.xlsx' })
        }
      } catch (err: any) {
        return Response.json({ error: err.message || 'Excel generation failed' }, { status: 500 })
      }
    }
  }

  // Handle Form Data SSE Action (Stage 1 & 2 extraction)
  const formData = await req.formData()
  const pdfFiles = formData.getAll('pdf') as File[]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }

      if (!pdfFiles.length) {
        send({ type: 'error', message: 'לא התקבלו קבצי PDF.' })
        controller.close()
        return
      }

      const allObjections: any[] = []
      const summary: Array<{ fileName: string; megish: string; clauses: number; failed?: boolean }> = []

      try {
        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i]
          send({ type: 'log', message: `[${i + 1}/${pdfFiles.length}] ${file.name}` })

          const buffer = Buffer.from(await file.arrayBuffer())
          const pdfBase64 = buffer.toString('base64')

          try {
            send({ type: 'log', message: `  שלב 1: מזהה פרטי מגיש...` })
            const meta = await runStage1(pdfBase64)
            send({ type: 'log', message: `  ✓ ${meta.megish}${meta.ktovet ? ' | ' + meta.ktovet : ''}` })

            send({ type: 'log', message: `  שלב 2: מחלץ סעיפי התנגדות...` })
            const sections = await runStage2(pdfBase64)
            const clausesCount = sections.reduce((s, sec) => s + sec.clauses.length, 0)
            send({ type: 'log', message: `  ✓ ${sections.length} פרקים (${clausesCount} סעיפים) חולצו` })

            allObjections.push({ meta, sections })
            summary.push({ fileName: file.name, megish: meta.megish, clauses: clausesCount })
          } catch (err: any) {
            send({ type: 'log', message: `  ✗ שגיאה: ${err.message}` })
            allObjections.push({
              meta: { megish: file.name, beshem: '', ktovet: '', gush_chelka: '' },
              sections: [],
            })
            summary.push({ fileName: file.name, megish: file.name, clauses: 0, failed: true })
          }
        }

        const totalClauses = summary.reduce((s, r) => s + r.clauses, 0)
        send({ type: 'log', message: `סה"כ: ${pdfFiles.length} קבצים, ${totalClauses} סעיפים` })
        send({ type: 'log', message: `עיבוד בסיסי הושלם. עובר לשלב בדיקה מקדימה...` })
        send({ type: 'done', objections: allObjections, summary })
      } catch (err: any) {
        send({ type: 'error', message: err.message || 'שגיאה פנימית' })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
