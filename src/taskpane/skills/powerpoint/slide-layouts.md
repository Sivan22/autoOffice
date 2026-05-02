# Slide Layouts — Masters and Layouts

A PowerPoint deck is structured around slide masters, each of which owns a set of slide layouts. A layout defines placeholder arrangement and formatting for slides that use it. You can read which master and layout a slide uses, and enumerate all available layouts. Changing a slide's layout via direct property assignment is not a documented typed API — use the OOXML round-trip if you need to re-layout slides programmatically.

## Key Types

- `PowerPoint.SlideMasterCollection` — `presentation.slideMasters`. Ordered collection of all slide masters.
- `PowerPoint.SlideMaster` — single master. Properties: `id` (string), `name` (string), `layouts` (SlideLayoutCollection).
- `PowerPoint.SlideLayoutCollection` — `slideMaster.layouts`. All layouts under a master.
- `PowerPoint.SlideLayout` — single layout. Properties: `id` (string), `name` (string).
- `PowerPoint.Slide` — has proxy navigations: `slide.layout` (`SlideLayout`) and `slide.slideMaster` (`SlideMaster`).

## Structure Overview

```
Presentation
  └── slideMasters (SlideMasterCollection)
        └── SlideMaster  (id, name)
              └── layouts (SlideLayoutCollection)
                    └── SlideLayout  (id, name)

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
  masters.load("items/name");
  await context.sync();

  // Pick the first master.
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

The typed `PowerPoint.run` API does not expose a documented property assignment for `slide.layout` or `slide.slideMaster`. **Do not rely on `slide.layout = someLayout` — verify against current `@types/office-js` types before relying on direct assignment.** If the assignment is not supported in the version you are targeting, the correct approach is the OOXML round-trip: export the slide via `slide.exportAsBase64()`, modify the layout reference in the OOXML, and re-import via `presentation.insertSlidesFromBase64(...)`. See the `ooxml` skill.

## Common Mistakes

- **Assuming layout `name` is unique across masters** — two different masters can both have a layout named "Title Slide". Always scope layout lookups to a specific master.
- **Assuming `slide.layout` can be reassigned via direct property write** — this is not a documented typed mutation; verify against current `@types/office-js` types before relying on assignment. Use the OOXML round-trip if you need to change a slide's layout.
- **Not loading both levels before accessing layout names** — you must first sync after loading masters, then load each master's layouts, then sync again. Trying to read `master.layouts` before syncing masters returns an empty or invalid proxy.
- **Treating `SlideLayout.id` as a display number** — `id` is an opaque string identifier, not the 1-based layout index shown in the PowerPoint UI.
- **Using `getItemAt` to navigate into layouts without loading first** — always `load("items/id, items/name")` and sync before calling `find` or indexing into `layouts.items`.
