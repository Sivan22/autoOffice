# Images — Inline Pictures

## Key Types
- `Word.InlinePicture` — width, height, altTextTitle, altTextDescription, hyperlink
- `Word.Body.insertInlinePictureFromBase64()` — insert image from base64 string

## Insert Image at Current Selection (from Base64)

Insert at the cursor/selection — works on any Range, Paragraph, or Body:

```javascript
await Word.run(async (context) => {
  const range = context.document.getSelection();

  // base64ImageString: raw base64 — NO "data:image/png;base64," prefix
  const picture = range.insertInlinePictureFromBase64(
    base64ImageString,
    Word.InsertLocation.replace  // or: after, before, end, start
  );

  picture.width = 300;   // points (optional — omit to keep original size)
  picture.height = 200;  // points (optional)
  picture.altTextTitle = "My image";

  await context.sync();
});
```

## Insert Image from URL (fetch → base64 → insert)

The Word API only accepts base64 — fetch the URL first, convert, then insert:

```javascript
await Word.run(async (context) => {
  // 1. Fetch the image and convert to base64 outside Word.run
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Strip the data:image/...;base64, prefix
      resolve(reader.result.split(",")[1]);
    };
    reader.readAsDataURL(blob);
  });

  // 2. Insert via the Word API
  const range = context.document.getSelection();
  const picture = range.insertInlinePictureFromBase64(base64, Word.InsertLocation.after);
  picture.width = 300;

  await context.sync();
});
```

Note: `fetch()` inside `Word.run` is fine — it's still within an async function. Just make sure
the fetch completes before `context.sync()`.

## Insert Image from Base64 at End of Document

```javascript
await Word.run(async (context) => {
  const body = context.document.body;
  
  // base64 is a base64-encoded image string (without the data:image prefix)
  const picture = body.insertInlinePictureFromBase64(
    base64ImageString,
    Word.InsertLocation.end
  );
  
  picture.width = 200;
  picture.height = 150;
  picture.altTextTitle = "Chart";
  picture.altTextDescription = "Quarterly sales chart";
  
  await context.sync();
});
```

## Get All Images

```javascript
await Word.run(async (context) => {
  const pictures = context.document.body.inlinePictures;
  pictures.load("items");
  await context.sync();
  
  for (const pic of pictures.items) {
    pic.load("width,height,altTextTitle");
  }
  await context.sync();
  
  for (const pic of pictures.items) {
    console.log(`${pic.altTextTitle}: ${pic.width}x${pic.height}`);
  }
});
```

## Resize an Image

```javascript
await Word.run(async (context) => {
  const pictures = context.document.body.inlinePictures;
  pictures.load("items");
  await context.sync();
  
  if (pictures.items.length > 0) {
    const pic = pictures.items[0];
    pic.load("width,height");
    await context.sync();
    
    // Scale to 50%
    pic.width = pic.width * 0.5;
    pic.height = pic.height * 0.5;
    await context.sync();
  }
});
```

## Read Image Data as Base64

```javascript
await Word.run(async (context) => {
  const pictures = context.document.body.inlinePictures;
  pictures.load("items");
  await context.sync();

  const pic = pictures.items[0];
  const base64 = pic.getBase64ImageSrc();
  base64.load();
  await context.sync();

  // Returns the raw base64 string (without the data:image prefix)
  console.log("Base64 length:", base64.value.length);
  return base64.value;
});
```

## Get Image Format

```javascript
await Word.run(async (context) => {
  const pictures = context.document.body.inlinePictures;
  pictures.load("items");
  await context.sync();

  for (const pic of pictures.items) {
    pic.load("imageFormat");
  }
  await context.sync();

  // imageFormat: "jpeg" | "png" | "gif" | "bmp" | "svg" | "undefined"
  return pictures.items.map(p => p.imageFormat);
});
```

## Delete an Image

```javascript
await Word.run(async (context) => {
  const pictures = context.document.body.inlinePictures;
  pictures.load("items");
  await context.sync();

  pictures.items[0].delete();
  await context.sync();
});
```

## Common Pitfalls

- Base64 string must NOT include the `data:image/png;base64,` prefix — just the raw base64
- Width and height are in points (1 point = 1/72 inch)
- `insertInlinePictureFromBase64` is available on Body, Paragraph, Range, etc.
- `getBase64ImageSrc()` returns a proxy — load its `value` before reading
