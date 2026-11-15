import pymupdf

for name in ['hi.pdf', 'mr.pdf', 'gu.pdf']:
    doc = pymupdf.open(f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}")
    last_page = doc[-1]
    print(f"=== {name} ===")
    print(last_page.get_text("text"))
