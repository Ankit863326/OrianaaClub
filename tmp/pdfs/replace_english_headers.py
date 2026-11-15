import os
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream
from reportlab.pdfgen import canvas

ROOT = Path.cwd()
TERMS = ROOT / "Backend" / "terms" / "v1"
TEMP = ROOT / "tmp" / "pdfs"
LABEL = "Orianaa Prestige Club"
FILES = ("en.pdf", "membership-terms.pdf")


def remove_existing_brand(operations):
    matches = []
    for index, (operands, operator) in enumerate(operations):
        if operator not in (b"Tj", b"TJ"):
            continue
        strings = [operands[0]] if operator == b"Tj" else operands[0]
        if not any(str(value) == LABEL for value in strings):
            continue
        start = next((i for i in range(index, -1, -1) if operations[i][1] == b"BT"), None)
        end = next((i for i in range(index + 1, len(operations)) if operations[i][1] == b"ET"), None)
        if start is None or end is None:
            raise ValueError("Could not locate the old brand text block.")
        matches.append((start, end))
    if len(matches) != 1:
        raise ValueError(f"Expected one old brand text block per page, found {len(matches)}.")
    start, end = matches[0]
    return [item for i, item in enumerate(operations) if not start <= i <= end]


def make_brand_layer(width, height):
    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=(width, height))
    pdf.setFont("Helvetica", 11)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.drawRightString(min(width - 60, 552.15), 746.1, LABEL)
    pdf.save()
    stream.seek(0)
    return PdfReader(stream).pages[0]


pending = []
for filename in FILES:
    reader = PdfReader(TERMS / filename)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    for page_number, page in enumerate(writer.pages, start=1):
        content = ContentStream(page.get_contents(), writer)
        content.operations = remove_existing_brand(content.operations)
        page.replace_contents(content)
        page.merge_page(make_brand_layer(float(page.mediabox.width), float(page.mediabox.height)), over=True)
        if "Privileged and Confidential" in (page.extract_text() or ""):
            raise ValueError(f"Old wording remains in {filename} page {page_number}.")
    output = TEMP / f"{filename}.overlay.tmp.pdf"
    with output.open("wb") as target:
        writer.write(target)
    pending.append((filename, output))

for filename, output in pending:
    checked = PdfReader(output)
    for page_number, page in enumerate(checked.pages, start=1):
        text = page.extract_text() or ""
        if "Privileged and Confidential" in text:
            raise ValueError(f"Old wording remains in {filename} page {page_number}.")
        if sum(line.strip() == LABEL for line in text.splitlines()) != 1:
            raise ValueError(f"Expected one brand line in {filename} page {page_number}.")

for filename, output in pending:
    os.replace(output, TERMS / filename)
    print(f"Updated {filename}: {len(PdfReader(TERMS / filename).pages)} pages")
