import subprocess, io
from pypdf import PdfReader

res = subprocess.run(["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/en.pdf"], stdout=subprocess.PIPE, check=True)
reader = PdfReader(io.BytesIO(res.stdout))
f1 = reader.pages[0].get("/Resources").get("/Font").get("/F1").get_object()
tu = f1["/ToUnicode"].get_object().get_data().decode("latin1", "ignore")

char_to_code = {}
for line in tu.splitlines():
    parts = line.strip().split()
    if len(parts) == 2 and parts[0].startswith("<") and parts[1].startswith("<"):
        c_code = int(parts[0].strip("<>"), 16)
        u_hex = parts[1].strip("<>")
        # convert hex to unicode char
        try:
            if len(u_hex) == 4:
                u_char = chr(int(u_hex, 16))
                char_to_code[u_char] = c_code
        except:
            pass

target = "Orianaa Prestige Club"
missing = [c for c in set(target) if c not in char_to_code]
print("Found mapping for chars:", {c: char_to_code.get(c) for c in set(target)})
print("Missing:", missing)
