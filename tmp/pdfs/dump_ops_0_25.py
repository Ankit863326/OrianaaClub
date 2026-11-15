from pypdf import PdfReader
from pypdf.generic import ContentStream

orig = PdfReader(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
page = orig.pages[0]
cs = ContentStream(page.get_contents(), orig)
for idx in range(25):
    print(idx, cs.operations[idx])
