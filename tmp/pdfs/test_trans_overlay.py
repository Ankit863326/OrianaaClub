from io import BytesIO
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import white, black

for name, y_pos in [('hi.pdf', 498.189), ('mr.pdf', 614.939), ('gu.pdf', 362.939)]:
    path = f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}"
    reader = PdfReader(path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    
    # 1. Overlay for header on all pages
    # 2. On last page, also cover the old signature line and draw "For and on behalf of Orianaa Prestige Club Pvt. Ltd."
    LABEL = "Orianaa Prestige Club"
    SIG_TEXT = "For and on behalf of Orianaa Prestige Club Pvt. Ltd."
    
    for i, page in enumerate(writer.pages):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        
        packet = BytesIO()
        can = canvas.Canvas(packet, pagesize=(width, height))
        
        # Header (if not already on page)
        can.setFont("Helvetica", 11)
        can.setFillColor(black)
        can.drawRightString(min(width - 43.15, 552.15), height - 46, LABEL)
        
        # If last page, overlay signature
        if i == len(writer.pages) - 1:
            can.setFillColor(white)
            can.rect(50, y_pos - 4, 500, 18, fill=1, stroke=0)
            can.setFont("Helvetica-Bold", 10.5)
            can.setFillColor(black)
            can.drawString(54.1, y_pos, SIG_TEXT)
            
        can.save()
        packet.seek(0)
        overlay_page = PdfReader(packet).pages[0]
        page.merge_page(overlay_page, over=True)
        page.compress_content_streams()
        
    out_packet = BytesIO()
    writer.write(out_packet)
    val_reader = PdfReader(BytesIO(out_packet.getvalue()))
    last_text = val_reader.pages[-1].extract_text()
    print(f"=== {name} ===")
    print("Has SIG_TEXT in last page?", SIG_TEXT in last_text)
    for l in last_text.splitlines():
        if "behalf" in l.lower() or "prestige" in l.lower():
            print("  Found line:", l)
