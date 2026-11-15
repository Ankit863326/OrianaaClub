"""
Use pymupdf redactions to remove old "Orianaa Hospitality & Lifestyle Pvt. Ltd."
signature text from hi.pdf, mr.pdf, gu.pdf and replace with
"For and on behalf of Orianaa Prestige Club Pvt. Ltd."
Also remove any previously overlaid Helvetica-Bold text to avoid duplicates.
"""
import fitz
import shutil

# Positions of old signature text (from inspection):
# hi.pdf: y=333.5 old text at [54.1,333.5,256.0,346.2] + translated at [256.2,334.3,351.9,346.9]
# mr.pdf: y=216.8 old text at [54.1,216.8,256.0,229.5] + translated at [256.2,217.5,344.1,230.1]
# gu.pdf: y=468.8 old text at [54.1,468.8,256.0,481.5] + translated at [256.2,469.5,333.9,482.1]

configs = {
    'hi': {
        'old_y_min': 330.0,
        'old_y_max': 350.0,
        'old_x_min': 50.0,
        'old_x_max': 360.0,
    },
    'mr': {
        'old_y_min': 213.0,
        'old_y_max': 233.0,
        'old_x_min': 50.0,
        'old_x_max': 350.0,
    },
    'gu': {
        'old_y_min': 465.0,
        'old_y_max': 485.0,
        'old_x_min': 50.0,
        'old_x_max': 340.0,
    },
}

SIG_TEXT = "For and on behalf of Orianaa Prestige Club Pvt. Ltd."

for lang, cfg in configs.items():
    path = f'd:/Saptagiri/website/OrianaaClub/Backend/terms/v1/{lang}.pdf'
    backup = f'd:/Saptagiri/website/OrianaaClub/tmp/pdfs/{lang}_before_redact.pdf'
    shutil.copy2(path, backup)
    print(f"\n=== Processing {lang}.pdf ===")

    doc = fitz.open(path)
    last_page = doc[-1]
    page_num = len(doc)

    # Define redaction rectangle covering old signature line
    redact_rect = fitz.Rect(
        cfg['old_x_min'],
        cfg['old_y_min'],
        cfg['old_x_max'],
        cfg['old_y_max']
    )

    print(f"  Redacting area: {redact_rect}")

    # Add redaction annotation (white fill to blank out old text)
    last_page.add_redact_annot(redact_rect, fill=(1, 1, 1))

    # Apply redactions - this physically removes the text content
    last_page.apply_redactions()

    # Now insert the new text
    # Use a point near the top-left of where old text was
    text_point = fitz.Point(cfg['old_x_min'] + 4, cfg['old_y_min'] + 13)
    last_page.insert_text(
        text_point,
        SIG_TEXT,
        fontname="helv",  # Helvetica
        fontsize=10.5,
        color=(0.15, 0.18, 0.22),  # Dark color similar to #263238
    )

    # Now also remove any duplicate Helvetica-Bold overlays from previous runs
    # These were added by the old overlay script at same y position
    # The redaction already removed everything in that rect, and we re-inserted clean text

    # Save to temp file then overwrite
    tmp_path = path + '.tmp'
    doc.save(tmp_path, deflate=True, garbage=4)
    doc.close()
    shutil.move(tmp_path, path)
    print(f"  Saved {lang}.pdf")

    # Verify
    doc2 = fitz.open(path)
    last2 = doc2[-1]
    text = last2.get_text()
    has_new = SIG_TEXT in text
    has_old = 'Hospitality' in text
    print(f"  Verify: has new sig = {has_new}, has old 'Hospitality' = {has_old}")
    doc2.close()

print("\nDone!")
