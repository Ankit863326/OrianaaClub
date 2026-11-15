import subprocess, io
from pypdf import PdfReader

res = subprocess.run(["git", "-C", "d:/Saptagiri/website/OrianaaClub", "show", "HEAD:Backend/terms/v1/en.pdf"], stdout=subprocess.PIPE, check=True)
reader = PdfReader(io.BytesIO(res.stdout))
page = reader.pages[0]
res_obj = page.get("/Resources")
f1 = res_obj.get("/Font").get("/F1").get_object()
print("en.pdf F1:", f1)
if "/ToUnicode" in f1:
    tu = f1["/ToUnicode"].get_object().get_data()
    print("ToUnicode:", tu.decode("latin1", "ignore")[:500])
