# Context, PowerPoint.run, and Sync

`PowerPoint.run` opens a `PowerPoint.RequestContext`, runs your async callback, and flushes queued operations. Inside the callback, `context.presentation` is the root proxy for the open presentation. All reads require `load()` + `await context.sync()` before values are available.

## Key Types

- `PowerPoint.RequestContext` — the `context` argument inside `PowerPoint.run`. Exposes `context.presentation`.
- `PowerPoint.Presentation` — top-level proxy: `title`, `id`, `slides`, `slideMasters`, `tags`.
- Proxy objects — every object returned by the API is a client-side proxy. Property values are **not** populated until you call `load()` + `await context.sync()`.

## How PowerPoint.run Works

`PowerPoint.run` opens a request context, executes your async callback, and flushes queued operations when you `await context.sync()` or when the run callback returns. All PowerPoint API calls must happen inside this callback.

```javascript
await PowerPoint.run(async (context) => {
  // All PowerPoint operations happen here.
  // context.presentation is always available without load/sync.
});
```

Queued operations are flushed when you `await context.sync()` or when the `PowerPoint.run` callback returns. Always `load` + `sync` explicitly before reading a property — do not rely on the run callback's flush to bring values back to the client.

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

`PowerPoint.run` and `Excel.run` share the same proxy/load/sync model. Key differences for PowerPoint:

- There is no `context.application` — use `context.presentation` as the sole entry point.
- PowerPoint has no calculation engine, so there is no equivalent of `suspendApiCalculationUntilNextSync`.
- Adding slides uses `presentation.slides.add(options?)` (typed API) or `presentation.insertSlidesFromBase64(...)` for OOXML round-trips. See the `slides` and `ooxml` skills.

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

Loading `"items/id"` fetches the `id` property for every item in one round-trip. To load multiple sub-properties, use a comma-separated list: `"items/id, items/index"`.

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
- Assuming the run callback's automatic flush at exit brings property values back to the client — it does not. Reads always need an explicit `load` + `sync`.
- Forgetting that `context.presentation` is a proxy — you do not need to `load` it to use it, but you do need to `load` its individual properties before reading them.
