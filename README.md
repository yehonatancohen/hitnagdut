# hitnagdut

Web app for processing Israeli planning objection PDFs. Uploads PDFs, extracts structured objection data via Gemini AI (3-stage pipeline), and exports the results as a formatted Excel workbook.

## Project structure

```
hitnagdut/
├── app/                        # Next.js UI and API routes
│   ├── page.tsx                # Main UI (upload, preview, download)
│   ├── layout.tsx              # Root layout (Hebrew RTL)
│   └── api/process/route.ts   # SSE streaming endpoint (stages 1 & 2) + JSON endpoint (stage 3, Excel)
├── lib/                        # Next.js server-side logic
│   ├── pipeline.ts             # 3-stage Gemini pipeline + Excel generation via Python
│   └── gemini.ts               # Gemini API wrapper with retry
├── backend/                    # Python backend
│   ├── api/
│   │   └── process.py          # FastAPI server (mirrors the TS pipeline, used in local dev)
│   └── scripts/
│       ├── generate_excel.py   # Excel workbook builder (called by pipeline.ts as subprocess)
│       └── extract_text.py     # PDF text extraction utility
├── scripts/                    # Dev and test scripts (Node.js)
│   ├── dev.mjs                 # Starts Next.js + FastAPI together
│   ├── test_pipeline.mjs       # Manual pipeline test
│   ├── test_one.mjs            # Test a single PDF
│   └── test_all.mjs            # Batch test all PDFs in results/inputs/
├── results/
│   ├── inputs/                 # PDFs to process (gitignored)
│   └── output/                 # Generated Excel files (gitignored)
├── requirements.txt            # Python dependencies (pdfplumber, openpyxl, fastapi)
└── vercel.json                 # Vercel deployment config
```

## Setup

```bash
# Node dependencies
npm install

# Python dependencies
pip install -r requirements.txt

# Environment — create .env.local with:
GEMINI_API_KEY=your_key_here
```

## Running

```bash
# Next.js only (production mode — uses TS pipeline)
npm run dev

# Next.js + FastAPI together (local dev)
node scripts/dev.mjs
```

## Pipeline

1. **Stage 1** — extracts submitter metadata (name, address, parcel numbers) from each PDF via Gemini
2. **Stage 2** — extracts all objection clauses grouped by section, verbatim text
3. **Stage 3** — per section: AI assigns topic summary, relevant annex, responsible professional (`gorem`), and confidence level
4. **Excel** — `backend/scripts/generate_excel.py` builds the formatted workbook from the structured data
