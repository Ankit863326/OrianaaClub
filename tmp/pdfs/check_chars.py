from pypdf import PdfReader

orig = PdfReader(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
page = orig.pages[0]
res = page.get("/Resources")
f1 = res.get("/Font").get("/F1").get_object()
first_char = f1.get("/FirstChar")
last_char = f1.get("/LastChar")
widths = f1.get("/Widths").get_object()

phrase = "Orianaa Prestige Club"
missing = []
for char in set(phrase):
    code = ord(char)
    if code < first_char or code > last_char:
        missing.append(char)
    else:
        w = widths[code - first_char]
        print(f"Char '{char}' (code {code}): width {w}")

print("Missing chars:", missing)
