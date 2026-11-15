from pathlib import Path
from pypdf import PdfReader

for name in ['hi.pdf', 'mr.pdf', 'gu.pdf']:
    p = Path(r"D:\Saptagiri\website\OrianaaClub\Backend\terms\v1") / name
    reader = PdfReader(p)
    print(f"=== {name} ({len(reader.pages)} pages) ===")
    p1_txt = reader.pages[0].extract_text() or ""
    for l in p1_txt.splitlines()[:5]:
        print("Page 1 line:", l.encode("ascii", "replace").decode("ascii"))
    p_last_txt = reader.pages[-1].extract_text() or ""
    for line in p_last_txt.splitlines():
        if "Hospitality" in line or "Prestige" in line or "behalf" in line.lower() or "Pvt" in line:
            print("Last page:", line.encode("ascii", "replace").decode("ascii"))
