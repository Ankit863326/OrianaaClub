from pathlib import Path
from pypdf import PdfReader

for name in ["en.pdf", "gu.pdf", "hi.pdf", "mr.pdf", "membership-terms.pdf"]:
    p = Path(r"D:\Saptagiri\website\OrianaaClub\Backend\terms\v1") / name
    if p.exists():
        reader = PdfReader(p)
        print(f"{name}: {len(reader.pages)} pages, size={p.stat().st_size}")
