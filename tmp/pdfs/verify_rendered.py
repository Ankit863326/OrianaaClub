import pymupdf

doc = pymupdf.open("d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/membership-terms.pdf")
page = doc[0]
rect = pymupdf.Rect(350, 20, 580, 80)
text_in_header = page.get_text("text", clip=rect)
print("Header text in membership-terms.pdf p1:", repr(text_in_header))

page33 = doc[32]
rect_sig = pymupdf.Rect(50, 400, 550, 700)
print("Signature text in membership-terms.pdf p33:\n", page33.get_text("text", clip=rect_sig))
