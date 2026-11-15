from pypdf import PdfReader

for name in ['hi.pdf', 'mr.pdf', 'gu.pdf']:
    reader = PdfReader(f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}")
    last_page = reader.pages[-1]
    
    parts = []
    def visitor(text, cm, tm, font_dict, font_size):
        if text.strip():
            parts.append((text, tm, font_dict.get('/BaseFont') if font_dict else None, font_size))
            
    last_page.extract_text(visitor_text=visitor)
    print(f"=== {name} Orianaa parts ===")
    for text, tm, font, size in parts:
        if "Orianaa" in text or "Hospitality" in text or "Lifestyle" in text or "Prestige" in text:
            print(f"  tm={tm}, font={font}, size={size}: '{text}'")
