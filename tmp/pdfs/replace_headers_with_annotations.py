import os
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import FreeText
from pypdf.generic import ContentStream, NameObject, NumberObject
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT = Path.cwd()
TERMS = ROOT / "Backend" / "terms" / "v1"
TEMP = ROOT / "tmp" / "pdfs"
LABEL = "Orianaa Prestige Club"
FILES = ("en.pdf", "membership-terms.pdf")
FONT_SIZE = 11
RIGHT = 552.15
BOTTOM = 741.0
TOP = 760.0


def remove_header_blocks(page, pdf):
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
        raise ValueError("Could not locate the existing confidentiality header.")
    content.operations = [op for i, op in enumerate(operations) if i not in ranges]
    page.replace_contents(content)


def make_annotation(width):
    right = min(width - 60, RIGHT)
    left = right - stringWidth(LABEL, "Helvetica", FONT_SIZE)
    annotation = FreeText(
        text=LABEL,
        rect=(left, BOTTOM, right, TOP),
        font="Helvetica",
        font_size=f"{FONT_SIZE}pt",
        font_color="000000",
        border_color=None,
        background_color=None,
    )
    annotation[NameObject("/F")] = NumberObject(4)  # print annotation
    return annotation


pending = []
for filename in FILES:
    reader = PdfReader(TERMS / filename)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    for page_number, page in enumerate(writer.pages, start=1):
        if "Privileged and Confidential" not in (page.extract_text() or ""):
            raise ValueError(f"Expected old wording in {filename} page {page_number}.")
        remove_header_blocks(page, writer)
        if "Privileged and Confidential" in (page.extract_text() or ""):
            raise ValueError(f"Old wording remains in {filename} page {page_number}.")
        writer.add_annotation(page, make_annotation(float(page.mediabox.width)))
    output = TEMP / f"{filename}.annotation.tmp.pdf"
    with output.open("wb") as target:
        writer.write(target)
    pending.append((filename, output))

for filename, output in pending:
    checked = PdfReader(output)
    for page_number, page in enumerate(checked.pages, start=1):
        if "Privileged and Confidential" in (page.extract_text() or ""):
            raise ValueError(f"Old wording remains in {filename} page {page_number}.")
        annotations = page.get("/Annots") or []
        brand_annotations = [
            item.get_object()
            for item in annotations
            if str(item.get_object().get("/Contents", "")) == LABEL
        ]
        if len(brand_annotations) != 1 or brand_annotations[0].get("/F") != 4:
            raise ValueError(f"Expected one printable brand annotation in {filename} page {page_number}.")

for filename, output in pending:
    os.replace(output, TERMS / filename)
    print(f"Updated {filename}: {len(PdfReader(TERMS / filename).pages)} pages")
