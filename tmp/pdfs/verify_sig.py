import pymupdf

SIG_TEXT = "For and on behalf of Orianaa Prestige Club Pvt. Ltd."
for name in ['hi.pdf', 'mr.pdf', 'gu.pdf']:
    doc = pymupdf.open(f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}")
    last_text = doc[-1].get_text("text")
    has_sig = SIG_TEXT in last_text
    print(f"{name}: has SIG_TEXT? {has_sig}")
    for line in last_text.splitlines():
        if "behalf" in line.lower() or "prestige" in line.lower():
            print("  ", line)
