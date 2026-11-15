from pathlib import Path
from pypdf import PdfReader

terms_dir = Path(r"D:\Saptagiri\website\OrianaaClub\Backend\terms\v1")
for f in terms_dir.glob("*.pdf"):
    reader = PdfReader(f)
    print(f"=== {f.name} ({len(reader.pages)} pages) ===")
    for i, p in enumerate(reader.pages):
        txt = p.extract_text() or ""
        priv = "Privileged" in txt or "Confidential" in txt
        brand = "Orianaa Prestige Club" in txt
        annots = p.get("/Annots")
        annot_count = len(annots) if annots else 0
        print(f"  p{i+1}: Priv/Conf={priv}, Brand={brand}, annots={annot_count}")
