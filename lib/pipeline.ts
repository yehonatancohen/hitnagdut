import { spawn } from 'child_process'
import path from 'path'
import { geminiGenerateWithRetry, extractJSON } from './gemini'

// ─── Data Structures ─────────────────────────────────────────────────────────

export interface ObjectionMeta {
  megish: string
  beshem: string
  ktovet: string
  gush_chelka: string
}

export interface Stage2Clause {
  text: string
}

export interface Stage2Section {
  section_number: string
  section_title: string
  missed_some_clauses: boolean
  clauses: Stage2Clause[]
}

export interface Stage3Clause {
  text: string
  gorem: string
}

export interface Stage3Section {
  section_number: string
  section_title: string
  section_summary: string
  section_annex: string
  confidence: 'high' | 'low'
  missed_some_clauses: boolean
  clauses: Stage3Clause[]
}

export interface ObjectionResult {
  meta: ObjectionMeta
  sections: Stage3Section[]
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function coerceToString(v: any): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) {
    return v.filter(x => x !== null && x !== undefined).map(x => String(x)).join(', ')
  }
  return String(v)
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
  }, 'application/json')

  try {
    const data = extractJSON(raw) as Record<string, any>
    return {
      megish: coerceToString(data.megish),
      beshem: coerceToString(data.beshem),
      ktovet: coerceToString(data.ktovet),
      gush_chelka: coerceToString(data.gush_chelka),
    }
  } catch {
    return { megish: '', beshem: '', ktovet: '', gush_chelka: '' }
  }
}

// ─── Stage 2: Extract chapters & verbatim clause text ───────────────────────

const STAGE2_SYSTEM = `אתה מומחה לדיני תכנון ובנייה בישראל. חלץ טקסט מדויק ומלא ממסמכי התנגדות. החזר JSON בלבד, ללא markdown.`

const STAGE2_USER = `חלץ את כל טענות ההתנגדות ממסמך ההתנגדות וקבוץ אותן לפי פרקים/סעיפים ראשיים.

עליך להחזיר אובייקט JSON בפורמט הבא בדיוק:
{
  "sections": [
    {
      "section_number": "מספר הסעיף הראשי/כותרת הפרק, כגון '1.0' או '2.0'",
      "section_title": "כותרת הסעיף הראשי במלואה (למשל: '1. היעדר היתכנות כלכלית והשפעתה על התמורות לבעלים:')",
      "missed_some_clauses": false, // רשום true אם נראה שחלק מסעיפי המשנה בפרק זה הושמטו, לא חולצו או שיש ספק לגבי שלמות החילוץ (למשל סריקה גרועה)
      "clauses": [
        {
          "text": "הטקסט המלא והמדויק (verbatim) של הפסקה או תת-הסעיף כפי שמופיע במסמך (למשל: 'מסמכי התוכנית כפי שהוגשו...' או '1.1 תוספת השטח...')"
        }
      ]
    }
  ]
}

הוראות חשובות:
1. חלץ רק את פרקי הטיעונים והטענות המהותיים (למשל פרק ג' או 'טענות ההתנגדות' וכד') — דלג על פתח דבר, רקע עובדתי כללי, מצב תכנוני מאושר, סיכום או נספחים כלליים.
2. שמור על כותרת הסעיף הראשי כפסקה/איבר נפרד ב-section_title. אל תתעלם ממנה ואל תמחוק אותה! היא חייבת להופיע במלואה.
3. לכל סעיף ראשי (כגון סעיף 1, סעיף 2 וכד'), קבע מספר סעיף מתאים בפורמט עשרוני (למשל '1.0', '2.0', '3.0' בהתאמה).
4. בתוך כל סעיף ראשי, פצל את התוכן לפסקאות או תת-סעיפים (כגון 1.1, 1.2, או פסקאות הקדמה כגון 'מסמכי התוכנית...') והכנס אותם לרשימת ה-clauses.
5. הטקסט ב-text חייב להיות מדויק מילולית כפי שהוא מופיע במסמך המקור, כולל מספרי תת-סעיפים אם ישנם (למשל, הכלל את '1.1' בתחילת הטקסט).
6. אל תמציא או תוסיף טקסט מעצמך.
`

