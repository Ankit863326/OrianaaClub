import fitz

SIG = "For and on behalf of Orianaa Prestige Club Pvt. Ltd."
HDR = "Orianaa Prestige Club"

for lang in ['hi', 'mr', 'gu']:
    path = f'd:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{lang}.pdf'
    doc = fitz.open(path)
    total = len(doc)
    hdr_count = 0
    for i, page in enumerate(doc):
        text = page.get_text()
        if HDR in text:
            hdr_count += 1
    
    last_text = doc[-1].get_text()
    has_sig = SIG in last_text
    has_old = 'Hospitality' in last_text or 'Lifestyle' in last_text
    
    print(f'{lang}.pdf: {total} pages, header on {hdr_count}/{total} pages, sig={has_sig}, old_text={has_old}')
    doc.close()
