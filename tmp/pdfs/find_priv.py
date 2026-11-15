from pathlib import Path
from pypdf import PdfReader

p = Path(r"D:\Saptagiri\website\OrianaaClub\Backend\terms\v1\membership-terms.pdf")
reader = PdfReader(p)
for i, page in enumerate(reader.pages):
    txt = page.extract_text() or ""
    lines = [line.strip() for line in txt.splitlines() if "Privileged" in line or "Confidential" in line]
    if lines:
        print(f"Page {i+1}:")
        for line in lines:
            print(f"   {line}")
