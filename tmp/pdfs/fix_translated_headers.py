from io import BytesIO
import os
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream
from reportlab.lib.colors import black
from reportlab.pdfgen import canvas

ROOT = Path.cwd()
TERMS = ROOT / "Backend" / "terms" / "v1"
TEMP = ROOT / "tmp" / "pdfs"
LABEL = "Orianaa Prestige Club"

def remove_previous_label(page, pdf):
    content = ContentStream(page.get_contents(), pdf)
    operations = content.operations
    ranges = set()
    for index, (operands, operator) in enumerate(operations):
        if operator != b"Tj" or not operands or str(operands[0]) != LABEL:
            continue
        start = next((i for i in range(index, -1, -1) if operations[i][1] == b"BT"), None)
        end = next((i for i in range(index + 1, len(operations)) if operations[i][1] == b"ET"), None)
        if start is None or end is None:
            continue
        matrices = [
            (float(args[-2]), float(args[-1]))
            for args, op in operations[start:end + 1]
            if op in (b"Tm", b"Td") and len(args) >= 2
        ]
        if any(x > 400 and y > 700 for x, y in matrices):
            ranges.update(range(start, end + 1))
    if not ranges:
        raise ValueError("Could not locate the previous added top-right label.")
    content.operations = [op for i, op in enumerate(operations) if i not in ranges]
    page.replace_contents(content)

def label_layer(page):
    width, height = float(page.mediabox.width), float(page.mediabox.height)
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(width, height))
    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(black)
    pdf.drawRightString(width - 43.15, height - 46, LABEL)
    pdf.save()
    stream.seek(0)
    return PdfReader(stream).pages[0]

pending = []
for filename in ("hi.pdf", "mr.pdf", "gu.pdf"):
    reader = PdfReader(TERMS / filename)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    for page in writer.pages:
        remove_previous_label(page, writer)
        page.merge_page(label_layer(page))
    output = TEMP / f"{filename}.fixed.pdf"
    with output.open("wb") as target:
        writer.write(target)
    pending.append((filename, output))

for filename, output in pending:
    checked = PdfReader(output)
    for page_number, page in enumerate(checked.pages, start=1):
        text = page.extract_text() or ""
        if "Privileged and Confidential" in text:
            raise ValueError(f"Unexpected old wording in {filename} page {page_number}.")
        labels = sum(line.strip() == LABEL for line in text.splitlines())
        if labels != 1:
            raise ValueError(f"Expected one label in {filename} page {page_number}; found {labels}.")

for filename, output in pending:
    os.replace(output, TERMS / filename)
    print(f"Adjusted {filename}: {len(PdfReader(TERMS / filename).pages)} pages")
