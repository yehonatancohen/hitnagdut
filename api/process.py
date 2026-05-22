import os
import json
import base64
import asyncio
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv

# Import existing logic from scripts
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from generate_excel import build_workbook

app = FastAPI()

# Load Next.js .env.local environment variables
env_local_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local')
if os.path.exists(env_local_path):
    load_dotenv(dotenv_path=env_local_path)
else:
    load_dotenv()

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None


MODEL_NAME = 'gemini-2.5-flash'

STAGE1_SYSTEM = "אתה מומחה לדיני תכנון ובנייה בישראל. החזר JSON בלבד, ללא markdown."
STAGE1_USER = """חלץ מהמסמך את פרטי מגיש ההתנגדות:
- megish: שם מגיש ההתנגדות (שם הרשות/חברה/עורך דין/אדם פרטי)
- beshem: בשם מי הוגשה (אם הוגשה על ידי בעל הנכס עצמו, כתוב "עצמו"; אם הוגשה על ידי נציג, כתוב שם הלקוח)
- ktovet: כתובת הנכס המושפע (אם לא צוינה, כתוב "")
- gush_chelka: מספרי גוש וחלקה כפי שמופיעים במסמך (אם לא צוינו, כתוב "")

החזר JSON בלבד:
{"megish":"...","beshem":"...","ktovet":"...","gush_chelka":"..."}"""

STAGE2_SYSTEM = "אתה מומחה לדיני תכנון ובנייה בישראל. חלץ טקסט מדויק ומלא ממסמכי התנגדות."
STAGE2_USER = """חלץ את כל טענות ההתנגדות ממסמך ההתנגדות וקבוץ אותן לפי פרקים/סעיפים ראשיים.

עליך להחזיר אובייקט JSON בפורמט הבא בדיוק:
{
  "sections": [
    {
      "section_number": "מספר הסעיף הראשי/כותרת הפרק, כגון '1.0' או '2.0'",
      "section_title": "כותרת הסעיף הראשי במלואה (למשל: '1. היעדר היתכנות כלכלית והשפעתה על התמורות לבעלים:')",
      "section_summary": "תקציר קצר של טענת הפרק בכמה מילים (3 עד 8 מילים) שיוצג בעמודת נושא (למשל: 'בדיקה נוספת של הזכויות והבדיקה הכלכלית')",
      "section_annex": "מיקום או נספח התיקון המתאים ביותר לפרק זה מתוך האפשרויות הבאות: 'הוראות התוכנית' / 'נספח תנועה' / 'שמאות' / 'נספח ניקוז' / 'איכות סביבה' / 'אחר'",
      "clauses": [
        {
          "text": "הטקסט המלא והמדויק (verbatim) של הפסקה או תת-הסעיף כפי שמופיע במסמך (למשל: 'מסמכי התוכנית כפי שהוגשו...' או '1.1 תוספת השטח...')",
          "gorem": "הגורם המקצועי המוסמך לתת מענה לטענה: שמאי / אדריכל / יועץ תנועה / יועץ ביסוס / אגרונום / מהנדס ביצוע / עירייה / אחר"
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
7. ה-section_summary צריך להיות סיכום קצר, תמציתי וממצה של מהות הטענה בפרק זה (למשל: 'פתרון לעומס תנועתי: הרחבת כבישים').
8. ה-section_annex יקבע לפי נושא הפרק (למשל סעיפי תנועה ישויכו ל'נספח תנועה', סעיפי כלכלה/תמורות לשמאות, סעיפי ניקוז ל'נספח ניקוז', סעיפי איכות סביבה ל'איכות סביבה', וסעיפים כלליים של התוכנית ל'הוראות התוכנית').
"""

class ObjectionMeta(BaseModel):
    megish: str
    beshem: str
    ktovet: str
    gush_chelka: str

    @field_validator('megish', 'beshem', 'ktovet', 'gush_chelka', mode='before')
    @classmethod
    def coerce_to_string(cls, v):
        if v is None:
            return ""
        if isinstance(v, list):
            return ", ".join(str(item) for item in v if item is not None)
        return str(v)


class ClauseRow(BaseModel):
    text: str
    gorem: str

class SectionGroup(BaseModel):
    section_number: str
    section_title: str
    section_summary: str
    section_annex: str
    clauses: List[ClauseRow]

class ObjectionResult(BaseModel):
    meta: ObjectionMeta
    sections: List[SectionGroup]

def extract_json(text: str) -> dict:
    stripped = text.strip()
    if stripped.startswith("```json"):
        stripped = stripped[7:]
    if stripped.startswith("```"):
        stripped = stripped[3:]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    stripped = stripped.strip()
    
    start = stripped.find('{')
    end = stripped.rfind('}')
    if start != -1 and end != -1:
        stripped = stripped[start:end+1]
    
    return json.loads(stripped)

