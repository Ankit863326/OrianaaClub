# Compliance risks

- Indian rules restrict the storage and display of Aadhaar numbers. Prefer DigiLocker or UIDAI offline e-KYC and avoid collecting or retaining Aadhaar data unless legally necessary.
- Family verification currently stores encrypted source documents plus a keyed hash and last four digits for duplicate detection. Restrict access, protect and rotate encryption keys, define retention/deletion periods, and complete a legal review before production use.
- The Aadhaar handling flow and member-facing notices require review by qualified Indian privacy and identity-compliance counsel.
- **Legal review required:** confirm the GST treatment, applicable GSTIN and HSN/SAC details, invoice numbering/series, and invoice language with Indian tax counsel and the company's tax adviser before issuing production invoices.
- **CA review required:** validate GST calculations, rounding, tax rates, invoice contents, and the handling of corrections or cancellations against current tax rules.
- **Legal review required:** define retention and deletion schedules for member profiles, verification decisions, audit records, invoices, payment records, Aadhaar hashes, and encrypted documents; confirm access, consent, and data-subject request procedures.
- **CA and legal review required:** confirm statutory retention periods and ensure deletion policies do not conflict with tax, accounting, dispute, or other legal obligations.
