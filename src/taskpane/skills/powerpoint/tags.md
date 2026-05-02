# Tags — Working with Tags in PowerPoint

Tags are key-value string pairs you attach to a `Presentation`, `Slide`, or `Shape`. They are
invisible to the end-user, survive save and reopen, and are ideal for storing non-visual metadata
such as slide roles, shape identifiers, or workflow state.

---

## Key Types

- **`PowerPoint.Tag`** — a single tag with properties:
  - `readonly key: string` — always stored uppercased in the document (PowerPointApi 1.3)
  - `value: string` — the tag's payload (PowerPointApi 1.3)
- **`PowerPoint.TagCollection`** — the typed name of the collection (NOT `Tags`). Found on:
  - `context.presentation.tags`
  - `slide.tags`
  - `shape.tags`
- **`TagCollection` methods** (all PowerPointApi 1.3 unless noted):
  - `add(key: string, value: string): void` — upsert; if `key` already exists its value is replaced
  - `delete(key: string): void` — no-op if the key doesn't exist
  - `getCount(): OfficeExtension.ClientResult<number>`
  - `getItem(key: string): PowerPoint.Tag` — throws if not found
  - `getItemAt(index: number): PowerPoint.Tag` — zero-based index
  - `getItemOrNullObject(key: string): PowerPoint.Tag` — safe variant; check `tag.isNullObject`
  - `load(propertyNames)` — e.g. `load("items/key, items/value")`

> **Key casing:** `key` is case-insensitive on write and always uppercased in storage. Passing
> `"agenda"` and `"AGENDA"` refer to the same tag. After `sync`, reading `tag.key` returns the
> uppercased form.

---

## Adding and Reading a Tag on a Slide

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);

  // Upsert a tag. Key is case-insensitive — stored as "KIND".
  slide.tags.add("kind", "agenda");
  await context.sync();
  console.log("Tag added.");

  // Read it back.
  const tag = slide.tags.getItem("KIND");
  tag.load("key, value");
  await context.sync();
  console.log(`Tag: ${tag.key} = ${tag.value}`);  // "KIND = agenda"
});
```

---

## Listing All Tags on a Slide

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const tags = slide.tags;
  tags.load("items/key, items/value");
  await context.sync();

  if (tags.items.length === 0) {
    console.log("No tags on this slide.");
    return;
  }
  for (const tag of tags.items) {
    console.log(`${tag.key} = ${tag.value}`);
  }
});
```

---

## Finding a Slide by Tag Value

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  for (const slide of slides.items) {
    const liveSlide = context.presentation.slides.getItem(slide.id);
    liveSlide.tags.load("items/key, items/value");
    await context.sync();

    const agendaTag = liveSlide.tags.items.find(
      t => t.key === "KIND" && t.value === "agenda"
    );
    if (agendaTag) {
      console.log(`Agenda slide ID: ${slide.id}`);
      break;
    }
  }
});
```

---

## Tagging a Shape

Shape tags work identically to slide tags.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name");
  await context.sync();

  const target = shapes.items.find(s => s.name === "LogoPlaceholder");
  if (!target) return;

  slide.shapes.getItem(target.id).tags.add("placeholder-for", "user-logo");
  await context.sync();
  console.log("Shape tagged.");
});
```

---

## Deleting a Tag

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  slide.tags.delete("KIND");  // No-op if "KIND" doesn't exist.
  await context.sync();
  console.log("Tag deleted (or was never present).");
});
```

---

## Safe Tag Lookup with `getItemOrNullObject`

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const tag = slide.tags.getItemOrNullObject("OWNER");
  tag.load("key, value");
  await context.sync();

  if (tag.isNullObject) {
    console.log("OWNER tag not found.");
  } else {
    console.log(`Owner: ${tag.value}`);
  }
});
```

---

## Common Mistakes

- **Writing `TagCollection` as `Tags`**: The TypeScript type and runtime property are both `PowerPoint.TagCollection`. There is no `Tags` type.
- **Assuming `SlideMaster` and `SlideLayout` have tags**: Only `Presentation`, `Slide`, and `Shape` expose a `tags` property. `SlideMaster` and `SlideLayout` do NOT have a `tags` property, even though they are presentation entities.
- **Expecting lowercase keys after round-trip**: Keys are always stored uppercased. `slide.tags.getItem("status")` and `slide.tags.getItem("STATUS")` resolve to the same tag, but after sync `tag.key` will return `"STATUS"`.
- **Relying on tag iteration order**: The order of `tags.items` is not guaranteed; do not treat index 0 as the first-added tag.
- **Storing large payloads in `tag.value`**: Tags are meant for short metadata strings. Very large values may hit document size limits or degrade performance.
- **Confusing `tag.value` with `tag.key`**: `key` is the unique identifier; `value` is the payload. They are separate properties.
- **Reading `tag.key` or `tag.value` before sync**: These are proxy properties — always `load` and `await context.sync()` before reading.
- **Using `getItem(key)` without guarding**: `getItem` throws if the key is absent. Prefer `getItemOrNullObject(key)` and check `isNullObject` when existence is uncertain.
