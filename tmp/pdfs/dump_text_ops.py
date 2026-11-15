from pypdf import PdfReader
from pypdf.generic import ContentStream

orig = PdfReader(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
page = orig.pages[0]
cs = ContentStream(page.get_contents(), orig)
for idx, (operands, operator) in enumerate(cs.operations):
    # Print text showing operators
    if operator in (b"Tj", b"TJ", b"'", b'"'):
        print(idx, operator, operands)
