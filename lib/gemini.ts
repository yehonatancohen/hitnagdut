import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_NAME = 'gemini-2.5-flash'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function geminiGenerateWithRetry(
  prompt: string,
  systemInstruction: string,
  inlineData?: { data: string; mimeType: string },
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.pow(2, attempt) * 1000)
    }
    try {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = []

      if (inlineData) {
        parts.push({
          inlineData: {
            data: inlineData.data,
            mimeType: inlineData.mimeType,
          },
        })
      }
      parts.push({ text: prompt })

      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
      })

      const text = result.response.text()
      return text
    } catch (err: any) {
      lastError = err
      const isRateLimit =
        err?.message?.includes('429') ||
        err?.message?.toLowerCase().includes('rate') ||
        err?.status === 429
      if (!isRateLimit && attempt === 0) {
        throw err
      }
    }
  }

  throw lastError ?? new Error('Gemini request failed after retries')
}

export function extractJSON(text: string): unknown {
  // Strip markdown code fences if present
  let stripped = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()

  // First try direct parse
  try {
    return JSON.parse(stripped)
  } catch {}

  // Gemini sometimes puts unescaped control chars or literal newlines inside string values.
  // Strategy: find the outermost JSON object/array boundaries and re-parse with repairs.
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    stripped = stripped.slice(start, end + 1)
  }

  // Replace literal (unescaped) newlines/tabs inside JSON string values
  // Only replace newlines that are inside a string (between quotes).
  // Simple approach: replace \n and \r that appear between quotes with \\n
  const repaired = repairJSON(stripped)
  return JSON.parse(repaired)
}

// Valid single-char JSON escape sequences after a backslash
const VALID_ESCAPE_CHARS = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])

function repairJSON(raw: string): string {
  let result = ''
  let inString = false
  let i = 0

  while (i < raw.length) {
    const ch = raw[i]

    if (!inString) {
      result += ch
      if (ch === '"') inString = true
      i++
      continue
    }

    // Inside a string value
    if (ch === '\\') {
      const next = i + 1 < raw.length ? raw[i + 1] : ''
      if (VALID_ESCAPE_CHARS.has(next)) {
        // Valid escape — keep both chars (handle \uXXXX as well)
        result += ch + next
        i += 2
      } else {
        // Invalid escape like \ה or \- — drop the backslash, keep the char
        i++
      }
      continue
    }

    if (ch === '"') {
      inString = false
      result += ch
      i++
      continue
    }

    // Bare control characters illegal inside JSON strings
    if (ch === '\n') { result += '\\n'; i++; continue }
    if (ch === '\r') { result += '\\r'; i++; continue }
    if (ch === '\t') { result += '\\t'; i++; continue }
    if (ch.charCodeAt(0) < 0x20) { i++; continue }

    result += ch
    i++
  }

  return result
}
