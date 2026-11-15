from pypdf import PdfReader

for name in ['hi.pdf', 'mr.pdf', 'gu.pdf']:
    reader = PdfReader(f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}")
    last_page = reader.pages[-1]
    
    parts = []
    def visitor(text, cm, tm, font_dict, font_size):
        if text.strip():
            parts.append((text, tm, font_dict.get('/BaseFont') if font_dict else None, font_size))
            
    last_page.extract_text(visitor_text=visitor)
    print(f"=== {name} visitor parts ===")
    for text, tm, font, size in parts[-15:]:
        safe = text.encode("ascii", "replace").decode("ascii")
        print(f"  tm={tm}, font={font}, size={size}: '{safe}'")
