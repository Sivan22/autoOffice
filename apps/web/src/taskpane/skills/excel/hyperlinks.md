# Hyperlinks — External URLs, Workbook Navigation, and Email Links

## Key Types
- `RangeHyperlink` — the object shape assigned to `range.hyperlink`. Fields (all optional):
  - `address` — external URL string, e.g. `"https://example.com"`.
  - `documentReference` — workbook-internal location string, e.g. `"Sheet2!A1"` or `"'My Sheet'!A1"`.
  - `emailAddress` — recipient email without the `mailto:` prefix, e.g. `"user@example.com"`.
  - `screenTip` — tooltip shown on hover.
  - `textToDisplay` — the visible text rendered in the cell. Defaults to the address string when not set.
- `Excel.ClearApplyTo` — enum used with `range.clear(...)`: `hyperlinks` removes the link but keeps displayed text; `removeHyperlinks` removes the link and its formatting too.

---

## Setting a Hyperlink

Assign a `RangeHyperlink` object to `range.hyperlink`. The change is committed on the next `context.sync()`.

Use exactly one of `address`, `documentReference`, or `emailAddress` per hyperlink. Mixing them produces undefined behavior.

```javascript
// External URL
range.hyperlink = {
  address: "https://example.com",
  textToDisplay: "Visit site",
  screenTip: "Opens example.com in your browser"
};

// Workbook-internal navigation
range.hyperlink = {
  documentReference: "Sheet2!B5",
  textToDisplay: "Go to Sheet2 B5"
};

// Email link
range.hyperlink = {
  emailAddress: "user@example.com",
  textToDisplay: "Email us",
  screenTip: "Opens your default mail client"
};
```

---

## Reading an Existing Hyperlink

Load `"hyperlink"` before syncing. After sync, `range.hyperlink` contains the current `RangeHyperlink` object, or `null` if the cell has no hyperlink.

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1");

  range.load("hyperlink");
  await context.sync();

  if (range.hyperlink) {
    console.log("Address:", range.hyperlink.address);
    console.log("Text:", range.hyperlink.textToDisplay);
    console.log("Tip:", range.hyperlink.screenTip);
  } else {
    console.log("No hyperlink on A1.");
  }
});
```

---

## Clearing Hyperlinks

Use `range.clear(Excel.ClearApplyTo.hyperlinks)` to remove the link while keeping the displayed text and cell formatting intact. Use `range.clear(Excel.ClearApplyTo.removeHyperlinks)` to also remove the hyperlink's text formatting (underline, blue color).

```javascript
// Remove link, keep text.
range.clear(Excel.ClearApplyTo.hyperlinks);

// Remove link AND its formatting.
range.clear(Excel.ClearApplyTo.removeHyperlinks);
```

Avoid setting `range.hyperlink = null` — behavior is inconsistent across Excel versions.

---

## Example 1 — Link "Click here" in A1 to https://example.com

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1");

  range.hyperlink = {
    address: "https://example.com",
    textToDisplay: "Click here",
    screenTip: "Opens example.com"
  };

  await context.sync();
});
```

---

## Example 2 — Workbook-Internal Link Jumping to Sheet2!B5

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("C3");

  range.hyperlink = {
    documentReference: "Sheet2!B5",
    textToDisplay: "Jump to Sheet2 B5",
    screenTip: "Navigates within this workbook"
  };

  await context.sync();
});
```

For a sheet whose name contains spaces, wrap it in single quotes:

```javascript
range.hyperlink = {
  documentReference: "'Budget 2025'!A1",
  textToDisplay: "Open Budget 2025"
};
```

---

## Example 3 — Clearing Hyperlinks from a Range

```javascript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1:A20");

  // Remove the hyperlinks but keep the visible text.
  range.clear(Excel.ClearApplyTo.hyperlinks);

  await context.sync();
});
```

---

## Common Mistakes

- **Omitting `textToDisplay` for URL links**: When `textToDisplay` is not set, the cell shows the raw URL string (e.g. `https://example.com`), which is usually not the desired label. Always set `textToDisplay` when you want human-readable link text.
- **Sheet names with spaces need single quotes**: In `documentReference`, a sheet name that contains spaces must be wrapped in single quotes — `"'Budget 2025'!A1"`. Without them, Excel cannot parse the reference and the link will not navigate correctly.
- **`emailAddress` must not include `mailto:`**: The field value should be just the email address string, e.g. `"user@example.com"`. Adding the `mailto:` prefix causes it to be doubled and the link will fail.
- **`range.clear()` with no argument clears everything**: Calling `range.clear()` without an argument removes cell values, formatting, hyperlinks, and comments. Use `range.clear(Excel.ClearApplyTo.hyperlinks)` to target only the hyperlink.
- **Mixing `address` and `documentReference`**: Setting both fields on the same `RangeHyperlink` object is not supported and produces undefined behavior. Use only one navigation target per hyperlink object.
