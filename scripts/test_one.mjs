/**
 * Test a single PDF with the updated positional-fallback logic.
 * Run: node scripts/test_one.mjs
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const API_KEY = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').find(l => l.startsWith('GEMINI_API_KEY='))?.split('=')[1]?.trim()

const PDF = path.join(ROOT, 'results/inputs/אופקים עין גנים התנגדות 14.pdf')
const MODEL = 'gemini-2.5-flash'

const VALID_ESCAPE_CHARS = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])
function repairJSON(raw) {
  let result = '', inString = false, i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (!inString) { result += ch; if (ch === '"') inString = true; i++; continue }
    if (ch === '\\') {
      const next = i + 1 < raw.length ? raw[i + 1] : ''
      if (VALID_ESCAPE_CHARS.has(next)) { result += ch + next; i += 2 }
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
async function call(model, pdfBase64, prompt) {
  const parts = []
  if (pdfBase64) parts.push({ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } })
  parts.push({ text: prompt })
  const r = await model.generateContent({ contents: [{ role: 'user', parts }] })
  return r.response.text()
}

const genAI = new GoogleGenerativeAI(API_KEY)
const pdfBase64 = readFileSync(PDF).toString('base64')

// Stage 1
const m1 = genAI.getGenerativeModel({ model: MODEL, systemInstruction: 'אתה מומחה לדיני תכנון ובנייה בישראל. החזר JSON בלבד, ללא markdown.' })
const raw1 = await call(m1, pdfBase64, `זהה את כל פרקי הנימוקים. עבור כל תת-פרק לוגי: heading (מזהה קצר בלבד, ג.I/ג.II וכד'), seifim_start, seifim_end, gorem.
החזר: {"sections":[{"heading":"ג.I","seifim_start":15,"seifim_end":23,"gorem":"שמאי + אדריכל"}]}
כלול רק פרקי נימוקים מהותיים. דלג על פתח דבר, רקע עובדתי, סיכום.`)
const sections = extractJSON(raw1).sections
console.log('Stage 1 sections:', sections.map(s => `${s.heading}(${s.seifim_start}-${s.seifim_end})`).join(', '))

// Stage 2
const sectionList = sections.map(s => `- פרק ${s.heading}: סעיפים ${s.seifim_start}–${s.seifim_end}`).join('\n')
const m2 = genAI.getGenerativeModel({ model: MODEL, systemInstruction: 'אתה מומחה לדיני תכנון ובנייה בישראל. חלץ טקסט מילולי מדויק. החזר JSON בלבד, ללא markdown.' })
const raw2 = await call(m2, pdfBase64, `חלץ טקסט מדויק (verbatim) עבור הפרקים הבאים:
${sectionList}

כל סעיף בפורמט "סעיף X: [טקסט]". ערכי mell = מחרוזות JSON עם \\n לשורות חדשות.
{"sections":[{"heading":"ג.I","mell":"סעיף 15: טקסט\\nסעיף 16: טקסט"}]}`)

console.log('\nStage 2 raw (first 300):')
console.log(raw2.slice(0, 300))

const s2 = extractJSON(raw2)
const resultList = (s2.sections ?? []).filter(s => s.heading && typeof s.mell === 'string')
console.log('\nS2 returned headings:', resultList.map(s => s.heading).join(', '))

const mellMap = {}
resultList.forEach(s => mellMap[s.heading] = s.mell)

const final = sections.map((s, i) => {
  let mell = mellMap[s.heading]
  if (!mell && resultList[i]) {
    mell = resultList[i].mell
    console.log(`Positional fallback: ${s.heading} → ${resultList[i].heading}`)
  }
  return { ...s, mell: mell ?? '' }
})

final.forEach(s => console.log(`\n${s.heading} (${s.seifim_start}-${s.seifim_end}): ${s.mell.length} chars`))
console.log('\nFirst section preview:\n', final[0]?.mell?.slice(0, 300))