export async function runStage2(pdfBase64: string): Promise<Stage2Section[]> {
  const raw = await geminiGenerateWithRetry(STAGE2_USER, STAGE2_SYSTEM, {
    data: pdfBase64,
    mimeType: 'application/pdf',
  }, 'application/json')

  try {
    const data = extractJSON(raw) as { sections?: any[] }
    const sections = data.sections ?? []
    return sections.map((s: any) => ({
      section_number: coerceToString(s.section_number),
      section_title: coerceToString(s.section_title),
      missed_some_clauses: !!s.missed_some_clauses,
      clauses: (s.clauses ?? []).map((c: any) => ({
        text: coerceToString(c.text),
      })),
    }))
  } catch (err) {
    console.error('[stage2] JSON parse error:', err)
    return []
  }
}

// ─── Stage 3: AI Subject / Annex / Gorem Analysis & Confidence ─────────────

const STAGE3_SYSTEM = `אתה מומחה לדיני תכנון ובנייה בישראל. החזר JSON בלבד, ללא markdown.`

export async function runStage3ForSection(
  sectionTitle: string,
  clauses: string[]
): Promise<{
  section_summary: string
  section_annex: string
  confidence: 'high' | 'low'
  clauses: { gorem: string }[]
}> {
  const prompt = `נתח את פרק ההתנגדות הבא וקבע את הנושא, הנספח המתאים, את הגורם המקצועי המוסמך לתת מענה עבור כל סעיף, ואת רמת הביטחון של הניתוח שלך.

כותרת הפרק:
"${sectionTitle}"

הסעיפים בפרק זה:
${clauses.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

עליך להחזיר אובייקט JSON בפורמט הבא בדיוק:
{
  "section_summary": "תקציר קצר של טענת הפרק בכמה מילים (3 עד 8 מילים) שיוצג בעמודת נושא (למשל: 'היעדר היתכנות כלכלית ותמורות')",
  "section_annex": "מיקום או נספח התיקון המתאים ביותר לפרק זה מתוך האפשרויות הבאות בדיוק: 'הוראות התוכנית' / 'נספח תנועה' / 'שמאות' / 'נספח ניקוז' / 'איכות סביבה' / 'אחר'",
  "confidence": "high" או "low" (רשום low אם הניסוח מעורפל, אם קשה לשייך לנספח/גורם חד-משמעי, או אם יש ספק בניתוח),
  "clauses": [
    {
      "gorem": "הגורם המקצועי המוסמך לתת מענה לטענה זו מתוך הרשימה הבאה בדיוק: 'שמאי' / 'אדריכל' / 'יועץ תנועה' / 'יועץ ביסוס' / 'אגרונום' / 'מהנדס ביצוע' / 'עירייה' / 'אחר'"
    }
  ]
}

הערה: אורך מערך ה-clauses בתוצאה חייב להיות בדיוק באורך מערך הסעיפים שהתקבל (${clauses.length} איברים).`

  try {
    const raw = await geminiGenerateWithRetry(prompt, STAGE3_SYSTEM, undefined, 'application/json')
    const data = extractJSON(raw) as any
    const section_summary = coerceToString(data.section_summary)
    const section_annex = coerceToString(data.section_annex)
    const confidence = (data.confidence === 'low' || data.confidence === 'LOW') ? 'low' : 'high'
    const returnedClauses = data.clauses ?? []

    // Map each original clause to a gorem, ensuring correct matching length
    const mappedClauses = clauses.map((c, idx) => {
      const retC = returnedClauses[idx]
      let gorem = coerceToString(retC?.gorem || '')
      if (gorem.toLowerCase() === 'none' || gorem === '') {
        gorem = 'אחר'
      }
      return { gorem }
    })

    return {
      section_summary,
      section_annex,
      confidence,
      clauses: mappedClauses,
    }
  } catch (err) {
    console.error('[stage3] error for section:', sectionTitle, err)
    return {
      section_summary: 'ניתוח נכשל',
      section_annex: 'אחר',
      confidence: 'low',
      clauses: clauses.map(() => ({ gorem: 'אחר' })),
    }
  }
}

// ─── Subprocess runner for Python ──────────────────────────────────────────

const PYTHON_CANDIDATES = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python']

function runPython(scriptName: string, stdinData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'backend', 'scripts', scriptName)

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

// ─── Excel Generation ───────────────────────────────────────────────────────

export async function generateExcel(objections: ObjectionResult[]): Promise<Buffer> {
  const input = JSON.stringify({ objections })
  const output = await runPython('generate_excel.py', input)
  return Buffer.from(output.trim(), 'base64')
}
