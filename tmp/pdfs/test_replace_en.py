import subprocess, io
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, FloatObject, ArrayObject, ByteStringObject

res = subprocess.run(
    ["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/en.pdf"],
    stdout=subprocess.PIPE,
    check=True
)
reader = PdfReader(io.BytesIO(res.stdout))
writer = PdfWriter()
writer.clone_document_from_reader(reader)

mapping = {'n': 11, 'a': 10, 'e': 6, 'l': 5, 'P': 1, 'i': 3, 'O': 30, ' ': 9, 'C': 12, 't': 21, 'g': 7, 'u': 28, 'r': 2, 'b': 34, 's': 19}
target = "Orianaa Prestige Club"
encoded_bytes = ByteStringObject(bytes([mapping[c] for c in target]))
NEW_X = FloatObject(443.81)

for page_idx, page in enumerate(writer.pages):
    cs = ContentStream(page.get_contents(), writer)
    replaced = False
    for idx, (operands, operator) in enumerate(cs.operations):
        if operator == b"Td" and len(operands) == 2 and operands[0] == 420.15 and operands[1] == 746.1:
            # Modify Td x
            cs.operations[idx] = (ArrayObject([NEW_X, operands[1]]), b"Td")
            # The TJ operator is at idx+2
            # Let's verify operator at idx+2 is TJ
            if cs.operations[idx+2][1] == b"TJ":
                cs.operations[idx+2] = (ArrayObject([ArrayObject([encoded_bytes])]), b"TJ")
                replaced = True
                break
    if not replaced:
        print(f"Warning: Page {page_idx + 1} did not match Td [420.15, 746.1]")
    page.replace_contents(cs)
    page.compress_content_streams()

out_buf = io.BytesIO()
writer.write(out_buf)
out_bytes = out_buf.getvalue()

test_reader = PdfReader(io.BytesIO(out_bytes))
print("Test reader en.pdf page count:", len(test_reader.pages))
issues = 0
for i, page in enumerate(test_reader.pages):
    txt = page.extract_text() or ""
    has_priv = "Privileged and Confidential" in txt
    has_brand = "Orianaa Prestige Club" in txt
    if has_priv or not has_brand:
        print(f"Page {i+1}: has_priv={has_priv}, has_brand={has_brand}")
        issues += 1

print("Issues in en.pdf:", issues)
print("Total bytes in en.pdf:", len(out_bytes))
