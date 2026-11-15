import subprocess, io
from pypdf import PdfReader
from pypdf.generic import ContentStream

res = subprocess.run(["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/en.pdf"], stdout=subprocess.PIPE, check=True)
reader = PdfReader(io.BytesIO(res.stdout))
print("Total pages in en.pdf:", len(reader.pages))
for page_num, page in enumerate(reader.pages, 1):
    cs = ContentStream(page.get_contents(), reader)
    found = []
    for idx, (operands, operator) in enumerate(cs.operations):
        if operator == b"Td" and operands == [420.15, 746.1]:
            # Next Tf and TJ
            tf_op = cs.operations[idx+1] if idx+1 < len(cs.operations) else None
            tj_op = cs.operations[idx+2] if idx+2 < len(cs.operations) else None
            found.append((idx, tf_op, tj_op))
    print(f"Page {page_num}: found={len(found)}")
