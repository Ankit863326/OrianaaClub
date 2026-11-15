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

for page in writer.pages:
    cs = ContentStream(page.get_contents(), writer)
    for idx, (operands, operator) in enumerate(cs.operations):
        if operator == b"TJ":
            chunks = [x for x in operands[0] if isinstance(x, str)]
            if "Privileged and Confidential" in "".join(chunks):
                cs.operations[idx] = ([ArrayObject([NEW_TEXT])], b"TJ")
                for back in range(idx - 1, max(-1, idx - 10), -1):
                    if cs.operations[back][1] == b"Tm":
                        tm_operands = list(cs.operations[back][0])
                        tm_operands[4] = NEW_X
                        cs.operations[back] = (ArrayObject(tm_operands), b"Tm")
                        break
                break
    page.replace_contents(cs)
    page.compress_content_streams()

out_buf = io.BytesIO()
writer.write(out_buf)
out_bytes = out_buf.getvalue()
print("Compressed total bytes:", len(out_bytes))
