import fitz # PyMuPDF
from pathlib import Path

out_dir = Path("d:/Saptagiri/website/OrianaaClub/tmp/pdfs/renders")
out_dir.mkdir(exist_ok=True)

# 1. Render membership-terms.pdf page 1 and page 33
doc = fitz.open("d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/membership-terms.pdf")
doc[0].get_pixmap(dpi=150).save(str(out_dir / "membership_p1.png"))
doc[32].get_pixmap(dpi=150).save(str(out_dir / "membership_p33.png"))

# 2. Render hi, mr, gu last pages
for name in ['hi.pdf', 'mr.pdf', 'gu.pdf']:
    d = fitz.open(f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}")
    d[-1].get_pixmap(dpi=150).save(str(out_dir / f"{name}_last.png"))

print("Rendered images to:", out_dir)
