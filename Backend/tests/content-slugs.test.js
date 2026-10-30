import Post from '../src/models/Post.js';
import Event from '../src/models/Event.js';
import { slugify } from '../src/utils/slugify.js';

function contentValues(Model, title, overrides = {}) {
  if (Model === Post) {
    return {
      title,
      excerpt: 'A short editorial excerpt.',
      content: 'Full editorial content.',
      category: 'Travel',
      ...overrides,
    };
  }

  return {
    title,
    description: 'A club event.',
    date: new Date('2030-01-01T12:00:00.000Z'),
    location: 'Mumbai',
    ...overrides,
  };
}

describe.each([
  ['post', Post],
  ['event', Event],
])('%s slug generation', (name, Model) => {
  test('generates a slug from a normal title', async () => {
    const record = await Model.create(contentValues(Model, `Orianaa ${name} celebration`));
    expect(record.slug).toBe(`orianaa-${name}-celebration`);
  });

  test('normalizes special characters and accents', async () => {
    const record = await Model.create(contentValues(Model, 'Café & Sunsets: 50% Off!'));
    expect(record.slug).toBe('cafe-sunsets-50-off');
  });

  test('adds a numeric suffix to duplicate generated slugs', async () => {
    const title = `Shared ${name} title`;
    const generatedSlug = slugify(title);
    const first = await Model.create(contentValues(Model, title, { slug: generatedSlug }));
    const second = await Model.create(contentValues(Model, title, { slug: generatedSlug }));
    const third = await Model.create(contentValues(Model, title, { slug: generatedSlug }));

    expect([first.slug, second.slug, third.slug]).toEqual([
      `shared-${name}-title`,
      `shared-${name}-title-2`,
      `shared-${name}-title-3`,
    ]);
  });

  test('preserves a manually supplied slug and an existing slug on title edits', async () => {
    const record = await Model.create(contentValues(Model, `Original ${name}`, { slug: `custom-${name}` }));
    record.title = `Renamed ${name}`;
    await record.save();

    expect(record.slug).toBe(`custom-${name}`);
  });
});
