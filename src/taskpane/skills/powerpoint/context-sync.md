# Context, PowerPoint.run, and Sync

`PowerPoint.run` opens a `PowerPoint.RequestContext`, runs your async callback, then flushes any queued operations. Inside the callback, `context.presentation` is the root proxy for the open presentation. All reads require `load()` + `await context.sync()` before values are available.

## Key Types

- `PowerPoint.RequestContext` — the `context` argument inside `PowerPoint.run`. Exposes `context.presentation`.
- `PowerPoint.Presentation` — top-level proxy: `title`, `slides`, `slideMasters`, `tags`.
- Proxy objects — every object returned by the API is a client-side proxy. Property values are **not** populated until you call `load()` + `await context.sync()`.

## How PowerPoint.run Works

`PowerPoint.run` opens a request context, executes your async callback, then automatically calls `context.sync()` once more at the end. All PowerPoint API calls must happen inside this callback.

```javascript
await PowerPoint.run(async (context) => {
  // All PowerPoint operations happen here.
  // context.presentation is always available without load/sync.
});
```

The auto-sync at the end flushes pending writes (formatting, property sets, deletions). It does **not** bring property values back to the client — if you need to read a value, you must explicitly `load()` and `await context.sync()` before accessing it.

## The Proxy Object Model

When you access a property such as `presentation.title` before calling `load("title")` + `context.sync()`, you get `undefined`. The Office.js runtime queues operations server-side; `context.sync()` sends the batch and returns the populated values.

```javascript
await PowerPoint.run(async (context) => {
  const presentation = context.presentation;

  // WRONG — presentation.title is undefined here.
  // console.log(presentation.title);

  presentation.load("title");
  await context.sync();

  // CORRECT — value is now populated.
  console.log("Title:", presentation.title);
});
```

## Difference from Excel.run

`PowerPoint.run` and `Excel.run` share the same proxy/load/sync model. The key differences for PowerPoint:

- There is no `context.application` — use `context.presentation` as the sole entry point.
- PowerPoint has no calculation engine, so there is no equivalent of `suspendApiCalculationUntilNextSync`.
- Many presentation-level operations (saving, exporting, inserting new slides) use dedicated methods such as `presentation.insertSlidesFromBase64(...)` rather than typed collection additions. See the `ooxml` skill.

## Reading a Collection

To iterate a collection, load the collection's `items` together with the sub-properties you need using slash notation. After `context.sync()`, use `collection.items` to access individual proxy objects.

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  slides.items.forEach((slide, index) => {
    console.log(`Slide ${index}: id=${slide.id}`);
  });
});
```

Loading `"items/id"` fetches the `id` property for every item in one round-trip. To load multiple sub-properties, use a comma-separated list: `"items/id, items/layout"`.

## Chaining Proxy Objects

You can chain proxy calls before any sync — the runtime queues them all and resolves them together at the next `context.sync()`.

```javascript
await PowerPoint.run(async (context) => {
  const presentation = context.presentation;
  const slides = presentation.slides;

  presentation.load("title");
  slides.load("items/id");
  await context.sync();

  console.log("Title:", presentation.title);
  console.log("Slide count:", slides.items.length);
});
```

## Avoiding Sync Inside a Loop

Calling `await context.sync()` inside a loop causes one round-trip per iteration. Batch all loads before the loop, sync once, then read values.

```javascript
// BAD — one network round-trip per slide.
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  for (const slide of slides.items) {
    slide.shapes.load("items/name");
    await context.sync(); // <-- do NOT do this in a loop
    console.log(slide.shapes.items.map((s) => s.name));
  }
});

// GOOD — load all at once, single sync.
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  slides.items.forEach((slide) => slide.shapes.load("items/name"));
  await context.sync(); // One sync for all slides.

  slides.items.forEach((slide) => {
    console.log(slide.shapes.items.map((s) => s.name));
  });
});
```

## Common Mistakes

- Reading a proxy property before calling `load()` + `await context.sync()` — the value will be `undefined`.
- Calling `load()` but forgetting `await context.sync()` before accessing the returned value.
- Calling `await context.sync()` inside a `for` loop — causes one round-trip per iteration; batch loads instead.
- Assuming the final auto-sync at the end of `PowerPoint.run` brings property values back to the client — it flushes queued writes only; reads still need an explicit `load` + `sync`.
- Forgetting that `context.presentation` is a proxy — you do not need to `load` it to use it, but you do need to `load` its individual properties before reading them.
