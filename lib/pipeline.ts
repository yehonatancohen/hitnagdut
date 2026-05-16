import { spawn } from 'child_process'
import path from 'path'
import { geminiGenerateWithRetry, extractJSON } from './gemini'

export interface ObjectionMeta {
  megish: string
  beshem: string
  ktovet: string
  gush_chelka: string
}

export interface ClauseRow {
  seif: string
  mahut: string
  nose: string
  gorem: string
}

export interface ObjectionResult {
  meta: ObjectionMeta
  clauses: ClauseRow[]
}

// ─── Stage 1: Extract submitter metadata ────────────────────────────────────

const STAGE1_SYSTEM = `אתה מומחה לדיני תכנון ובנייה בישראל. החזר JSON בלבד, ללא markdown.`

const STAGE1_USER = `חלץ מהמסמך את פרטי מגיש ההתנגדות:
- megish: שם מגיש ההתנגדות (שם הרשות/חברה/עורך דין/אדם פרטי)
- beshem: בשם מי הוגשה (אם הוגשה על ידי בעל הנכס עצמו, כתוב "עצמו"; אם הוגשה על ידי נציג, כתוב שם הלקוח)
- ktovet: כתובת הנכס המושפע (אם לא צוינה, כתוב "")
- gush_chelka: מספרי גוש וחלקה כפי שמופיעים במסמך (אם לא צוינו, כתוב "")

החזר JSON בלבד:
{"megish":"...","beshem":"...","ktovet":"...","gush_chelka":"..."}`

export async function runStage1(pdfBase64: string): Promise<ObjectionMeta> {
  const raw = await geminiGenerateWithRetry(STAGE1_USER, STAGE1_SYSTEM, {
    data: pdfBase64,
    mimeType: 'application/pdf',
  })

  try {
    const data = extractJSON(raw) as Record<string, string>
    return {
      megish: data.megish ?? '',
      beshem: data.beshem ?? '',
      ktovet: data.ktovet ?? '',
      gush_chelka: data.gush_chelka ?? '',
    }
  } catch {
    return { megish: '', beshem: '', ktovet: '', gush_chelka: '' }
  }
}

// ─── Stage 2: Extract individual clauses using delimiter format ──────────────
// Delimiter format avoids JSON quoting issues with Hebrew legal text.

const STAGE2_SYSTEM = `אתה מומחה לדיני תכנון ובנייה בישראל. חלץ טקסט מדויק ממסמכי התנגדות.`

const SEIF_START = '<<<SEIF:'
const SEIF_NOSE = '>>>NOSE:'
const SEIF_GOREM = '>>>GOREM:'

const STAGE2_USER = `חלץ את הטענות המהותיות (טענות ההתנגדות) ממסמך ההתנגדות.

חשוב: חלץ רק את פרקי הטענות הממוספרים (פרק ג' או "טענות ההתנגדות" וכד') — לא רקע, לא הקדמות, לא נספחי חוות דעת שמאית, לא מצב תכנוני.

עבור כל סעיף השתמש בפורמט הבא בדיוק:
${SEIF_START}[מספר הסעיף, כגון: 1 / 4.א / 1.2 / ריק אם אין מספור]
[טקסט מלא ומדויק של הסעיף כפי שמופיע במסמך]
${SEIF_NOSE}[נושא: שמאות/בינוי/תנועה/ניקוז ותשתיות/איחוד וחלוקה/פרוגרמה/שלביות/תקנון/סביבה/אחר]
${SEIF_GOREM}[גורם: שמאי/אדריכל/יועץ תנועה/יועץ ביסוס/אגרונום/מהנדס ביצוע/עירייה/אחר]

הוראות:
- חלץ כל טענה/סעיף ממוספר בנפרד (כולל תת-סעיפים כגון 4.א, 4.ב)
- אם אין מספור כלל - חלץ כל הטקסט כבלוק אחד עם seif ריק
- טקסט = מדויק כפי שמופיע במסמך (verbatim)
- אל תוסיף טקסט מחוץ לבלוקים
- אם הסעיף הוא כותרת בלבד ללא תוכן ממשי, כתוב nose=None ו-gorem=None`

function parseClauses(raw: string): ClauseRow[] {
  const clauses: ClauseRow[] = []
  const chunks = raw.split(SEIF_START)

  for (const chunk of chunks.slice(1)) {
    const nlIdx = chunk.indexOf('\n')
    if (nlIdx === -1) continue

    const seif = chunk.slice(0, nlIdx).trim()
    const rest = chunk.slice(nlIdx + 1)

    const noseMatch = rest.match(/^>>>NOSE:(.+)$/m)
    const goremMatch = rest.match(/^>>>GOREM:(.+)$/m)
    const nose = noseMatch?.[1]?.trim() ?? ''
    const gorem = goremMatch?.[1]?.trim() ?? ''

    // Mahut = all lines not starting with >>>
    const mahutLines = rest.split('\n').filter(l => !l.startsWith('>>>'))
    const mahut = mahutLines.join('\n').trim()

    const normalizedSeif = (seif === 'ריק' || seif === 'none' || seif.toLowerCase() === 'ריק') ? '' : seif
    clauses.push({ seif: normalizedSeif, mahut, nose, gorem })
  }

  return clauses
}

export async function runStage2(pdfBase64: string): Promise<ClauseRow[]> {
  const raw = await geminiGenerateWithRetry(STAGE2_USER, STAGE2_SYSTEM, {
    data: pdfBase64,
    mimeType: 'application/pdf',
  })

  const clauses = parseClauses(raw)
  console.log(`[stage2] extracted ${clauses.length} clauses`)
  return clauses
}

// ─── Combined objection processing ─────────────────────────────────────────

export async function processObjection(pdfBase64: string): Promise<ObjectionResult> {
  const [meta, clauses] = await Promise.all([
    runStage1(pdfBase64),
    runStage2(pdfBase64),
  ])
  return { meta, clauses }
}

// ─── Python subprocess (Excel only) ─────────────────────────────────────────

const PYTHON_CANDIDATES = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python']

function runPython(scriptName: string, stdinData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', scriptName)

    function trySpawn(candidates: string[]) {
      const [cmd, ...rest] = candidates
      if (!cmd) {
        reject(new Error('No working Python interpreter found. Tried: ' + PYTHON_CANDIDATES.join(', ')))
        return
      }

      console.log(`[python] trying: ${cmd} ${scriptPath}`)
      const child = spawn(cmd, [scriptPath], {
        env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          console.warn(`[python] ${cmd} not found, trying next`)
          trySpawn(rest)
        } else {
          console.error(`[python] spawn error (${cmd}):`, err.message)
          reject(err)
        }
      })

      child.on('close', (code) => {
        if (stderr) console.error(`[python] stderr:\n${stderr}`)

        if (code !== 0 && !stderr && !stdout && rest.length > 0) {
          console.warn(`[python] ${cmd} produced no output (Store stub?), trying next`)
          trySpawn(rest)
          return
        }

        if (code !== 0) {
          reject(new Error(`Python (${cmd}) failed (code ${code}):\n${stderr || stdout || '(no output)'}`))
        } else {
          resolve(stdout)
        }
      })

      child.stdin.write(stdinData)
      child.stdin.end()
    }

    trySpawn(PYTHON_CANDIDATES)
  })
}

// ─── Excel ───────────────────────────────────────────────────────────────────

export async function generateExcel(objections: ObjectionResult[]): Promise<Buffer> {
  const input = JSON.stringify({ objections })
  const output = await runPython('generate_excel.py', input)
  return Buffer.from(output.trim(), 'base64')
}
