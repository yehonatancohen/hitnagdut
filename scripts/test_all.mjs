/**
 * Full end-to-end pipeline test — all PDFs → one combined Excel.
 * Run: node scripts/test_all.mjs
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const API_KEY = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').find(l => l.startsWith('GEMINI_API_KEY='))?.split('=')[1]?.trim()
if (!API_KEY) { console.error('No GEMINI_API_KEY'); process.exit(1) }

const MODEL = 'gemini-2.5-flash'
const SEIF_START = '<<<SEIF:'
const SEIF_NOSE  = '>>>NOSE:'
const SEIF_GOREM = '>>>GOREM:'

// ── Gemini call with retry ────────────────────────────────────────────────────

let lastCallTime = 0
const MIN_CALL_GAP = 6000 // ms between calls — stays under 10 RPM

async function geminiCall(model, pdfBase64, prompt) {
  const gap = Date.now() - lastCallTime
  if (gap < MIN_CALL_GAP) await new Promise(r => setTimeout(r, MIN_CALL_GAP - gap))

  const parts = []
  if (pdfBase64) parts.push({ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } })
  parts.push({ text: prompt })
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      lastCallTime = Date.now()
      const r = await model.generateContent({ contents: [{ role: 'user', parts }] })
      return r.response.text()
    } catch (e) {
      if (e?.message?.includes('429') || e?.message?.toLowerCase().includes('rate')) {
        const wait = [30, 60, 90, 120, 180, 240][attempt] * 1000
        console.log(`  Rate limit (attempt ${attempt + 1}), waiting ${wait / 1000}s...`)
        await new Promise(r => setTimeout(r, wait))
      } else throw e
    }
  }
  throw new Error('Max retries exceeded')
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

const VALID_ESC = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])
function repairJSON(raw) {
  let result = '', inString = false, i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (!inString) { result += ch; if (ch === '"') inString = true; i++; continue }
    if (ch === '\\') {
      const next = i + 1 < raw.length ? raw[i + 1] : ''
      if (VALID_ESC.has(next)) { result += ch + next; i += 2 }
      else { i++ }
      continue
    }
    if (ch === '"') { inString = false; result += ch; i++; continue }
    if (ch === '\n') { result += '\\n'; i++; continue }
    if (ch === '\r') { result += '\\r'; i++; continue }
    if (ch === '\t') { result += '\\t'; i++; continue }
    if (ch.charCodeAt(0) < 0x20) { i++; continue }
    result += ch; i++
  }
  return result
}

function extractJSON(text) {
  let s = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim()
  try { return JSON.parse(s) } catch {}
  const start = s.indexOf('{'), end = s.lastIndexOf('}')
  if (start !== -1 && end > start) s = s.slice(start, end + 1)
  return JSON.parse(repairJSON(s))
}

// ── Clause delimiter parser ───────────────────────────────────────────────────

function parseClauses(raw) {
  const clauses = []
  const chunks = raw.split(SEIF_START)
  for (const chunk of chunks.slice(1)) {
    const nlIdx = chunk.indexOf('\n')
    if (nlIdx === -1) continue
    const seif = chunk.slice(0, nlIdx).trim()
    const rest = chunk.slice(nlIdx + 1)

    const noseMatch  = rest.match(/^>>>NOSE:(.+)$/m)
    const goremMatch = rest.match(/^>>>GOREM:(.+)$/m)
    const nose  = noseMatch?.[1]?.trim()  ?? ''
    const gorem = goremMatch?.[1]?.trim() ?? ''

    const mahutLines = rest.split('\n').filter(l => !l.startsWith('>>>'))
    const mahut = mahutLines.join('\n').trim()

    const normalizedSeif = (seif === 'ריק' || seif === 'none' || seif.toLowerCase() === 'ריק') ? '' : seif
    clauses.push({ seif: normalizedSeif, mahut, nose, gorem })
  }
  return clauses
}

// ── Excel via Python ──────────────────────────────────────────────────────────

function runExcel(objections, outputName) {
  const scriptPath = path.join(ROOT, 'scripts', 'generate_excel.py')
  const tmp = path.join(ROOT, 'scripts', '_tmp_input.json')
  writeFileSync(tmp, JSON.stringify({ objections }), 'utf8')
  const out = execSync(`py "${scriptPath}" < "${tmp}"`, {
    env: { ...process.env, PYTHONUTF8: '1' },
    maxBuffer: 10 * 1024 * 1024,
  }).toString().trim()
  const outPath = path.join(ROOT, 'results', 'output', outputName)
  writeFileSync(outPath, Buffer.from(out, 'base64'))
  return outPath
}

// ── PDF sort: by numeric prefix ───────────────────────────────────────────────

function pdfSortKey(filename) {
  const m = filename.match(/^התנגדות (\d+)/)
  return m ? parseInt(m[1], 10) : 999
}

// ── Per-PDF pipeline ──────────────────────────────────────────────────────────

async function processPDF(pdfPath, genAI) {
  const name = path.basename(pdfPath)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`PDF: ${name}`)

  const pdfBase64 = readFileSync(pdfPath).toString('base64')

  const mMeta = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: 'אתה מומחה לדיני תכנון ובנייה בישראל. החזר JSON בלבד, ללא markdown.',
  })

  const mClause = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: 'אתה מומחה לדיני תכנון ובנייה בישראל. חלץ טקסט מדויק ממסמכי התנגדות.',
  })

  // Stage 1: metadata
  console.log('[S1] Extracting metadata...')
  const raw1 = await geminiCall(mMeta, pdfBase64,
    `חלץ מהמסמך את פרטי מגיש ההתנגדות:
- megish: שם מגיש ההתנגדות (שם הרשות/חברה/עורך דין/אדם פרטי)
- beshem: בשם מי הוגשה (אם הוגשה על ידי בעל הנכס עצמו, כתוב "עצמו"; אם הוגשה על ידי נציג, כתוב שם הלקוח)
- ktovet: כתובת הנכס המושפע (אם לא צוינה, כתוב "")
- gush_chelka: מספרי גוש וחלקה (אם לא צוינו, כתוב "")

החזר JSON בלבד:
{"megish":"...","beshem":"...","ktovet":"...","gush_chelka":"..."}`)

  let meta = { megish: '', beshem: '', ktovet: '', gush_chelka: '' }
  try {
    const d = extractJSON(raw1)
    meta = {
      megish:      d.megish      ?? '',
      beshem:      d.beshem      ?? '',
      ktovet:      d.ktovet      ?? '',
      gush_chelka: d.gush_chelka ?? '',
    }
    console.log(`  megish=${meta.megish} | beshem=${meta.beshem} | ktovet=${meta.ktovet} | gush=${meta.gush_chelka}`)
  } catch (e) {
    console.error('  S1 failed:', e.message)
  }

  // Stage 2: clause extraction
  console.log('[S2] Extracting clauses...')
  const raw2 = await geminiCall(mClause, pdfBase64,
    `חלץ את הטענות המהותיות (טענות ההתנגדות) ממסמך ההתנגדות.

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
- אם הסעיף הוא כותרת בלבד ללא תוכן ממשי, כתוב nose=None ו-gorem=None`)

  const clauses = parseClauses(raw2)
  console.log(`  ${clauses.length} clauses extracted`)
  clauses.forEach(c => console.log(`    seif=${c.seif || '(none)'}: ${c.mahut.slice(0, 60)}...`))

  return { meta, clauses }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(API_KEY)
const inputDir = path.join(ROOT, 'results', 'inputs')
const pdfs = readdirSync(inputDir)
  .filter(f => f.toLowerCase().endsWith('.pdf'))
  .sort((a, b) => {
    const ka = pdfSortKey(a), kb = pdfSortKey(b)
    if (ka !== kb) return ka - kb
    return a.localeCompare(b)
  })

console.log(`Found ${pdfs.length} PDFs (sorted by number):`)
pdfs.forEach((p, i) => console.log(`  ${i + 1}. ${p}`))

const allObjections = []
for (const pdf of pdfs) {
  try {
    const result = await processPDF(path.join(inputDir, pdf), genAI)
    allObjections.push(result)
  } catch (e) {
    console.error(`\n✗ FAILED: ${pdf} — ${e.message}`)
    allObjections.push({ meta: { megish: pdf, beshem: '', ktovet: '', gush_chelka: '' }, clauses: [] })
  }
  await new Promise(r => setTimeout(r, 8000))
}

console.log(`\n[Excel] ${allObjections.length} objections, ${allObjections.reduce((s, o) => s + o.clauses.length, 0)} total clauses`)
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outPath = runExcel(allObjections, `combined_התנגדויות_${ts}.xlsx`)
console.log(`✓ Written: ${outPath}`)
console.log('\nDone.')
