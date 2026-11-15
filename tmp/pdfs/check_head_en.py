import subprocess
from pypdf import PdfReader
import io

res = subprocess.run(["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/en.pdf"], stdout=subprocess.PIPE, check=True)
reader = PdfReader(io.BytesIO(res.stdout))
print("HEAD en.pdf pages:", len(reader.pages))
for i, page in enumerate(reader.pages):
    txt = page.extract_text() or ""
    lines = [line.strip() for line in txt.splitlines() if "Privileged" in line or "Confidential" in line]
    if lines:
        print(f"Page {i+1}:")
        for line in lines:
            print(f"   {line}")
