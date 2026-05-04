# Styles — Named Styles, Built-in Styles, and Custom Styles

## Key Types
- `Excel.StyleCollection` — `context.workbook.styles`. Methods: `getItem(name)`, `add(name)`, iterate via `load("items/name")` then `.items`.
- `Excel.Style` — a named bundle of formatting (font, fill, borders, number format, alignment). Key properties: `font`, `fill`, `borders`, `numberFormat`, `horizontalAlignment`, `verticalAlignment`, `wrapText`, `includeFont`, `includeFill`, `includeBorder`, `includeNumber`, `includeAlignment`, `includePatterns`.
- `Excel.Range.style` — a string property. Assign a style name (built-in or custom) to apply it to a range.

---

## Built-in Named Styles

Excel ships with a set of named styles accessible through the API by their English names regardless of the UI language:

| Category | Style Name |
|---|---|
| General | `"Normal"` |
| Data/Model | `"Good"`, `"Bad"`, `"Neutral"`, `"Calculation"`, `"Input"`, `"Output"`, `"Note"`, `"Warning Text"`, `"Explanatory Text"`, `"Check Cell"`, `"Linked Cell"` |
| Headings | `"Heading 1"`, `"Heading 2"`, `"Heading 3"`, `"Heading 4"`, `"Title"`, `"Total"` |
| Number | `"Currency"`, `"Comma"`, `"Percent"` |

---

## Applying a Built-in Style to a Range

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Apply "Heading 1" to the header row.
  sheet.getRange("A1:D1").style = "Heading 1";

  // Apply "Total" to a totals row.
  sheet.getRange("A10:D10").style = "Total";

  await context.sync();
});
```

---

## Retrieving a Style from the Collection

```javascript
await Excel.run(async (context) => {
  const goodStyle = context.workbook.styles.getItem("Good");

  // Load font properties to inspect them.
  goodStyle.load("font/color, font/bold");
  await context.sync();

  console.log("Good style font color:", goodStyle.font.color);
  console.log("Good style bold:", goodStyle.font.bold);
});
```

---

## Listing All Available Styles

```javascript
await Excel.run(async (context) => {
  const styles = context.workbook.styles;

  // Load the name of every style in the collection.
  styles.load("items/name");
  await context.sync();

  const names = styles.items.map(s => s.name);
  console.log("Styles:", names);
});
```

---

## Creating a Custom Style

Create a new style with `styles.add(name)`, configure its properties, then apply it to ranges by setting `range.style = name`.

```javascript
await Excel.run(async (context) => {
  const workbook = context.workbook;

  // Add a custom style (throws if name already exists — guard with try/catch).
  let myStyle;
  try {
    myStyle = workbook.styles.add("HighlightData");
  } catch {
    myStyle = workbook.styles.getItem("HighlightData");
  }

  // Configure the style's properties.
  myStyle.font.bold  = true;
  myStyle.font.color = "#1A3A5C";
  myStyle.font.size  = 11;

  myStyle.fill.color = "#D9E2F3"; // light blue background

  // Apply to specific border edges.
  const bottom = myStyle.borders.getItem(Excel.BorderIndex.edgeBottom);
  bottom.style  = Excel.BorderLineStyle.continuous;
  bottom.weight = Excel.BorderWeight.thin;
  bottom.color  = "#2E74B5";

  myStyle.numberFormat      = "#,##0.00";
  myStyle.horizontalAlignment = Excel.HorizontalAlignment.right;

  await context.sync();
});
```

Then in the same or a later run, apply it:

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Apply the custom style to a data range.
  sheet.getRange("B2:D11").style = "HighlightData";

  await context.sync();
});
```

---

## Example 1 — Apply Built-in Styles to Header Row and a Currency Column

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();

  // Write data.
  sheet.getRange("A1:C1").values = [["Product", "Amount", "Status"]];
  sheet.getRange("A2:C4").values = [
    ["Widget A", 1200.5, "Good"],
    ["Widget B",  980.0, "Bad"],
    ["Widget C", 1450.0, "Good"],
  ];

  // "Heading 1" for the header row.
  sheet.getRange("A1:C1").style = "Heading 1";

  // "Currency" style for the amount column (applies built-in currency number format).
  sheet.getRange("B2:B4").style = "Currency";

  // "Good" / "Bad" data model styles for status cells (demonstrates per-cell style).
  sheet.getRange("C2").style = "Good";
  sheet.getRange("C3").style = "Bad";
  sheet.getRange("C4").style = "Good";

  await context.sync();
});
```

---

## Example 2 — Define a Custom Style with Bold, Fill, and Border, Then Apply It

```javascript
await Excel.run(async (context) => {
  const workbook = context.workbook;
  const sheet    = workbook.worksheets.getActiveWorksheet();

  // Create or retrieve the custom style.
  let summaryStyle;
  try {
    summaryStyle = workbook.styles.add("SummaryRow");
  } catch {
    summaryStyle = workbook.styles.getItem("SummaryRow");
  }

  // Font
  summaryStyle.font.bold  = true;
  summaryStyle.font.size  = 11;
  summaryStyle.font.color = "#1A1A1A";

  // Fill
  summaryStyle.fill.color = "#F2F2F2"; // light gray

  // Top border to visually separate from data rows.
  const topBorder = summaryStyle.borders.getItem(Excel.BorderIndex.edgeTop);
  topBorder.style  = Excel.BorderLineStyle.double;
  topBorder.weight = Excel.BorderWeight.thin;
  topBorder.color  = "#595959";

  // Number format
  summaryStyle.numberFormat = "#,##0";

  await context.sync();

  // Apply to a totals row.
  sheet.getRange("A6:C6").style = "SummaryRow";

  await context.sync();
});
```

---

## Common Mistakes

- **Direct format properties override the style**: Setting `range.style = "Heading 1"` and then immediately setting `range.format.font.bold = false` will override the style's bold setting. Direct format properties applied after a style assignment win. Apply style first, then apply only the overrides you truly need.
- **Assuming style names are localized in the API**: Built-in style names like `"Heading 1"` and `"Good"` work in the API regardless of the Excel UI language. The English strings are canonical in the JavaScript API — do not translate them.
- **Adding a style that already exists**: `styles.add(name)` throws if the style name already exists in the workbook (including built-in names). Wrap it in a try/catch and fall back to `styles.getItem(name)` when the style is already present.
- **`range.style` is a string, not an object**: Assign the name as a plain string (`range.style = "MyStyle"`). Assigning a `Style` object reference is not valid.
- **Expecting `style.borders` to behave like `range.format.borders`**: Style borders use the same `Excel.BorderIndex` and `Excel.BorderLineStyle` enums, but you must set each edge individually just as you would on a range's format object.
