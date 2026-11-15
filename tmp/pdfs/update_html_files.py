from pathlib import Path

TERMS_DIR = Path("d:/Saptagiri/website/OrianaaClub/Backend/terms/v1")

# Update hi.html
hi_path = TERMS_DIR / "hi.html"
hi_content = hi_path.read_text(encoding="utf-8")
hi_content = hi_content.replace(
    "<p><strong>Orianaa Hospitality &amp; Lifestyle Pvt. Ltd. की ओर से एवं उसके\nलिए</strong></p>",
    "<p><strong>For and on behalf of Orianaa Prestige Club Pvt. Ltd.</strong></p>"
)
hi_content = hi_content.replace(
    "<strong>Orianaa Hospitality &amp; Lifestyle Pvt. Ltd.</strong>",
    "<strong>Orianaa Prestige Club Pvt. Ltd.</strong>"
)
hi_path.write_text(hi_content, encoding="utf-8")

# Update mr.html
mr_path = TERMS_DIR / "mr.html"
mr_content = mr_path.read_text(encoding="utf-8")
mr_content = mr_content.replace(
    "<p><strong>Orianaa Hospitality &amp; Lifestyle Pvt. Ltd. च्या वतीने व\nतिच्यासाठी</strong></p>",
    "<p><strong>For and on behalf of Orianaa Prestige Club Pvt. Ltd.</strong></p>"
)
mr_content = mr_content.replace(
    "<strong>Orianaa Hospitality &amp; Lifestyle Pvt. Ltd.</strong>",
    "<strong>Orianaa Prestige Club Pvt. Ltd.</strong>"
)
mr_path.write_text(mr_content, encoding="utf-8")

# Update gu.html
gu_path = TERMS_DIR / "gu.html"
gu_content = gu_path.read_text(encoding="utf-8")
gu_content = gu_content.replace(
    "<p><strong>Orianaa Hospitality &amp; Lifestyle Pvt. Ltd. વતી અને તેના\nમાટે</strong></p>",
    "<p><strong>For and on behalf of Orianaa Prestige Club Pvt. Ltd.</strong></p>"
)
gu_content = gu_content.replace(
    "<strong>Orianaa Hospitality &amp; Lifestyle Pvt. Ltd.</strong>",
    "<strong>Orianaa Prestige Club Pvt. Ltd.</strong>"
)
gu_path.write_text(gu_content, encoding="utf-8")

print("Updated hi.html, mr.html, gu.html successfully.")
