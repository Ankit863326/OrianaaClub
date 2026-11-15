import subprocess, io
from pypdf import PdfReader
from pypdf.generic import ContentStream

res = subprocess.run(["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/en.pdf"], stdout=subprocess.PIPE, check=True)
reader = PdfReader(io.BytesIO(res.stdout))
page = reader.pages[0]
cs = ContentStream(page.get_contents(), reader)
for idx, op in enumerate(cs.operations[:25]):
    print(idx, op)
