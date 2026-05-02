# Presentation — Top-Level Presentation Object

`context.presentation` is the root of the PowerPoint object model inside `PowerPoint.run`. It gives access to metadata, the slide collection, slide masters, and selection state. Most structural changes to the deck flow through this object.

## Key Types

- `PowerPoint.Presentation` — accessed via `context.presentation`. Properties: `title`, `id`, `slides`, `slideMasters`, `tags`, `bindings`, `customXmlParts`, `pageSetup`, `properties`.
- `PowerPoint.SlideCollection` — `presentation.slides`. Ordered collection of all slides. Methods: `add(options?)`, `getItem(id)`, `getItemAt(index)`, `getItemOrNullObject(id)`, `getCount()`, `exportAsBase64Presentation(values)`.
- `PowerPoint.SlideMasterCollection` — `presentation.slideMasters`. Collection of all slide masters in the deck.
- `PowerPoint.TagCollection` — `presentation.tags`. Key-value metadata attached to the presentation. See the `tags` skill.
- `PowerPoint.DocumentProperties` — `presentation.properties`. Document-level metadata (title, author, subject, etc.).

## Presentation Properties

| Property | Type | Notes |
|---|---|---|
| `title` | `string` | The deck's internal title metadata, **not** the file name. Must be loaded before reading. |
| `id` | `string` | Unique presentation ID. Must be loaded before reading. |
| `slides` | `SlideCollection` | All slides, in order. |
| `slideMasters` | `SlideMasterCollection` | All slide masters. |
| `tags` | `TagCollection` | Presentation-level key-value metadata. |
| `bindings` | `BindingCollection` | Bindings associated with the presentation (PowerPointApi 1.8). |
| `customXmlParts` | `CustomXmlPartCollection` | Custom XML parts (PowerPointApi 1.7). |
| `pageSetup` | `PageSetup` | Slide size and orientation (PowerPointApi 1.10). |
| `properties` | `DocumentProperties` | Document metadata: author, subject, etc. (PowerPointApi 1.7). |

## Presentation Methods

| Method | Description |
|---|---|
| `getSelectedSlides()` | Returns a `SlideScopedCollection` of currently selected slides. |
| `getSelectedShapes()` | Returns a `ShapeScopedCollection` of currently selected shapes on the current slide. |
| `getSelectedTextRange()` | Returns the `TextRange` of the currently selected text. Throws if no text is selected. |
| `getSelectedTextRangeOrNullObject()` | Safe variant — returns a null-object if no text is selected; check `isNullObject`. |
| `insertSlidesFromBase64(base64File, options?)` | Inserts slides from a base64-encoded `.pptx` file. Primary path for adding slides with complex content. See the `ooxml` skill. |
| `setSelectedSlides(slideIds)` | Sets the slide selection to the given array of slide ID strings. |

## Load and Read Title and Slide Count

Properties are not populated until `load()` + `await context.sync()`. Load comma-separated property names in a single string.

```javascript
await PowerPoint.run(async (context) => {
  const presentation = context.presentation;
  const slides = presentation.slides;

  presentation.load("title, id");
  slides.load("items/id");
  await context.sync();

  console.log("Title:", presentation.title);
  console.log("ID:", presentation.id);
  console.log("Slide count:", slides.items.length);
});
```

## Access All Slides

Use the `slides` collection and load the sub-properties you need across all items in one sync.

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id, items/index");
  await context.sync();

  slides.items.forEach((slide) => {
    console.log(`Slide index=${slide.index}, id=${slide.id}`);
  });
});
```

## Access All Slide Masters

```javascript
await PowerPoint.run(async (context) => {
  const masters = context.presentation.slideMasters;
  masters.load("items/id, items/name");
  await context.sync();

  masters.items.forEach((master) => {
    console.log(`Master: ${master.name} (id=${master.id})`);
  });
});
```

## Add a New Slide

`presentation.slides.add(options?)` adds a blank slide (PowerPointApi 1.3). It returns `void` — to work with the new slide, re-query the collection after sync. Pass `slideMasterId` and/or `layoutId` to control which master and layout are used.

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;

  // Add a slide using the default master and its first layout.
  slides.add();
  await context.sync();

  // Re-query to get the new slide (it was appended to the end).
  slides.load("items/id");
  await context.sync();
  console.log("New slide count:", slides.items.length);
});
```

See the `slides` skill for the full `add()` pattern with a specific layout.

## Insert Slides from Base64 (OOXML Round-Trip)

For slides with complex content (specific layouts, tables, charts), build a `.pptx` file, base64-encode it, and call `insertSlidesFromBase64`. Slides are appended by default; use `options.targetSlideId` to control position.

```javascript
await PowerPoint.run(async (context) => {
  // base64Pptx is a base64-encoded complete .pptx file (not a URL, not raw XML).
  const base64Pptx = "...";

  context.presentation.insertSlidesFromBase64(base64Pptx, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
  });

  await context.sync();
});
```

See the `ooxml` skill for full patterns on constructing and round-tripping `.pptx` files.

## Read the Currently Selected Slides

```javascript
await PowerPoint.run(async (context) => {
  const selectedSlides = context.presentation.getSelectedSlides();
  selectedSlides.load("items/id");
  await context.sync();

  if (selectedSlides.items.length === 0) {
    console.log("No slides selected.");
  } else {
    selectedSlides.items.forEach((slide) => {
      console.log("Selected slide id:", slide.id);
    });
  }
});
```

## PageSetup: Slide Dimensions

The `pageSetup` property exposes slide dimensions in points. It has two read/write properties:

- `slideWidth: number` — width of slides in points (PowerPointApi 1.10)
- `slideHeight: number` — height of slides in points (PowerPointApi 1.10)

```javascript
await PowerPoint.run(async (context) => {
  const pageSetup = context.presentation.pageSetup;
  pageSetup.load("slideWidth, slideHeight");
  await context.sync();
  console.log(`Slide is ${pageSetup.slideWidth} x ${pageSetup.slideHeight} pt`);
});
```

## Common Mistakes

- **Assuming `presentation.save()` exists**: There is no API to programmatically save or export the presentation file from within `PowerPoint.run`. The user must save manually.
- **Treating `title` as the file name**: `presentation.title` is the internal metadata title (from File > Properties), not the `.pptx` filename. They may differ.
- **Reading `title` without `load`**: Like all proxy properties, `title` is `undefined` until you call `presentation.load("title")` + `await context.sync()`.
- **Passing a URL or XML fragment to `insertSlidesFromBase64`**: The argument must be a base64-encoded complete `.pptx` zip package. A URL or a raw XML string will fail. See the `ooxml` skill.
- **Calling `getSelectedTextRange()` unconditionally**: When no text is selected, this method throws. Use `getSelectedTextRangeOrNullObject()` and check `isNullObject`, or wrap in a try/catch. See the `selection` skill.
- **Assuming `slides.add()` returns the new slide**: The method returns `void`. Re-query the collection after sync to access the newly added slide.
- **Accessing `pageSetup.slideSize`**: There is no nested `slideSize` object. Dimensions are flat properties on `pageSetup`: use `pageSetup.slideWidth` and `pageSetup.slideHeight` directly (both in points, both read/write).
