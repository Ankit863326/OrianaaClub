for lang in ['hi', 'mr', 'gu', 'en']:
    content = open(f'd:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{lang}.html', encoding='utf-8').read()
    idx = content.find('id="s21"')
    if idx == -1:
        idx = content.find('id="s123"')
    print(f"=== {lang} ===")
    print(content[idx:idx+500])
