import os
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NumberObject,
)

ROOT = Path.cwd()
TERMS = ROOT / "Backend" / "terms" / "v1"
TEMP = ROOT / "tmp" / "pdfs"
LABEL = "Orianaa Prestige Club"
FILES = ("en.pdf", "membership-terms.pdf")


def make_appearance(writer, font_ref, width, height):
    stream = DecodedStreamObject()
    stream.set_data(
        b"q\n0 g\nBT\n/F1 11 Tf\n0 Tc\n100 Tz\n0 Ts\n0 Tr\n"
        b"1 0 0 1 0 5.5 Tm\n(Orianaa Prestige Club) Tj\nET\nQ\n"
    )
    stream.update({
        NameObject("/Type"): NameObject("/XObject"),
        NameObject("/Subtype"): NameObject("/Form"),
        NameObject("/FormType"): NumberObject(1),
        NameObject("/BBox"): ArrayObject([
            FloatObject(0), FloatObject(0), FloatObject(width), FloatObject(height)
        ]),
        NameObject("/Resources"): DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})
        }),
    })
    return writer._add_object(stream)


pending = []
for filename in FILES:
    reader = PdfReader(TERMS / filename)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
        NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
    })
    font_ref = writer._add_object(font)
    for page_number, page in enumerate(writer.pages, start=1):
        matches = []
        for item in page.get("/Annots") or []:
            annotation = item.get_object()
            if str(annotation.get("/Contents", "")) == LABEL:
                matches.append(annotation)
        if len(matches) != 1:
            raise ValueError(f"Expected one brand annotation in {filename} page {page_number}.")
        annotation = matches[0]
        rect = annotation[NameObject("/Rect")]
        width = float(rect[2]) - float(rect[0])
        height = float(rect[3]) - float(rect[1])
        appearance_ref = make_appearance(writer, font_ref, width, height)
        annotation[NameObject("/AP")] = DictionaryObject({NameObject("/N"): appearance_ref})
    output = TEMP / f"{filename}.appearance.tmp.pdf"
    with output.open("wb") as target:
        writer.write(target)
    pending.append((filename, output))

for filename, output in pending:
    checked = PdfReader(output)
    for page_number, page in enumerate(checked.pages, start=1):
        if "Privileged and Confidential" in (page.extract_text() or ""):
            raise ValueError(f"Old wording remains in {filename} page {page_number}.")
        annotations = [item.get_object() for item in (page.get("/Annots") or [])]
        matches = [a for a in annotations if str(a.get("/Contents", "")) == LABEL]
        if len(matches) != 1 or "/AP" not in matches[0] or "/N" not in matches[0]["/AP"].get_object():
            raise ValueError(f"Missing brand appearance in {filename} page {page_number}.")

for filename, output in pending:
    os.replace(output, TERMS / filename)
    print(f"Added printable appearance to {filename}: {len(PdfReader(TERMS / filename).pages)} pages")
