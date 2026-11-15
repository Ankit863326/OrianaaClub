with open("d:/Saptagiri/website/OrianaaClub/tmp/pdfs/s21_output.txt", "w", encoding="utf-8") as out:
    for lang in ['hi', 'mr', 'gu', 'en']:
        content = open(f'd:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{lang}.html', encoding='utf-8').read()
        idx = content.find('id="s21"')
        if idx == -1:
            idx = content.find('id="s123"')
        out.write(f"\n=== {lang} ===\n")
        out.write(content[idx:idx+600])
