import subprocess, io
from pypdf import PdfReader

res = subprocess.run(
    ["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/membership-terms.pdf"],
    stdout=subprocess.PIPE,
    check=True
)
reader = PdfReader(io.BytesIO(res.stdout))
print("HEAD page 33:")
print(reader.pages[32].extract_text()[:400])
for line in reader.pages[32].extract_text().splitlines():
    if "behalf" in line.lower() or "for and" in line.lower() or "orianaa" in line.lower():
        print("  Line:", line)
