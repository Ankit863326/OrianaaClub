from io import BytesIO
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import white, black
import pymupdf

TERMS_DIR = Path("d:/Saptagiri/website/OrianaaClub/Backend/terms/v1")
LABEL = "Orianaa Prestige Club"
SIG_TEXT = "For and on behalf of Orianaa Prestige Club Pvt. Ltd."

configs = [
    ('hi.pdf', 498.189),
    ('mr.pdf', 614.939),
    ('gu.pdf', 362.939),
]

for filename, sig_y in configs:
    src_path = TERMS_DIR / filename
    reader = PdfReader(src_path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    
    total_pages = len(writer.pages)
    for idx, page in enumerate(writer.pages):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        
        packet = BytesIO()
        can = canvas.Canvas(packet, pagesize=(width, height))
        
        # Header on every page:
        can.setFillColor(white)
        can.rect(400, height - 55, width - 400, 25, fill=1, stroke=0)
        can.setFont("Helvetica", 11)
        can.setFillColor(black)
        can.drawRightString(min(width - 43.15, 552.15), height - 46, LABEL)
        
        # Last page signature replacement
        if idx == total_pages - 1:
            can.setFillColor(white)
            can.rect(50, sig_y - 4, 500, 18, fill=1, stroke=0)
            can.setFont("Helvetica-Bold", 10.5)
            can.setFillColor(black)
            can.drawString(54.1, sig_y, SIG_TEXT)
            
        can.save()
        packet.seek(0)
        overlay_page = PdfReader(packet).pages[0]
        page.merge_page(overlay_page, over=True)
        page.compress_content_streams()
        
    out_buf = BytesIO()
    writer.write(out_buf)
    
    with open(src_path, "wb") as f:
        f.write(out_buf.getvalue())
        
    doc = pymupdf.open(src_path)
    assert len(doc) == total_pages
    last_text = doc[-1].get_text("text")
    assert SIG_TEXT in last_text, f"{filename} missing SIG_TEXT"
    print(f"Successfully processed {filename} ({total_pages} pages)")
