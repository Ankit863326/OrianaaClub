import subprocess, io, os
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ContentStream,
    FloatObject,
    ArrayObject,
    TextStringObject,
    ByteStringObject,
)

ROOT = Path(r"D:\Saptagiri\website\OrianaaClub")
TERMS_DIR = ROOT / "Backend" / "terms" / "v1"

# 1. Update membership-terms.pdf (34 pages)
def process_membership_terms():
    # Read from HEAD to get pristine original structure
    res = subprocess.run(
        ["git", "-C", str(ROOT), "show", "HEAD:Backend/terms/v1/membership-terms.pdf"],
        stdout=subprocess.PIPE,
        check=True
    )
    reader = PdfReader(io.BytesIO(res.stdout))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)

    NEW_TEXT = TextStringObject("Orianaa Prestige Club")
    NEW_X = FloatObject(443.86)

    for page_idx, page in enumerate(writer.pages):
        cs = ContentStream(page.get_contents(), writer)
        replaced = False
        for idx, (operands, operator) in enumerate(cs.operations):
            if operator == b"TJ":
                chunks = [x for x in operands[0] if isinstance(x, str)]
                full = "".join(chunks)
                if "Privileged and Confidential" in full:
                    cs.operations[idx] = ([ArrayObject([NEW_TEXT])], b"TJ")
                    for back in range(idx - 1, max(-1, idx - 10), -1):
                        if cs.operations[back][1] == b"Tm":
                            tm_operands = list(cs.operations[back][0])
                            tm_operands[4] = NEW_X
                            cs.operations[back] = (ArrayObject(tm_operands), b"Tm")
                            break
                    replaced = True
                    break
        if not replaced:
            raise ValueError(f"membership-terms.pdf page {page_idx + 1}: header not found")
        page.replace_contents(cs)
        page.compress_content_streams()

    target_path = TERMS_DIR / "membership-terms.pdf"
    with open(target_path, "wb") as f:
        writer.write(f)

    # Validate
    val_reader = PdfReader(str(target_path))
    assert len(val_reader.pages) == 34, f"Expected 34 pages, got {len(val_reader.pages)}"
    for i, p in enumerate(val_reader.pages):
        txt = p.extract_text() or ""
        assert "Privileged and Confidential" not in txt, f"Old text on p{i+1}"
        assert "Orianaa Prestige Club" in txt, f"Missing new brand on p{i+1}"
    print(f"Successfully updated {target_path.name} (34 pages, {target_path.stat().st_size} bytes)")

# 2. Update en.pdf (31 pages)
def process_en_pdf():
    res = subprocess.run(
        ["git", "-C", str(ROOT), "show", "HEAD:Backend/terms/v1/en.pdf"],
        stdout=subprocess.PIPE,
        check=True
    )
    reader = PdfReader(io.BytesIO(res.stdout))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)

    mapping = {'n': 11, 'a': 10, 'e': 6, 'l': 5, 'P': 1, 'i': 3, 'O': 30, ' ': 9, 'C': 12, 't': 21, 'g': 7, 'u': 28, 'r': 2, 'b': 34, 's': 19}
    target = "Orianaa Prestige Club"
    encoded_bytes = ByteStringObject(bytes([mapping[c] for c in target]))
    NEW_X = FloatObject(443.81)

    for page_idx, page in enumerate(writer.pages):
        cs = ContentStream(page.get_contents(), writer)
        replaced = False
        for idx, (operands, operator) in enumerate(cs.operations):
            if operator == b"Td" and len(operands) == 2 and operands[0] == 420.15 and operands[1] == 746.1:
                cs.operations[idx] = (ArrayObject([NEW_X, operands[1]]), b"Td")
                if cs.operations[idx+2][1] == b"TJ":
                    cs.operations[idx+2] = (ArrayObject([ArrayObject([encoded_bytes])]), b"TJ")
                    replaced = True
                    break
        if not replaced:
            raise ValueError(f"en.pdf page {page_idx + 1}: header not found")
        page.replace_contents(cs)
        page.compress_content_streams()

    target_path = TERMS_DIR / "en.pdf"
    with open(target_path, "wb") as f:
        writer.write(f)

    # Validate
    val_reader = PdfReader(str(target_path))
    assert len(val_reader.pages) == 31, f"Expected 31 pages, got {len(val_reader.pages)}"
    for i, p in enumerate(val_reader.pages):
        txt = p.extract_text() or ""
        assert "Privileged and Confidential" not in txt, f"Old text on p{i+1}"
        assert "Orianaa Prestige Club" in txt, f"Missing new brand on p{i+1}"
    print(f"Successfully updated {target_path.name} (31 pages, {target_path.stat().st_size} bytes)")

if __name__ == "__main__":
    process_membership_terms()
    process_en_pdf()
