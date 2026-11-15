import subprocess, io
from pypdf import PdfReader

res = subprocess.run(["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/en.pdf"], stdout=subprocess.PIPE, check=True)
reader = PdfReader(io.BytesIO(res.stdout))
f1 = reader.pages[0].get("/Resources").get("/Font").get("/F1").get_object()
widths = f1["/Widths"]

target = "Orianaa Prestige Club"
# map using char_to_code
# from previous run:
mapping = {'n': 11, 'a': 10, 'e': 6, 'l': 5, 'P': 1, 'i': 3, 'O': 30, ' ': 9, 'C': 12, 't': 21, 'g': 7, 'u': 28, 'r': 2, 'b': 34, 's': 19}
encoded_bytes = bytes([mapping[c] for c in target])
total_w = sum(widths[b] for b in encoded_bytes) * 11.0 / 1000.0

# Old width
# old header was: 420.15 Td, followed by 11 Tf, and:
# ['\x01\x02\x03\x04\x03\x05\x06\x07\x06\x08\t\n\x0b\x08\t\x0c\r\x0b\x0e', -1, '\x08', 2, '\x06\x0b\x0f\n', 1, '\x05']
# Let's calculate old right edge
old_bytes = [1, 2, 3, 4, 3, 5, 6, 7, 6, 8, 9, 10, 11, 8, 9, 12, 13, 11, 14, 8, 6, 11, 15, 10, 5]
old_w = sum(widths[b] for b in old_bytes) * 11.0 / 1000.0
print("Old width in en.pdf:", old_w)
print("New width in en.pdf:", total_w)
old_right = 420.15 + old_w
new_left = old_right - total_w
print(f"Old right edge: {old_right}, new left to match right: {new_left}")
