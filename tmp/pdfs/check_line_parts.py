from pypdf import PdfReader

for name, target_y in [('hi.pdf', 498), ('mr.pdf', 615), ('gu.pdf', 363)]:
    reader = PdfReader(f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}")
    last_page = reader.pages[-1]
    
    parts = []
    def visitor(text, cm, tm, font_dict, font_size):
        if text.strip() and abs(tm[5] - target_y) < 15:
            parts.append((text, tm, font_dict.get('/BaseFont') if font_dict else None, font_size))
            
    last_page.extract_text(visitor_text=visitor)
    print(f"=== {name} parts near y={target_y} ===")
    for text, tm, font, size in parts:
        safe = text.encode("ascii", "replace").decode("ascii")
        print(f"  tm={tm}, font={font}, size={size}: '{safe}'")
