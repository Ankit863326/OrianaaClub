from pathlib import Path
from pypdf import PdfReader

terms_dir = Path(r"D:\Saptagiri\website\OrianaaClub\Backend\terms\v1")

for pdf_file in ["membership-terms.pdf", "en.pdf", "hi.pdf", "mr.pdf", "gu.pdf"]:
    p = terms_dir / pdf_file
    reader = PdfReader(p)
    last_page = reader.pages[-1]
    txt = last_page.extract_text() or ""
    print(f"=== {pdf_file} (Page {len(reader.pages)}) ===")
    for line in txt.splitlines():
        if line.strip():
            print("  ", line.strip().encode("ascii", "replace").decode("ascii"))
