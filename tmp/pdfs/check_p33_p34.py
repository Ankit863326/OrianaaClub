from pathlib import Path
from pypdf import PdfReader

p = Path(r"D:\Saptagiri\website\OrianaaClub\Backend\terms\v1\membership-terms.pdf")
reader = PdfReader(p)
print("=== Page 33 ===")
print(reader.pages[32].extract_text())
print("=== Page 34 ===")
print(reader.pages[33].extract_text())
