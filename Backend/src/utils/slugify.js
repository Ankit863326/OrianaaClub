export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function createUniqueSlug(Model, title, documentId, fallback) {
  const base = slugify(title) || fallback;
  const excludedDocument = documentId ? { _id: { $ne: documentId } } : {};
  let candidate = base;
  let suffix = 2;

  while (await Model.exists({ slug: candidate, ...excludedDocument })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
