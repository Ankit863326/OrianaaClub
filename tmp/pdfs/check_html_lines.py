for lang in ['hi', 'mr', 'gu', 'en']:
    content = open(f'd:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{lang}.html', encoding='utf-8').read()
    for line in content.splitlines():
        if 'Hospitality' in line or 'Prestige' in line or 'behalf of' in line.lower() or '21.' in line:
            print(f"{lang}: {line.strip()[:100].encode('ascii', 'replace').decode('ascii')}")
