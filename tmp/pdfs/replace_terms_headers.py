from io import BytesIO
import os
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream
from reportlab.lib.colors import white, black
from reportlab.pdfgen import canvas

ROOT = Path.cwd()
TERMS = ROOT / "Backend" / "terms" / "v1"
TEMP = ROOT / "tmp" / "pdfs"
LABEL = "Orianaa Prestige Club"
FILES = {
    "en.pdf": True,
    "hi.pdf": False,
    "mr.pdf": False,
    "gu.pdf": False,
    "membership-terms.pdf": True,
}

def remove_old_header(page, pdf):
    content = ContentStream(page.get_contents(), pdf)
    operations = content.operations
    ranges = set()
    for index, (operands, operator) in enumerate(operations):
        if operator not in (b"Td", b"Tm") or len(operands) < 2:
            continue
        x, y = float(operands[-2]), float(operands[-1])
        if x < 400 or y < 730:
            continue
        start = next((i for i in range(index, -1, -1) if operations[i][1] == b"BT"), None)
        end = next((i for i in range(index + 1, len(operations)) if operations[i][1] == b"ET"), None)
        if start is not None and end is not None:
            ranges.update(range(start, end + 1))
    if not ranges:
        raise ValueError("Could not locate the existing confidentiality header to replace.")
    content.operations = [op for i, op in enumerate(operations) if i not in ranges]
    page.replace_contents(content)
    return len(ranges)

def make_label_layer(page, old_header):
    width, height = float(page.mediabox.width), float(page.mediabox.height)
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(width, height))
    pdf.setFont("Helvetica", 11)
    if old_header:
        # Cover the original line after removing its text operators.
        pdf.setFillColor(white)
        pdf.rect(417, 742, 140, 18, fill=1, stroke=0)
        baseline = 746.1
    else:
        # The translated originals do not have this header; use the clear top margin.
        baseline = 765
    pdf.setFillColor(black)
    pdf.drawRightString(552.15, baseline, LABEL)
    pdf.save()
    stream.seek(0)
    return PdfReader(stream).pages[0]

pending = []
for filename, replace_old in FILES.items():
    source = TERMS / filename
    reader = PdfReader(source)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    for page_number, page in enumerate(writer.pages, start=1):
        text = page.extract_text() or ""
        exact_label_present = any(line.strip() == LABEL for line in text.splitlines())
        has_old_header = "Privileged and Confidential" in text
        if replace_old and not has_old_header and not exact_label_present:
            raise ValueError(f"Expected the existing header on page {page_number} of {filename}.")
        if replace_old and has_old_header:
            remove_old_header(page, writer)
        if not exact_label_present:
            page.merge_page(make_label_layer(page, replace_old))
    output = TEMP / f"{filename}.tmp.pdf"
    with output.open("wb") as target:
        writer.write(target)
    pending.append((filename, output))

# Reopen every output and confirm each page contains the new header and no old wording.
for filename, output in pending:
    checked = PdfReader(output)
    for page_number, page in enumerate(checked.pages, start=1):
        text = page.extract_text() or ""
        if "Privileged and Confidential" in text:
            raise ValueError(f"Old wording remains on page {page_number} of {filename}.")
        count = sum(line.strip() == LABEL for line in text.splitlines())
        if count != 1:
            raise ValueError(f"Expected one new brand header on page {page_number} of {filename}; found {count}.")

# Replace originals only after all five outputs passed the page-by-page checks.
for filename, output in pending:
    os.replace(output, TERMS / filename)
    print(f"Updated {filename}: {len(PdfReader(TERMS / filename).pages)} pages")
