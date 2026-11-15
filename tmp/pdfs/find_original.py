from pathlib import Path
from pypdf import PdfReader

p = Path(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
if p.exists():
    reader = PdfReader(p)
    print("original-membership.pdf pages:", len(reader.pages))
    for i, page in enumerate(reader.pages):
        txt = page.extract_text() or ""
        lines = [line.strip() for line in txt.splitlines() if "Privileged" in line or "Confidential" in line]
        if lines:
            print(f"Page {i+1}:")
            for line in lines:
                print(f"   {line}")
