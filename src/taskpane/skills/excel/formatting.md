# Formatting — Font, Fill, Borders, Alignment, Row Height, Column Width

## Key Types
- `Excel.RangeFormat` — accessed via `range.format`. Top-level container for all visual formatting properties.
- `Excel.RangeFont` — `range.format.font`. Controls text appearance: `bold`, `italic`, `underline`, `name`, `size`, `color`, `strikethrough`.
- `Excel.RangeFill` — `range.format.fill`. Controls background: `color`, `clear()`.
- `Excel.RangeBorderCollection` — `range.format.borders`. Accessed per-edge via `getItem(Excel.BorderIndex.<edge>)`.
- `Excel.RangeUnderlineStyle` — enum for `font.underline`: `none`, `single`, `double`, `singleAccountant`, `doubleAccountant`.
- `Excel.BorderIndex` — enum identifying which border edge: `edgeTop`, `edgeBottom`, `edgeLeft`, `edgeRight`, `insideHorizontal`, `insideVertical`, `diagonalUp`, `diagonalDown`.
- `Excel.BorderLineStyle` — enum for `border.style`: `none`, `continuous`, `dash`, `dashDot`, `dashDotDot`, `dot`, `double`, `slantDashDot`.
- `Excel.BorderWeight` — enum for `border.weight`: `hairline`, `thin`, `medium`, `thick`.
- `Excel.HorizontalAlignment` — `general`, `left`, `center`, `right`, `fill`, `justify`, `centerAcrossSelection`, `distributed`.
- `Excel.VerticalAlignment` — `top`, `center`, `bottom`, `justify`, `distributed`.

---

## Font Properties

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:D1");

  const font = range.format.font;
  font.bold      = true;
  font.italic    = false;
  font.underline = Excel.RangeUnderlineStyle.single;
  font.name      = "Calibri";
  font.size      = 14;
  font.color     = "#1F3864"; // dark navy — 6-char hex with leading #
  font.strikethrough = false;

  await context.sync();
});
```

---

## Fill (Background) Color

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Set background color.
  const range = sheet.getRange("A1:D1");
  range.format.fill.color = "#D9E1F2"; // light blue

  // Clear the fill (reset to no fill / transparent).
  // Do NOT set fill.color = undefined or fill.color = "" — use clear() instead.
  const other = sheet.getRange("A2:D2");
  other.format.fill.clear();

  await context.sync();
});
```

---

## Borders

Each border edge is retrieved by name from the `borders` collection. Setting `style` is required to make a border visible; set `style` to `Excel.BorderLineStyle.none` to explicitly remove it.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("B2:D4");
  const borders = range.format.borders;

  // Bottom border — thick, dark gray.
  const bottom = borders.getItem(Excel.BorderIndex.edgeBottom);
  bottom.style  = Excel.BorderLineStyle.continuous;
  bottom.weight = Excel.BorderWeight.thick;
  bottom.color  = "#404040";

  // Top border — hairline.
  const top = borders.getItem(Excel.BorderIndex.edgeTop);
  top.style  = Excel.BorderLineStyle.continuous;
  top.weight = Excel.BorderWeight.hairline;
  top.color  = "#404040";

  // Inside horizontal grid lines — thin dashed.
  const insideH = borders.getItem(Excel.BorderIndex.insideHorizontal);
  insideH.style  = Excel.BorderLineStyle.dash;
  insideH.weight = Excel.BorderWeight.thin;
  insideH.color  = "#AAAAAA";

  await context.sync();
});
```

---

## Alignment and Text Wrap

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:E10");

  range.format.horizontalAlignment = Excel.HorizontalAlignment.center;
  range.format.verticalAlignment   = Excel.VerticalAlignment.bottom;
  range.format.wrapText            = true;
  range.format.indentLevel         = 1; // 0–250, shifts content to the right

  await context.sync();
});
```

---

## Row Height and Column Width

Heights and widths are in points (1 point ≈ 1/72 inch). Use `autofitRows()` / `autofitColumns()` to let Excel size them automatically based on content.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Set an explicit height for row 1 (range spanning that row).
  const headerRow = sheet.getRange("A1:Z1");
  headerRow.format.rowHeight = 30; // 30 points

  // Set an explicit width for column A.
  const colA = sheet.getRange("A:A");
  colA.format.columnWidth = 120; // 120 points ≈ ~17 characters

  await context.sync();
});
```

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const dataRange = sheet.getUsedRange(true);

  // Auto-size both rows and columns to fit their content.
  dataRange.format.autofitRows();
  dataRange.format.autofitColumns();

  await context.sync();
});
```

---

## Example 1 — Bold Header Row with Light-Gray Fill, Bottom Border, and Autofit

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Write sample headers.
  sheet.getRange("A1:D1").values = [["Name", "Region", "Sales", "Quota"]];

  // --- Style the header row ---
  const header = sheet.getRange("A1:D1");

  // Font
  header.format.font.bold  = true;
  header.format.font.size  = 12;
  header.format.font.color = "#FFFFFF";

  // Fill
  header.format.fill.color = "#2E74B5"; // blue background

  // Bottom border only
  const bottomBorder = header.format.borders.getItem(Excel.BorderIndex.edgeBottom);
  bottomBorder.style  = Excel.BorderLineStyle.continuous;
  bottomBorder.weight = Excel.BorderWeight.medium;
  bottomBorder.color  = "#1A4E8A";

  // Alignment
  header.format.horizontalAlignment = Excel.HorizontalAlignment.center;
  header.format.verticalAlignment   = Excel.VerticalAlignment.center;
  header.format.rowHeight           = 24;

  // Autofit column widths across the full used range.
  const used = sheet.getUsedRange(true);
  used.format.autofitColumns();

  await context.sync();
});
```

---

## Example 2 — Set All Four Edge Borders on a Range

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("B2:E6");
  const borders = range.format.borders;

  // Iterate the four outer edges and apply a uniform thin black border.
  const edges = [
    Excel.BorderIndex.edgeTop,
    Excel.BorderIndex.edgeBottom,
    Excel.BorderIndex.edgeLeft,
    Excel.BorderIndex.edgeRight,
  ];

  for (const edge of edges) {
    const border = borders.getItem(edge);
    border.style  = Excel.BorderLineStyle.continuous;
    border.weight = Excel.BorderWeight.thin;
    border.color  = "#000000";
  }

  await context.sync();
});
```

---

## Common Mistakes

- **Clearing fill with `fill.color = undefined` or `fill.color = ""`**: Setting `color` to `undefined` or an empty string does not clear the fill and may throw or silently fail. Use `range.format.fill.clear()` to remove the background.
- **Expecting a border to disappear without setting `style: none`**: Leaving a previously set border's `style` property alone keeps it visible. To remove a border, explicitly set `border.style = Excel.BorderLineStyle.none`.
- **Hex color format**: Colors must be a 6-character hex string. Both `"#FF0000"` and `"FF0000"` are accepted, but `"red"` or `"rgb(255,0,0)"` are not. Always use hex.
- **`insideHorizontal` / `insideVertical` on single-cell ranges**: Interior border edges only make visual sense on multi-cell ranges. On a single cell they are ignored.
- **Setting `indentLevel` with non-left alignment**: `indentLevel` only has an effect when `horizontalAlignment` is `left` (or `general` which defaults to left for text). Setting it while alignment is `center` or `right` has no visible effect.
- **`autofitColumns()` requires content to be committed**: Call `autofitColumns()` in the same or a later `Excel.run` after values have been written and synced, or at minimum ensure the write and the autofit are in the same batch before `await context.sync()`.
