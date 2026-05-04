# Charts — Creating, Configuring, and Styling Excel Charts

## Key Types
- `Excel.ChartCollection` — `worksheet.charts`. Method `add(chartType, sourceRange, seriesBy)` returns a `Chart`.
- `Excel.Chart` — top-level chart object. Properties: `name`, `title`, `axes`, `legend`, `series`, `left`, `top`, `width`, `height`. Methods: `setPosition(startCell, endCell)`, `delete()`.
- `Excel.ChartTitle` — `chart.title`. Properties: `text`, `visible`.
- `Excel.ChartAxes` — `chart.axes`. Sub-objects: `valueAxis`, `categoryAxis`, `seriesAxis`.
- `Excel.ChartAxis` — one axis. Property: `title` (a `ChartAxisTitle` with `.text` and `.visible`).
- `Excel.ChartLegend` — `chart.legend`. Properties: `visible`, `position` (Excel.ChartLegendPosition).
- `Excel.ChartSeriesCollection` — `chart.series`. Method: `getItemAt(index)`.
- `Excel.ChartSeries` — one data series. Properties: `name`, `markerStyle`. Sub-objects: `format.fill`, `format.line`.
- `Excel.ChartType` — enum of chart types.
- `Excel.ChartSeriesBy` — enum: `auto`, `columns`, `rows`.
- `Excel.ChartLegendPosition` — enum: `top`, `bottom`, `left`, `right`, `corner`, `custom`.

---

## Common Chart Types

| `Excel.ChartType` member | Visual |
|---|---|
| `columnClustered` | Vertical grouped bars |
| `columnStacked` | Vertical stacked bars |
| `barClustered` | Horizontal grouped bars |
| `line` | Line chart (no markers) |
| `lineMarkers` | Line chart with markers |
| `pie` | Pie chart |
| `doughnut` | Doughnut chart |
| `area` | Area chart |
| `xyscatter` | Scatter (XY) plot |
| `xyscatterSmooth` | Scatter with smooth curves |

---

## Creating a Chart

`worksheet.charts.add(chartType, sourceRange, seriesBy)` — `sourceRange` must be a **Range object**, not a string address. The returned `Chart` is already inserted in the sheet.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Source data must already exist in the range.
  const sourceRange = sheet.getRange("B2:D8");

  const chart = sheet.charts.add(
    Excel.ChartType.columnClustered,
    sourceRange,
    Excel.ChartSeriesBy.auto
  );

  await context.sync();
});
```

---

## Title

```javascript
chart.title.text    = "Sales 2026";
chart.title.visible = true;
```

---

## Axis Titles

Both `valueAxis` and `categoryAxis` expose a `title` sub-object with `text` and `visible`.

```javascript
chart.axes.valueAxis.title.text       = "Revenue (USD)";
chart.axes.valueAxis.title.visible    = true;

chart.axes.categoryAxis.title.text    = "Quarter";
chart.axes.categoryAxis.title.visible = true;
```

---

## Legend

```javascript
chart.legend.visible  = true;
chart.legend.position = Excel.ChartLegendPosition.bottom;
```

---

## Position and Size

Use `setPosition(topLeftCell, bottomRightCell)` to anchor the chart to cell addresses (strings). Alternatively set `left`, `top`, `width`, `height` directly in points.

```javascript
// Anchor to cells — most portable approach.
chart.setPosition("A10", "F25");

// Or use explicit point coordinates.
chart.left   = 0;
chart.top    = 200;
chart.width  = 480;
chart.height = 300;
```

---

## Chart Name

Assign a name to make the chart easy to retrieve later.

```javascript
chart.name = "SalesChart";

// Later, in the same or a new Excel.run:
const found = sheet.charts.getItem("SalesChart");
```

---

## Accessing and Styling Series

`chart.series.getItemAt(index)` (zero-based) returns a `ChartSeries`. Set fill color, line color, and marker style.

```javascript
const series0 = chart.series.getItemAt(0);
series0.format.fill.setSolidColor("#0078D4");  // solid fill
series0.format.line.color = "#005A9E";          // border/line color

// For line/marker charts:
series0.markerStyle = Excel.ChartMarkerStyle.circle;
```

---

## Delete a Chart

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const chart = sheet.charts.getItem("SalesChart");
  chart.delete();
  await context.sync();
});
```

---

## Example 1 — Column-Clustered Chart from `B2:D8` with Titles and Positioned Location

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Seed data: header row + 6 data rows, 3 series.
  sheet.getRange("B2:D8").values = [
    ["Quarter", "Product A", "Product B"],
    ["Q1", 42000, 31000],
    ["Q2", 55000, 38000],
    ["Q3", 48000, 42000],
    ["Q4", 61000, 57000],
    ["Q5", 53000, 45000],
    ["Q6", 70000, 62000],
  ];

  // Create the chart.
  const sourceRange = sheet.getRange("B2:D8");
  const chart = sheet.charts.add(
    Excel.ChartType.columnClustered,
    sourceRange,
    Excel.ChartSeriesBy.columns
  );

  // Name the chart for later retrieval.
  chart.name = "SalesChart";

  // Title.
  chart.title.text    = "Sales 2026";
  chart.title.visible = true;

  // Axis titles.
  chart.axes.valueAxis.title.text       = "Revenue (USD)";
  chart.axes.valueAxis.title.visible    = true;
  chart.axes.categoryAxis.title.text    = "Quarter";
  chart.axes.categoryAxis.title.visible = true;

  // Legend at the bottom.
  chart.legend.visible  = true;
  chart.legend.position = Excel.ChartLegendPosition.bottom;

  // Position: top-left at A10, bottom-right at G28.
  chart.setPosition("A10", "G28");

  await context.sync();
});
```

---

## Example 2 — Change the Color of the First Series

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const chart = sheet.charts.getItem("SalesChart");

  // Recolor the first series to a custom blue.
  const series0 = chart.series.getItemAt(0);
  series0.format.fill.setSolidColor("#0078D4");
  series0.format.line.color = "#005A9E";

  await context.sync();
});
```

---

## Common Mistakes

- **Passing a string address instead of a Range object**: `sheet.charts.add(Excel.ChartType.columnClustered, "B2:D8", ...)` throws. Always use `sheet.getRange("B2:D8")` to get a Range object first, then pass that.
- **Reading chart properties before sync**: Properties like `chart.left`, `chart.width`, or `series.name` must be loaded and synced before reading. Queuing a property write does not require load+sync, but reading does.
- **Auto-generated chart name**: If you don't set `chart.name`, Excel assigns a generic name like `"Chart 1"`. Retrieving it later via `getItem` requires knowing that generated name. Always set `chart.name` when you plan to look up the chart later.
- **`series.getItemAt` index is zero-based**: The first series is `getItemAt(0)`, not `getItemAt(1)`.
- **`setPosition` cell addresses are strings**: Pass string cell addresses like `"A10"`, not Range objects.
- **`format.fill.setSolidColor` vs `format.fill.color`**: For chart series fill, use `setSolidColor(hex)` (a method). The direct `.color` property setter works on `RangeFill` but series fill uses `setSolidColor`.
