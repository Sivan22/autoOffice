# Images — Inline Pictures

## Key Types
- `Word.InlinePicture` — width, height, altTextTitle, altTextDescription, hyperlink
- `Word.Body.insertInlinePictureFromBase64()` — insert image from base64 string

## Insert Image from Base64

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

## Common Pitfalls

- Base64 string must NOT include the `data:image/png;base64,` prefix — just the raw base64
- Width and height are in points (1 point = 1/72 inch)
- `insertInlinePictureFromBase64` is available on Body, Paragraph, Range, etc.
