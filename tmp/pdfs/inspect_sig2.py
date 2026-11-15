import fitz

# Check what text surrounds the old signature line
for lang in ['hi','mr','gu']:
    path = f'd:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{lang}.pdf'
    doc = fitz.open(path)
    last = doc[-1]
    blocks = last.get_text('dict')['blocks']
    print(f'=== {lang}.pdf last page (page {len(doc)}) ===')
    for b in blocks:
        if 'lines' in b:
            for line in b['lines']:
                for span in line['spans']:
                    t = span['text'].strip()
                    if not t:
                        continue
                    bbox = span['bbox']
                    font = span['font']
                    size = span['size']
                    # Show all text near the signature area (y between 200 and 500)
                    if bbox[1] >= 200 and bbox[1] <= 520:
                        safe = t.encode('ascii', 'replace').decode()
                        print(f'  y={bbox[1]:.1f} [{bbox[0]:.1f},{bbox[1]:.1f},{bbox[2]:.1f},{bbox[3]:.1f}] font={font} size={size:.1f}: {safe}')
    doc.close()
    print()
