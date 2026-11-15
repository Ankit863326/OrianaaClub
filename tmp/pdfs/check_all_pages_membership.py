from pypdf import PdfReader
from pypdf.generic import ContentStream

orig = PdfReader(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
print("Total pages:", len(orig.pages))
for page_num, page in enumerate(orig.pages, 1):
    cs = ContentStream(page.get_contents(), orig)
    found = []
    for idx, (operands, operator) in enumerate(cs.operations):
        if operator == b"TJ":
            # flatten operand
            text_chunks = [x for x in operands[0] if isinstance(x, str)]
            full = "".join(text_chunks)
            if "rivil" in full or "idential" in full or "Privileged" in full:
                # Find preceding Tm or Td
                tm_op = None
                for back in range(idx, max(-1, idx - 10), -1):
                    if cs.operations[back][1] in (b"Tm", b"Td"):
                        tm_op = cs.operations[back]
                        break
                found.append((idx, full, tm_op))
    print(f"Page {page_num}: {found}")
