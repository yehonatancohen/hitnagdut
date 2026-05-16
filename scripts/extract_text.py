#!/usr/bin/env python3
"""Stage 2: Extract clause text from PDF using pdfplumber."""

import sys
import json
import re

# Force UTF-8 on Windows (cp1252 can't encode Hebrew)
sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', buffering=1)

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
    sys.exit(1)


def is_hebrew_char(c: str) -> bool:
    return 'א' <= c <= 'ת'


def word_looks_reversed(word: str) -> bool:
    """
    A Hebrew word stored in visual order has its characters reversed.
    Heuristic: if more than half the characters are Hebrew AND
    the word reads as a valid Hebrew token when reversed (starts with a
    common Hebrew letter cluster), it's probably reversed.
    We use a simpler proxy: if first char is Hebrew and word length > 1,
    check whether the reversed form starts with a common prefix/suffix
    that looks more like natural Hebrew. For robustness we just always
    reverse Hebrew-only words when the page is detected as visual-order.
    """
    hebrew_chars = sum(1 for c in word if is_hebrew_char(c))
    return hebrew_chars > len(word) * 0.6


def fix_word(word: str) -> str:
    """Reverse a word that is stored in visual (backwards) order."""
    return word[::-1]


def page_is_visual_order(words: list) -> bool:
    """
    Detect whether this page stores Hebrew in visual (reversed) order.
    Sample the first 20 words; if the majority of Hebrew words start with
    a character that is more common as a word-END in Hebrew (like ן ם ף ך ץ
    — the final forms), the text is likely reversed.
    Final forms: ן=0x05df, ם=0x05dd, ף=0x05e3, ך=0x05db (final kaf), ץ=0x05e5
    """
    FINAL_FORMS = set('ןםףכץ')
    hebrew_words = [w['text'] for w in words[:40] if sum(1 for c in w['text'] if is_hebrew_char(c)) > 1]
    if len(hebrew_words) < 3:
        return False
    starts_with_final = sum(1 for w in hebrew_words if w[0] in FINAL_FORMS)
    return starts_with_final / len(hebrew_words) > 0.25


def extract_page_text_rtl(page) -> str:
    """
    Extract page text with proper RTL reading order and character direction.
    """
    words = page.extract_words(
        x_tolerance=5,
        y_tolerance=5,
        keep_blank_chars=False,
        use_text_flow=False,
    )
    if not words:
        return ''

    visual_order = page_is_visual_order(words)

    # Group words into lines by rounding top-y to nearest 4pt bucket
    lines: dict[int, list] = {}
    for w in words:
        bucket = round(w['top'] / 4) * 4
        lines.setdefault(bucket, []).append(w)

    result_lines = []
    for y in sorted(lines.keys()):
        # Sort words right-to-left (RTL reading order)
        line_words = sorted(lines[y], key=lambda w: w['x0'], reverse=True)
        texts = []
        for w in line_words:
            text = w['text']
            if visual_order and word_looks_reversed(text):
                text = fix_word(text)
            texts.append(text)
        result_lines.append(' '.join(texts))

    return '\n'.join(result_lines)


def extract_all_text(pdf_path: str) -> str:
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(extract_page_text_rtl(page))
    return '\n'.join(pages)


def find_clause_position(full_text: str, clause_num: int) -> int:
    """
    Find the character position of a numbered clause.
    In RTL-sorted text, clause numbers appear at the START of lines.
    Handles: "28.", "28)", "(28)", "סעיף 28", "28 ."
    """
    n = str(clause_num)

    patterns = [
        # Most common: line starts with number followed by dot/paren
        r'(?:^|\n)\s*' + re.escape(n) + r'[\.)\s]\s*[א-ת\(]',
        r'(?:^|\n)\s*' + re.escape(n) + r'\.\s',
        r'(?:^|\n)\s*' + re.escape(n) + r'\)\s',
        r'(?:^|\n)\s*\(' + re.escape(n) + r'\)\s',
        # After keyword "סעיף"
        r'סעיף\s+' + re.escape(n) + r'(?:\s|\.|\)|$)',
        # Number with space then dot
        r'(?:^|\n)\s*' + re.escape(n) + r'\s+\.',
        # Bare number at line start followed by Hebrew
        r'(?:^|\n)' + re.escape(n) + r'\s+[א-ת]',
    ]

    for pattern in patterns:
        m = re.search(pattern, full_text, re.MULTILINE)
        if m:
            return m.start()

    return -1


def extract_section_text(full_text: str, seifim_start: int, seifim_end: int):
    warnings = []
    positions = {}

    for n in range(seifim_start, seifim_end + 1):
        pos = find_clause_position(full_text, n)
        if pos == -1:
            warnings.append(f"clause {n} not found")
        else:
            positions[n] = pos

    if not positions:
        return '', warnings

    sorted_clauses = sorted(positions.items(), key=lambda x: x[1])
    clause_texts = []

    for i, (clause_num, start_pos) in enumerate(sorted_clauses):
        if i + 1 < len(sorted_clauses):
            end_pos = sorted_clauses[i + 1][1]
        else:
            next_pos = find_clause_position(full_text, seifim_end + 1)
            end_pos = next_pos if next_pos != -1 else min(start_pos + 5000, len(full_text))

        clause_text = full_text[start_pos:end_pos].strip()
        clause_texts.append(f"סעיף {clause_num}: {clause_text}")

    return '\n\n'.join(clause_texts), warnings


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}))
        sys.exit(1)

    pdf_path = data.get('pdf_path', '')
    sections = data.get('sections', [])

    if not pdf_path:
        print(json.dumps({"error": "pdf_path not provided"}))
        sys.exit(1)

    try:
        full_text = extract_all_text(pdf_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to open PDF: {e}"}))
        sys.exit(1)

    all_warnings = []
    result_sections = []

    for section in sections:
        heading       = section.get('heading', '')
        seifim_start  = section.get('seifim_start', 0)
        seifim_end    = section.get('seifim_end', 0)
        gorem         = section.get('gorem', '')

        extracted, warnings = extract_section_text(full_text, seifim_start, seifim_end)
        all_warnings.extend(warnings)

        result_sections.append({
            "heading": heading,
            "seifim_start": seifim_start,
            "seifim_end": seifim_end,
            "gorem": gorem,
            "mell": extracted,
        })

    print(json.dumps({
        "sections": result_sections,
        "warnings": all_warnings,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
