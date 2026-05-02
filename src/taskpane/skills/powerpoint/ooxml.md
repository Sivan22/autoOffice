# OOXML — Inserting and Exporting Slides via Base64 Round-Trip

`presentation.insertSlidesFromBase64` is the primary escape hatch in `PowerPoint.run` for
operations the typed API cannot handle directly: inserting images, charts, SmartArt, slides with
arbitrary layout content, or any shape type that lacks a dedicated `add*` method.

The base64 string must encode a **complete `.pptx` file** (a ZIP package of OOXML parts), not a
standalone XML fragment. Constructing that file from scratch is out of scope for `PowerPoint.run`
— agents should use a user-supplied base64 blob, a server-side template, or a round-tripped slide.

---

## Key Types

- **`presentation.insertSlidesFromBase64(base64File: string, options?: InsertSlideOptions): void`** — inserts slides from a source `.pptx` into the current presentation (PowerPointApi 1.2).
- **`PowerPoint.InsertSlideOptions`**:
  - `formatting?: PowerPoint.InsertSlideFormatting | "KeepSourceFormatting" | "UseDestinationTheme"` — defaults to `KeepSourceFormatting`.
  - `sourceSlideIds?: string[]` — IDs of slides to import from the source file; all slides are imported when omitted.
  - `targetSlideId?: string` — the slide in the *current* presentation after which new slides are inserted. When omitted, slides are inserted at the **beginning**. This is a slide **ID string**, not an index.
- **`PowerPoint.InsertSlideFormatting`** enum:
  - `keepSourceFormatting = "KeepSourceFormatting"` — preserve the source `.pptx` theme.
  - `useDestinationTheme = "UseDestinationTheme"` — apply the current presentation's theme.
- **`slide.exportAsBase64() → OfficeExtension.ClientResult<string>`** — exports a single slide as a base64-encoded `.pptx` (PowerPointApi 1.8).
- **`presentation.slides.exportAsBase64Presentation(values: Array<string | Slide>) → ClientResult<string>`** — exports a subset of slides (identified by ID string or `Slide` object) as a base64 `.pptx` (PowerPointApi 1.10).
- **`slideScopedCollection.exportAsBase64Presentation() → ClientResult<string>`** — exports all slides in a `SlideScopedCollection` (e.g. selected slides) as a base64 `.pptx` (PowerPointApi 1.10).

---

## Inserting Slides from a Base64 String

```javascript
// `base64Pptx` must be a complete base64-encoded .pptx file.
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  // Insert after the last slide in the presentation.
  const lastSlideId = slides.items[slides.items.length - 1].id;

  context.presentation.insertSlidesFromBase64(base64Pptx, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
    targetSlideId: lastSlideId,
  });
  await context.sync();
  console.log("Slides inserted.");
});
```

---

## Inserting Only Specific Source Slides

Use `sourceSlideIds` to cherry-pick which slides from the source `.pptx` to import.

```javascript
await PowerPoint.run(async (context) => {
  // sourceSlideIds are IDs from the *source* .pptx, not the current presentation.
  context.presentation.insertSlidesFromBase64(base64Pptx, {
    formatting: PowerPoint.InsertSlideFormatting.useDestinationTheme,
    sourceSlideIds: ["256,2", "512,3"],  // example IDs from source file
  });
  await context.sync();
  console.log("Selected source slides inserted.");
});
```

---

## Exporting a Single Slide to Base64

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const result = slide.exportAsBase64();
  await context.sync();

  // result.value is the base64-encoded .pptx containing this one slide.
  console.log("Exported slide base64 length:", result.value.length);
  // Can be passed back into insertSlidesFromBase64 later.
});
```

---

## Exporting a Subset of Slides

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  // Export slides at index 0 and 2.
  const ids = [slides.items[0].id, slides.items[2].id];
  const result = slides.exportAsBase64Presentation(ids);
  await context.sync();

  console.log("Multi-slide export base64 length:", result.value.length);
});
```

---

## Round-Trip Pattern (Export → Modify Externally → Re-Import)

When you need to modify slide content that the typed API cannot reach (e.g. chart data, SmartArt):

1. Export the slide(s) via `exportAsBase64`.
2. Send the base64 string to a server-side or external tool that edits the OOXML.
3. Delete the original slides (optional, to avoid duplicates).
4. Re-import via `insertSlidesFromBase64`.

```javascript
// Step 1: export and capture the previous slide's id (for re-insertion)
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  const slide = slides.getItemAt(1);
  const result = slide.exportAsBase64();
  await context.sync();

  const modifiedBase64 = await serverSideModify(result.value);  // external step

  // Step 2: capture the previous slide's ID before deletion
  const previousSlideId = slides.items[0].id;  // or slides.items.length > 2 ? slides.items[1].id : null
  
  // Step 3: delete the original slide
  slide.delete();
  
  // Step 4: re-import after the previous slide
  context.presentation.insertSlidesFromBase64(modifiedBase64, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
    targetSlideId: previousSlideId,
  });
  await context.sync();
  console.log("Round-trip complete.");
});
```

---

## Common Mistakes

- **Passing a single XML file instead of a full `.pptx` zip**: `insertSlidesFromBase64` expects a complete `.pptx` archive (ZIP containing `[Content_Types].xml`, `ppt/slides/slide1.xml`, etc.), not a bare XML snippet.
- **Forgetting `await context.sync()` after `insertSlidesFromBase64`**: The method queues an operation. Without `sync`, the insertion is never flushed to the host.
- **Treating `targetSlideId` as a numeric index**: It is a slide **ID string** (e.g. `"256,2"`), not a 0-based integer. Passing a number or an index will throw `SlideNotFound`.
- **Guessing `InsertSlideFormatting` values**: Use the enum (`PowerPoint.InsertSlideFormatting.keepSourceFormatting` / `useDestinationTheme`) or their exact string equivalents (`"KeepSourceFormatting"` / `"UseDestinationTheme"`). Misspelled string literals cause `InvalidArgument` errors.
- **Assuming `sourceSlideIds` uses the current presentation's IDs**: These IDs come from the *source* `.pptx` file, not from `context.presentation.slides`. You can learn them by round-tripping the source through a separate `PowerPoint.run` that reads `slides.items[n].id`.
- **Omitting `targetSlideId` expecting append**: When `targetSlideId` is omitted, slides are inserted at the **beginning** of the presentation, not the end. To append, load slide IDs first and pass the last slide's ID.
- **Building OOXML from scratch in `PowerPoint.run`**: Generating a valid `.pptx` requires packaging multiple XML parts and relationships inside a ZIP. This is out of scope for in-browser `PowerPoint.run` code. Use a server-side library (e.g. python-pptx, OpenXML SDK) or a user-supplied base64 template.
