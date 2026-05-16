import { NextRequest } from 'next/server'
import { runStage1, runStage2, generateExcel, ObjectionResult } from '@/lib/pipeline'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const pdfFiles = formData.getAll('pdf') as File[]
  const fileName = (formData.get('fileName') as string | null)?.trim() || 'התנגדויות_מאוגדות'
  const mode = (formData.get('mode') as string | null) || 'merged'

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

      const allObjections: ObjectionResult[] = []
      const summary: Array<{ fileName: string; megish: string; clauses: number; failed?: boolean }> = []

      try {
        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i]
          send({ type: 'log', message: `[${i + 1}/${pdfFiles.length}] ${file.name}` })

          const buffer = Buffer.from(await file.arrayBuffer())
          const pdfBase64 = buffer.toString('base64')

          let result: ObjectionResult
          try {
            send({ type: 'log', message: `  שלב 1: מזהה פרטי מגיש...` })
            const meta = await runStage1(pdfBase64)
            send({ type: 'log', message: `  ✓ ${meta.megish}${meta.ktovet ? ' | ' + meta.ktovet : ''}` })

            send({ type: 'log', message: `  שלב 2: מחלץ סעיפי התנגדות...` })
            const clauses = await runStage2(pdfBase64)
            send({ type: 'log', message: `  ✓ ${clauses.length} סעיפים חולצו` })

            result = { meta, clauses }
            summary.push({ fileName: file.name, megish: meta.megish, clauses: clauses.length })
          } catch (err: any) {
            send({ type: 'log', message: `  ✗ שגיאה: ${err.message}` })
            result = { meta: { megish: file.name, beshem: '', ktovet: '', gush_chelka: '' }, clauses: [] }
            summary.push({ fileName: file.name, megish: file.name, clauses: 0, failed: true })
          }

          allObjections.push(result)
        }

        const totalClauses = summary.reduce((s, r) => s + r.clauses, 0)
        send({ type: 'log', message: `סה"כ: ${pdfFiles.length} קבצים, ${totalClauses} סעיפים` })
        send({ type: 'log', message: `מייצר קובץ Excel...` })

        if (mode === 'separate') {
          const files: Array<{ name: string; data: string }> = []
          for (let i = 0; i < allObjections.length; i++) {
            const obj = allObjections[i]
            const safeName = (obj.meta.megish || `התנגדות ${i + 1}`).replace(/[/\\?%*:|"<>]/g, '_')
            const buf = await generateExcel([obj])
            files.push({ name: `${safeName}.xlsx`, data: buf.toString('base64') })
          }
          send({ type: 'done', mode: 'separate', files, summary })
        } else {
          const buf = await generateExcel(allObjections)
          send({ type: 'done', mode: 'merged', file: buf.toString('base64'), fileName: fileName + '.xlsx', summary })
        }
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
