from pypdf import PdfReader
from pypdf.generic import ContentStream

reader = PdfReader("d:/Saptagiri/website/OrianaaClub/Backend/terms/v1/hi.pdf")
last_page = reader.pages[-1]

# Check fonts on last page
fonts = last_page.get("/Resources", {}).get("/Font", {})
print("Fonts:", list(fonts.keys()))
for f_name, f_obj in fonts.items():
    f = f_obj.get_object()
    print(f_name, f.get("/BaseFont"), f.get("/Subtype"))
    if "/ToUnicode" in f:
        tu_data = f["/ToUnicode"].get_object().get_data().decode("latin1", "ignore")
        print(f"  ToUnicode len: {len(tu_data)}")
