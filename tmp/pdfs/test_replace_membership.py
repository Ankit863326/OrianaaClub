import subprocess, io
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, FloatObject, ArrayObject, TextStringObject

res = subprocess.run(
    ["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/membership-terms.pdf"],
    stdout=subprocess.PIPE,
    check=True
)
reader = PdfReader(io.BytesIO(res.stdout))
writer = PdfWriter()
writer.clone_document_from_reader(reader)

NEW_TEXT = TextStringObject("Orianaa Prestige Club")
NEW_X = FloatObject(443.86)

for page_idx, page in enumerate(writer.pages):
    cs = ContentStream(page.get_contents(), writer)
    replaced = False
    for idx, (operands, operator) in enumerate(cs.operations):
        if operator == b"TJ":
            chunks = [x for x in operands[0] if isinstance(x, str)]
            full = "".join(chunks)
            if "Privileged and Confidential" in full:
                # Replace TJ operands
                cs.operations[idx] = ([ArrayObject([NEW_TEXT])], b"TJ")
                # Adjust preceding Tm
                for back in range(idx - 1, max(-1, idx - 10), -1):
                    if cs.operations[back][1] == b"Tm":
                        tm_operands = list(cs.operations[back][0])
                        tm_operands[4] = NEW_X
                        cs.operations[back] = (ArrayObject(tm_operands), b"Tm")
                        break
                replaced = True
                break
    if not replaced:
        print(f"Warning: Page {page_idx + 1} did not find Privileged and Confidential")
    page.replace_contents(cs)

out_buf = io.BytesIO()
writer.write(out_buf)
out_bytes = out_buf.getvalue()

test_reader = PdfReader(io.BytesIO(out_bytes))
print("Test reader page count:", len(test_reader.pages))
issues = 0
for i, page in enumerate(test_reader.pages):
    txt = page.extract_text() or ""
    has_priv = "Privileged and Confidential" in txt
    has_brand = "Orianaa Prestige Club" in txt
    if has_priv or not has_brand:
        print(f"Page {i+1}: has_priv={has_priv}, has_brand={has_brand}")
        issues += 1

print("Issues:", issues)
print("Total bytes:", len(out_bytes))
