from pypdf import PdfReader

orig = PdfReader(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
page = orig.pages[0]
res = page.get("/Resources")
f1 = res.get("/Font").get("/F1").get_object()
first_char = f1.get("/FirstChar")
widths = f1.get("/Widths").get_object()

def get_width(text, size=11.04):
    return sum(widths[ord(c) - first_char] for c in text) * size / 1000.0

w_old = get_width("Privileged and Confidential")
w_new = get_width("Orianaa Prestige Club")
print("Old width:", w_old)
print("New width:", w_new)
# In original page 0: Tm is [1, 0, 0, 1, 419.95, 746.16]
# Right edge = 419.95 + w_old
right_edge = 419.95 + w_old
print("Right edge:", right_edge)
# If new string right edge aligns with right_edge:
new_x = right_edge - w_new
print("New x aligned to right:", new_x)
