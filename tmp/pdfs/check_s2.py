with open("d:/Saptagiri/website/OrianaaClub/tmp/pdfs/s2_output.txt", "w", encoding="utf-8") as out:
    for lang in ['hi', 'mr', 'gu']:
        content = open(f'd:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{lang}.html', encoding='utf-8').read()
        idx = content.find('Orianaa Hospitality')
        out.write(f"\n=== {lang} ===\n")
        out.write(content[idx-50:idx+300])
