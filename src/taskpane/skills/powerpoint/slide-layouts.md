# Slide Layouts — Masters and Layouts

A PowerPoint deck is structured around slide masters, each of which owns a set of slide layouts. A layout defines placeholder arrangement and formatting for slides that use it. You can read which master and layout a slide uses, enumerate all available layouts, and apply a different layout to a slide using `slide.applyLayout(slideLayout)` (PowerPointApi 1.8).

## Key Types

- `PowerPoint.SlideMasterCollection` — `presentation.slideMasters`. Ordered collection of all slide masters.
- `PowerPoint.SlideMaster` — single master. Properties: `id` (string), `name` (string), `layouts` (`SlideLayoutCollection`), `shapes`, `background`, `customXmlParts`, `themeColorScheme`.
- `PowerPoint.SlideLayoutCollection` — `slideMaster.layouts`. All layouts under a master.
- `PowerPoint.SlideLayout` — single layout. Properties: `id` (string), `name` (string), `type` (`SlideLayoutType`), `shapes`, `background`, `customXmlParts`, `themeColorScheme`.
- `PowerPoint.Slide` — has proxy navigations: `slide.layout` (`SlideLayout`) and `slide.slideMaster` (`SlideMaster`). Method: `applyLayout(slideLayout)`.

## Structure Overview

```
Presentation
  └── slideMasters (SlideMasterCollection)
        └── SlideMaster  (id, name)
              └── layouts (SlideLayoutCollection)
                    └── SlideLayout  (id, name, type)

Slide
  ├── layout      → SlideLayout  (read via slide.layout.load(...))
  └── slideMaster → SlideMaster  (read via slide.slideMaster.load(...))
```

## List Every Layout Name Across Every Master

Load masters, then for each master load its layouts. Two syncs are needed because the layout collection is a child of each master.

```javascript
await PowerPoint.run(async (context) => {
  const masters = context.presentation.slideMasters;
  masters.load("items/id, items/name");
  await context.sync();

  // Load layouts for all masters in one batch before syncing again.
  masters.items.forEach((master) => {
    master.layouts.load("items/id, items/name");
  });
  await context.sync();

  masters.items.forEach((master) => {
    console.log(`Master: ${master.name}`);
    master.layouts.items.forEach((layout) => {
      console.log(`  Layout: ${layout.name} (id=${layout.id})`);
    });
  });
});
```

## Read the Layout of a Specific Slide

`slide.layout` is a proxy. Load it after getting the slide proxy.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  slide.layout.load("id, name");
  await context.sync();

  console.log("Slide layout:", slide.layout.name, "(id=" + slide.layout.id + ")");
});
```

## Read the Slide Master of a Specific Slide

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  slide.slideMaster.load("id, name");
  await context.sync();

  console.log("Slide master:", slide.slideMaster.name, "(id=" + slide.slideMaster.id + ")");
});
```

## Read Both Layout and Master for All Slides

```javascript
await PowerPoint.run(async (context) => {
  const slides = context.presentation.slides;
  slides.load("items/id");
  await context.sync();

  // Load layout and master for each slide in one batch.
  slides.items.forEach((slide) => {
    slide.layout.load("name");
    slide.slideMaster.load("name");
  });
  await context.sync();

  slides.items.forEach((slide, index) => {
    console.log(
      `Slide ${index + 1}: master="${slide.slideMaster.name}", layout="${slide.layout.name}"`
    );
  });
});
```

## Find a Layout by Name Under a Given Master

Layout names are not guaranteed to be unique across masters. Always scope your lookup to a specific master.

```javascript
await PowerPoint.run(async (context) => {
  const masters = context.presentation.slideMasters;
  masters.load("items/id, items/name");
  await context.sync();

  const master = masters.getItemAt(0);
  master.layouts.load("items/id, items/name");
  await context.sync();

  const targetName = "Title and Content";
  const match = master.layouts.items.find((l) => l.name === targetName);

  if (match) {
    console.log(`Found layout "${targetName}" with id=${match.id}`);
  } else {
    console.log(`Layout "${targetName}" not found in this master.`);
  }
});
```

## Applying a Layout to a Slide

`slide.applyLayout(slideLayout)` (PowerPointApi 1.8) is a typed API for reassigning a slide's layout. The `slideLayout` argument must be a `SlideLayout` object belonging to the slide's current `SlideMaster`. Passing a layout from a different master will throw.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);

  // Load the slide's current master so we can query its layouts.
  slide.slideMaster.load("id");
  await context.sync();

  // Load the layouts of the slide's own master.
  slide.slideMaster.layouts.load("items/id, items/name");
  await context.sync();

  const targetName = "Blank";
  const layout = slide.slideMaster.layouts.items.find((l) => l.name === targetName);

  if (layout) {
    slide.applyLayout(layout);
    await context.sync();
    console.log(`Applied layout "${targetName}" to slide.`);
  } else {
    console.log(`Layout "${targetName}" not found on this slide's master.`);
  }
});
```

## Common Mistakes

- **Assuming layout `name` is unique across masters** — two different masters can both have a layout named "Title Slide". Always scope layout lookups to a specific master.
- **Passing a layout from a different master to `applyLayout`** — the layout must belong to the slide's current `SlideMaster`. Passing a layout from a different master will throw at runtime.
- **Not loading both levels before accessing layout names** — you must sync after loading masters, then load each master's layouts, then sync again. Reading `master.layouts` before syncing masters returns an empty or invalid proxy.
- **Treating `SlideLayout.id` as a display number** — `id` is an opaque string identifier, not the 1-based layout index shown in the PowerPoint UI.
- **Using `getItemAt` to navigate into layouts without loading first** — always `load("items/id, items/name")` and sync before calling `find` or indexing into `layouts.items`.
- **Assuming `SlideLayout` has a `tags` property** — `SlideLayout` does not expose `tags` in the verified `@types/office-js` types. Only `Slide` and `Presentation` expose `tags` (`TagCollection`).
