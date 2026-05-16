import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const API_KEY = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').find(l => l.startsWith('GEMINI_API_KEY='))?.split('=')[1]?.trim()

if (!API_KEY) { console.error('No GEMINI_API_KEY'); process.exit(1) }

const PDF_PATH = path.join(ROOT, 'results/inputs/אופקים עין גנים התנגדות 14.pdf')

const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'אתה מומחה לדיני תכנון ובנייה בישראל. חלץ טקסט מילולי מדויק ממסמך התנגדות והחזר JSON בלבד, ללא markdown.',
})

const pdfBase64 = readFileSync(PDF_PATH).toString('base64')

// ── Stage 1 ──────────────────────────────────────────────────────────────────
console.log('=== STAGE 1: identifying sections ===')
const s1prompt = `זהה את כל פרקי הנימוקים (נימוקי ההתנגדות).
עבור כל תת-פרק לוגי החזר:
- heading: מזהה קצר בלבד (ג.I, ג.II.1 וכד') — ללא כותרת טקסטואלית
- seifim_start: מספר הסעיף הראשון (מספר שלם)
- seifim_end: מספר הסעיף האחרון (מספר שלם)
- gorem: שמאי / אדריכל / יועץ תנועה / יועץ ביסוס וגיאוטכניקה / אגרונום / מהנדס ביצוע / שילובים עם +

החזר JSON בלבד:
{"sections":[{"heading":"ג.I","seifim_start":21,"seifim_end":40,"gorem":"שמאי"}]}

כלול רק פרקי נימוקים מהותיים. דלג על פתח דבר, רקע עובדתי, סיכום.`

const r1 = await model.generateContent({
  contents: [{ role: 'user', parts: [
    { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } },
    { text: s1prompt }
  ]}]
})
const raw1 = r1.response.text()
console.log('RAW S1:', raw1.slice(0, 800))

let sections
try {
  const clean1 = raw1.replace(/^```(?:json)?\s*/im,'').replace(/\s*```\s*$/im,'').trim()
  sections = JSON.parse(clean1).sections
  console.log(`\nFound ${sections.length} sections:`)
  sections.forEach(s => console.log(`  ${s.heading}: seifim ${s.seifim_start}-${s.seifim_end} | ${s.gorem}`))
} catch(e) {
  console.error('S1 parse failed:', e.message)
  process.exit(1)
}

// ── Stage 2 ──────────────────────────────────────────────────────────────────
console.log('\n=== STAGE 2: extracting text ===')
const sectionList = sections.map(s => `- פרק ${s.heading}: סעיפים ${s.seifim_start}–${s.seifim_end}`).join('\n')

const s2prompt = `בהינתן מסמך התנגדות זה, חלץ את הטקסט המילולי המלא עבור כל אחד מהפרקים הבאים.

פרקים לחילוץ:
${sectionList}

הוראות:
- חלץ טקסט מדויק (verbatim), כולל כל הסעיפים בטווח
- כל סעיף בפורמט: "סעיף X: [טקסט]"
- ערכי mell הם מחרוזות JSON — שורות חדשות = \\n, גרשיים = \\"
- אסור שורות פיזיות בתוך ערך JSON

החזר JSON:
{"sections":[{"heading":"ג.I","mell":"סעיף 21: טקסט\\nסעיף 22: טקסט"}]}`

const r2 = await model.generateContent({
  contents: [{ role: 'user', parts: [
    { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } },
    { text: s2prompt }
  ]}]
})
const raw2 = r2.response.text()
console.log('\nRAW S2 (first 2000 chars):')
console.log(raw2.slice(0, 2000))
console.log('\n[...] (total length:', raw2.length, ')')

// Try parsing
let clean2 = raw2.replace(/^```(?:json)?\s*/im,'').replace(/\s*```\s*$/im,'').trim()
try {
  const parsed = JSON.parse(clean2)
  console.log('\n✓ Direct parse succeeded, sections:', parsed.sections?.length)
  parsed.sections?.forEach(s => {
    console.log(`  ${s.heading}: mell length=${s.mell?.length}, first 100: ${s.mell?.slice(0,100)}`)
  })
} catch(e) {
  console.log('\n✗ Direct parse failed:', e.message)
  // Show char around error position
  const pos = parseInt(e.message.match(/position (\d+)/)?.[1] ?? '0')
  if (pos) {
    console.log(`\nContext around position ${pos}:`)
    console.log(JSON.stringify(clean2.slice(Math.max(0,pos-100), pos+100)))
  }
}