async def gemini_generate(prompt: str, system: str, pdf_bytes: bytes, use_json: bool = False):
    global client
    if not client:
        api_key = os.environ.get("GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)
        
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json" if use_json else None
    )
    
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=MODEL_NAME,
        contents=[
            types.Part.from_bytes(
                data=pdf_bytes,
                mime_type='application/pdf'
            ),
            prompt
        ],
        config=config
    )
    return response.text

@app.post("/api/process")
async def process_pdfs(
    pdf: List[UploadFile] = File(...),
    fileName: str = Form("התנגדויות_מאוגדות"),
    mode: str = Form("merged")
):
    # Read all files into memory immediately to avoid them being closed 
    # when the request scope changes during streaming.
    prepared_files = []
    for f in pdf:
        content = await f.read()
        prepared_files.append({"filename": f.filename, "content": content})

    async def event_generator():
        all_objections = []
        summary = []
        
        try:
            for i, file_info in enumerate(prepared_files):
                filename = file_info["filename"]
                pdf_bytes = file_info["content"]
                
                yield f"data: {json.dumps({'type': 'log', 'message': f'[{i+1}/{len(prepared_files)}] {filename}'})}\n\n"
                
                try:
                    yield f"data: {json.dumps({'type': 'log', 'message': '  שלב 1: מזהה פרטי מגיש...' })}\n\n"
                    raw_meta = await gemini_generate(STAGE1_USER, STAGE1_SYSTEM, pdf_bytes)
                    meta_data = extract_json(raw_meta)
                    meta = ObjectionMeta(**{
                        "megish": meta_data.get("megish", ""),
                        "beshem": meta_data.get("beshem", ""),
                        "ktovet": meta_data.get("ktovet", ""),
                        "gush_chelka": meta_data.get("gush_chelka", "")
                    })
                    ktovet_part = f" | {meta.ktovet}" if meta.ktovet else ""
                    yield f"data: {json.dumps({'type': 'log', 'message': f'  ✓ {meta.megish}{ktovet_part}'})}\n\n"
                    
                    yield f"data: {json.dumps({'type': 'log', 'message': '  שלב 2: מחלץ סעיפי התנגדות...' })}\n\n"
                    raw_clauses = await gemini_generate(STAGE2_USER, STAGE2_SYSTEM, pdf_bytes, use_json=True)
                    clauses_data = extract_json(raw_clauses)
                    sections_list = clauses_data.get("sections", [])
                    sections = [SectionGroup(**s) for s in sections_list]
                    
                    total_extracted_clauses = sum(len(s.clauses) for s in sections)
                    yield f"data: {json.dumps({'type': 'log', 'message': f'  ✓ {len(sections)} פרקים ({total_extracted_clauses} סעיפים) חולצו' })}\n\n"
                    
                    all_objections.append({
                        "meta": meta.dict(),
                        "sections": [s.dict() for s in sections]
                    })
                    summary.append({"fileName": filename, "megish": meta.megish, "clauses": total_extracted_clauses})
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    yield f"data: {json.dumps({'type': 'log', 'message': f'  ✗ שגיאה: {str(e)}' })}\n\n"
                    summary.append({"fileName": filename, "megish": filename, "clauses": 0, "failed": True})
                    all_objections.append({"meta": {"megish": filename, "beshem": "", "ktovet": "", "gush_chelka": ""}, "sections": []})

            total_clauses = sum(s['clauses'] for s in summary)
            yield f"data: {json.dumps({'type': 'log', 'message': f'סה\"כ: {len(prepared_files)} קבצים, {total_clauses} סעיפים' })}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'message': 'מייצר קובץ Excel...' })}\n\n"
            
            if mode == 'separate':
                files = []
                for j, obj in enumerate(all_objections):
                    safe_name = (obj['meta']['megish'] or f"התנגדות {j+1}").replace("/", "_").replace("\\", "_")
                    xlsx_bytes = build_workbook([obj])
                    files.append({"name": f"{safe_name}.xlsx", "data": base64.b64encode(xlsx_bytes).decode('utf-8')})
                yield f"data: {json.dumps({'type': 'done', 'mode': 'separate', 'files': files, 'summary': summary})}\n\n"
            else:
                xlsx_bytes = build_workbook(all_objections)
                yield f"data: {json.dumps({'type': 'done', 'mode': 'merged', 'file': base64.b64encode(xlsx_bytes).decode('utf-8'), 'fileName': f'{fileName}.xlsx', 'summary': summary})}\n\n"
                
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
