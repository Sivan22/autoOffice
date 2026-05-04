# Page Setup — Margins, Orientation, Paper Size

## Key Types
- `Word.PageSetup` — margins (top, bottom, left, right), orientation, pageWidth, pageHeight
- `Word.Section.pageSetup` — per-section page layout
- `Word.PageOrientation` — portrait | landscape
- All measurements are in **points** (1 inch = 72 points)

## Read Page Setup

```javascript
await Word.run(async (context) => {
  const section = context.document.sections.getFirst();
  const ps = section.pageSetup;
  ps.load("topMargin,bottomMargin,leftMargin,rightMargin,orientation,pageWidth,pageHeight");
  await context.sync();

  return {
    topMargin: ps.topMargin,       // points
    bottomMargin: ps.bottomMargin,
    leftMargin: ps.leftMargin,
    rightMargin: ps.rightMargin,
    orientation: ps.orientation,   // "portrait" or "landscape"
    pageWidth: ps.pageWidth,
    pageHeight: ps.pageHeight,
  };
});
```

## Set Page Margins (1 inch = 72 points)

```javascript
await Word.run(async (context) => {
  const section = context.document.sections.getFirst();
  const ps = section.pageSetup;

  ps.topMargin    = 72;   // 1 inch
  ps.bottomMargin = 72;
  ps.leftMargin   = 90;   // 1.25 inches
  ps.rightMargin  = 90;

  await context.sync();
});
```

## Set Landscape Orientation

```javascript
await Word.run(async (context) => {
  const section = context.document.sections.getFirst();
  const ps = section.pageSetup;

  ps.orientation = Word.PageOrientation.landscape;
  // Swap width/height when changing orientation
  ps.pageWidth  = 792;  // 11 inches
  ps.pageHeight = 612;  // 8.5 inches

  await context.sync();
});
```

## Set Portrait Orientation

```javascript
await Word.run(async (context) => {
  const section = context.document.sections.getFirst();
  const ps = section.pageSetup;

  ps.orientation = Word.PageOrientation.portrait;
  ps.pageWidth  = 612;  // 8.5 inches
  ps.pageHeight = 792;  // 11 inches

  await context.sync();
});
```

## Set A4 Paper Size

```javascript
await Word.run(async (context) => {
  const section = context.document.sections.getFirst();
  const ps = section.pageSetup;

  ps.pageWidth  = 595;  // 210 mm ≈ 595 pt
  ps.pageHeight = 842;  // 297 mm ≈ 842 pt

  await context.sync();
});
```

## Apply Different Page Setup per Section

```javascript
await Word.run(async (context) => {
  const sections = context.document.sections;
  sections.load("items");
  await context.sync();

  // Make the second section landscape
  if (sections.items.length > 1) {
    const ps = sections.items[1].pageSetup;
    ps.orientation = Word.PageOrientation.landscape;
    ps.pageWidth  = 792;
    ps.pageHeight = 612;
  }

  await context.sync();
});
```

## Common Paper Sizes (points)

| Paper | Width | Height |
|---|---|---|
| US Letter | 612 | 792 |
| US Legal | 612 | 1008 |
| A4 | 595 | 842 |
| A3 | 842 | 1191 |

## Common Pitfalls

- All margin and dimension values are in **points**, not inches or mm
- When switching orientation, always set both `pageWidth` and `pageHeight` — Word does not swap them automatically
- `pageSetup` is on `Word.Section`, not on `Word.Document` or `Word.Body`
- To apply to the whole document, iterate `context.document.sections.items` and update each section
- Requires Word JS API 1.5 or later
