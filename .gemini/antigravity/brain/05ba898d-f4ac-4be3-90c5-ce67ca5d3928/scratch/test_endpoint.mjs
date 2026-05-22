import fs from 'fs'
import path from 'path'

const PDF_PATH = 'c:\\Users\\User\\Documents\\Bots\\hitnagdut\\results\\inputs\\התנגדות 4 עירייה.pdf'
const OUT_EXCEL_PATH = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\05ba898d-f4ac-4be3-90c5-ce67ca5d3928\\scratch\\test_output_processed.xlsx'

async function run() {
  console.log('--- STARTING INTEGRATION TEST ---')
  console.log(`Reading PDF file: ${PDF_PATH}`)
  
  if (!fs.existsSync(PDF_PATH)) {
    console.error('Error: PDF file does not exist!')
    process.exit(1)
  }
  
  const fileBuffer = fs.readFileSync(PDF_PATH)
  const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' })
  
  const formData = new FormData()
  formData.append('pdf', fileBlob, 'התנגדות 4 עירייה.pdf')
  formData.append('mode', 'merged')
  formData.append('fileName', 'התנגדויות_מאוגדות')
  
  console.log('\n1. Sending POST request for Stage 1 & Stage 2 (SSE)...')
  const sseRes = await fetch('http://localhost:3000/api/process', {
    method: 'POST',
    body: formData
  })
  
  if (!sseRes.ok) {
    console.error(`SSE request failed with status ${sseRes.status}`)
    process.exit(1)
  }
  
  const reader = sseRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let objections = null
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = JSON.parse(line.substring(6))
        if (payload.type === 'log') {
          console.log(`[SSE Log]: ${payload.message}`)
        } else if (payload.type === 'done') {
          console.log('\n✓ SSE Process Done!')
          objections = payload.objections
        } else if (payload.type === 'error') {
          console.error(`[SSE Error]: ${payload.message}`)
          process.exit(1)
        }
      }
    }
  }
  
  if (!objections || objections.length === 0) {
    console.error('No objections extracted from PDF.')
    process.exit(1)
  }
  
  console.log('\n2. Extract/Verify Submitter Metadata & Sections (Preview Stage Data):')
  const firstObjection = objections[0]
  console.log('Metadata:', JSON.stringify(firstObjection.meta, null, 2))
  console.log(`Number of sections extracted: ${firstObjection.sections.length}`)
  
  if (firstObjection.sections.length === 0) {
    console.error('No sections extracted.')
    process.exit(1)
  }
  
  const firstSec = firstObjection.sections[0]
  console.log('First Section (Raw):', JSON.stringify({
    section_number: firstSec.section_number,
    section_title: firstSec.section_title,
    missed_some_clauses: firstSec.missed_some_clauses,
    clauses: firstSec.clauses
  }, null, 2))
  
  console.log('\n3. Triggering Stage 3 analysis for the first section...')
  const s3Res = await fetch('http://localhost:3000/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'stage3',
      section_title: firstSec.section_title,
      clauses: firstSec.clauses.map(c => c.text)
    })
  })
  
  if (!s3Res.ok) {
    console.error(`Stage 3 request failed: ${s3Res.statusText}`)
    process.exit(1)
  }
  
  const s3Result = await s3Res.json()
  console.log('Stage 3 Analysis Result:', JSON.stringify(s3Result, null, 2))
  
  // Merge Stage 3 result back into the objections structure to simulate frontend action
  firstSec.section_summary = s3Result.section_summary
  firstSec.section_annex = s3Result.section_annex
  firstSec.confidence = s3Result.confidence
  firstSec.clauses = firstSec.clauses.map((c, i) => ({
    ...c,
    gorem: s3Result.clauses[i]?.gorem || 'אחר'
  }))
  
  // Also perform Stage 3 for any remaining sections to have fully-populated objections
  console.log('\n4. Processing remaining sections for Excel generation...')
  for (let i = 1; i < firstObjection.sections.length; i++) {
    const sec = firstObjection.sections[i]
    console.log(`Analyzing section ${sec.section_number}: ${sec.section_title}`)
    const res = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'stage3',
        section_title: sec.section_title,
        clauses: sec.clauses.map(c => c.text)
      })
    })
    if (res.ok) {
      const data = await res.json()
      sec.section_summary = data.section_summary
      sec.section_annex = data.section_annex
      sec.confidence = data.confidence
      sec.clauses = sec.clauses.map((c, idx) => ({
        ...c,
        gorem: data.clauses[idx]?.gorem || 'אחר'
      }))
    }
  }
  
  console.log('\n5. Generating Excel spreadsheet...')
  const excelRes = await fetch('http://localhost:3000/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'excel',
      objections: objections,
      mode: 'merged',
      fileName: 'התנגדויות_מאוגדות'
    })
  })
  
  if (!excelRes.ok) {
    console.error(`Excel request failed: ${excelRes.statusText}`)
    process.exit(1)
  }
  
  const excelResult = await excelRes.json()
  if (excelResult.error) {
    console.error(`Excel error: ${excelResult.error}`)
    process.exit(1)
  }
  
  console.log(`Excel generation succeeded! Merged: ${excelResult.mode}`)
  const base64Data = excelResult.file
  const excelBuffer = Buffer.from(base64Data, 'base64')
  
  fs.writeFileSync(OUT_EXCEL_PATH, excelBuffer)
  console.log(`\n✓ Excel successfully written to: ${OUT_EXCEL_PATH}`)
  console.log('--- TEST COMPLETED SUCCESSFULLY ---')
}

run().catch(console.error)
