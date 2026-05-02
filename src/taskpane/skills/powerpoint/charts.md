# Charts — Working with Charts in PowerPoint

## Typed-API Gap: No Chart Creation or Mutation API

`PowerPoint.run` exposes chart shapes (`shape.type === "Chart"`) but provides **no typed API** for creating charts or reading/writing chart data series. This is a definitive gap — unlike Excel, which has `worksheet.charts.add(...)` and full `Chart` objects with series access, PowerPoint's `slide.shapes` collection has no `addChart` method.

To insert a new chart, package a `.pptx` file containing the chart slide and call `presentation.insertSlidesFromBase64(base64, options)`. See the `ooxml` skill.

Chart-specific metadata (series, categories, data values, chart type) is backed by an embedded Excel workbook that `PowerPoint.run` does not expose. Only the shape's geometry properties are accessible from within `PowerPoint.run`.

---

## Key Types

- `PowerPoint.Shape` — a chart shape has `type === "Chart"`. Geometry props (`top`, `left`, `width`, `height`, `rotation`) work like any shape.
- `PowerPoint.ShapeType` — the value for charts is the string `"Chart"`.
- `slide.shapes.addTable(...)` — the nearest typed analog if you want to display data without a chart (tables ARE in the typed API).
- `presentation.insertSlidesFromBase64(base64, options?)` — the insertion entry point for chart-bearing slides via OOXML.

---

## Listing All Chart Shapes on a Slide

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/name, items/type, items/left, items/top, items/width, items/height");
  await context.sync();

  const charts = shapes.items.filter(s => s.type === "Chart");
  if (charts.length === 0) {
    console.log("No chart shapes on this slide.");
    return;
  }

  for (const chart of charts) {
    console.log(
      `Chart "${chart.name}" — pos: (${chart.left}pt, ${chart.top}pt) size: ${chart.width}pt × ${chart.height}pt`
    );
  }
});
```

---

## Repositioning or Resizing a Chart Shape

Chart shapes support the same geometry properties as any other shape.

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/type, items/name");
  await context.sync();

  const chartShape = shapes.items.find(s => s.type === "Chart");
  if (chartShape) {
    const live = slide.shapes.getItem(chartShape.id);
    live.left   = 50;
    live.top    = 100;
    live.width  = 600;
    live.height = 400;
    await context.sync();
  }
});
```

---

## Inserting a Chart via OOXML Round-Trip (Sketch)

Because `slide.shapes.addChart` does not exist, chart insertion follows this pattern:

1. Build a `.pptx` file server-side (or obtain a template) containing a slide with the desired chart already populated with data.
2. Encode it as a base64 string.
3. Call `presentation.insertSlidesFromBase64(base64, options)` to merge that chart slide into the current presentation.

```javascript
// Assumes `base64PptxWithChart` is a base64 string for a .pptx containing
// a single slide with the chart pre-built (data embedded in the pptx).
await PowerPoint.run(async (context) => {
  context.presentation.insertSlidesFromBase64(base64PptxWithChart, {
    formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
  });
  await context.sync();
  console.log("Chart slide inserted.");
});
```

After insertion, reposition the chart shape using the geometry example above if needed.

---

## Deleting a Chart Shape

```javascript
await PowerPoint.run(async (context) => {
  const slide = context.presentation.slides.getItemAt(0);
  const shapes = slide.shapes;
  shapes.load("items/id, items/type");
  await context.sync();

  const toDelete = shapes.items.filter(s => s.type === "Chart");
  for (const chart of toDelete) {
    slide.shapes.getItem(chart.id).delete();
  }
  await context.sync();
});
```

---

## Common Mistakes

- **Assuming `slide.shapes.addChart(...)` exists**: This method does not exist in `PowerPoint.run`. Chart creation requires the OOXML round-trip pattern.
- **Trying to set chart data via shape properties**: `PowerPoint.Shape` has no `.chart`, `.series`, or `.data` sub-objects. Chart data lives in an embedded Excel workbook that `PowerPoint.run` cannot access.
- **Expecting chart type or series count to be readable**: Shape properties like `type`, `name`, and geometry work fine for chart shapes — but there is no API for reading the chart's series, categories, or chart type from `PowerPoint.run`.
- **Confusing PowerPoint with Excel chart APIs**: Excel's `worksheet.charts.add(...)` and `Chart.series.add(...)` have no equivalent in PowerPoint. Do not port Excel chart code into a PowerPoint context.
- **Using the `ooxml` skill for building `.pptx` from scratch**: Generating a valid `.pptx` with chart OOXML (including the embedded workbook) is complex and outside the scope of `PowerPoint.run`. Defer to a server-side tool or a user-supplied base64 template.
