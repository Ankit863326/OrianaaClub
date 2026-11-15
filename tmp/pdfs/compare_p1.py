from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream

orig = PdfReader(r"D:\Saptagiri\website\OrianaaClub\tmp\pdfs\original-membership.pdf")
curr = PdfReader(r"D:\Saptagiri\website\OrianaaClub\Backend\terms\v1\membership-terms.pdf")

print("Original page 1 operations:")
cs_orig = ContentStream(orig.pages[0].get_contents(), orig)
for op in cs_orig.operations:
    if any(b"Privileged" in str(arg).encode() or b"Confidential" in str(arg).encode() for arg in op[0]):
        print("  Found in orig:", op)

print("Current page 1 annotations:")
annots = curr.pages[0].get("/Annots")
if annots:
    for a in annots:
        obj = a.get_object()
        print("  Annot:", obj.get("/Subtype"), obj.get("/Contents"), obj.get("/Rect"), obj.get("/AP"))

print("Current page 1 operations:")
cs_curr = ContentStream(curr.pages[0].get_contents(), curr)
for op in cs_curr.operations:
    if any(b"Orianaa" in str(arg).encode() or b"Privileged" in str(arg).encode() for arg in op[0]):
        print("  Found in curr:", op)
