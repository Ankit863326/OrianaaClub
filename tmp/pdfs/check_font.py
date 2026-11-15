from pypdf import PdfReader

orig = PdfReader(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
page = orig.pages[0]
res = page.get("/Resources")
fonts = res.get("/Font")
print("Fonts:", fonts)
f1 = fonts.get("/F1")
print("F1:", f1.get_object())
