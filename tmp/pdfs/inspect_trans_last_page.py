from pypdf import PdfReader
from pypdf.generic import ContentStream

for name in ['hi.pdf', 'mr.pdf', 'gu.pdf']:
    reader = PdfReader(f"d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{name}")
    last_page = reader.pages[-1]
    cs = ContentStream(last_page.get_contents(), reader)
    print(f"=== {name} Last Page Ops ({len(cs.operations)} ops) ===")
    for idx, (operands, op) in enumerate(cs.operations):
        if op in (b"Tj", b"TJ", b"'", b'"'):
            txt = str(operands)
            if "Orianaa" in txt or "Hospitality" in txt or "Lifestyle" in txt or "21." in txt:
                print(f"  {idx} {op}: {operands}")
                # preceding Td / Tm
                for b in range(idx-1, max(-1, idx-6), -1):
                    if cs.operations[b][1] in (b"Td", b"Tm"):
                        print(f"    preceding {cs.operations[b][1]}: {cs.operations[b][0]}")
                        break
