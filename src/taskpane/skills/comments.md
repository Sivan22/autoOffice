# Comments — Add, Read, Reply

## Key Types
- `Word.Comment` — content, authorName, createdDate, replies
- `Word.CommentReply` — content, authorName, createdDate

## Add a Comment to Selection

```javascript
await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const comment = selection.insertComment("This needs review");
  
  comment.load("id,content");
  await context.sync();
  console.log("Added comment:", comment.id);
});
```

## Read All Comments

```javascript
await Word.run(async (context) => {
  const comments = context.document.body.getComments();
  comments.load("items");
  await context.sync();
  
  for (const comment of comments.items) {
    comment.load("content,authorName,createdDate");
  }
  await context.sync();
  
  for (const comment of comments.items) {
    console.log(`${comment.authorName}: ${comment.content} (${comment.createdDate})`);
  }
});
```

## Reply to a Comment

```javascript
await Word.run(async (context) => {
  const comments = context.document.body.getComments();
  comments.load("items");
  await context.sync();
  
  if (comments.items.length > 0) {
    const reply = comments.items[0].reply("Good point, I'll fix this.");
    reply.load("content");
    await context.sync();
  }
});
```

## Delete a Comment

```javascript
await Word.run(async (context) => {
  const comments = context.document.body.getComments();
  comments.load("items");
  await context.sync();
  
  if (comments.items.length > 0) {
    comments.items[0].delete();
    await context.sync();
  }
});
```

## Common Pitfalls

- Comments API requires WordApi 1.4+
- `getComments()` is on body or range, not on `context.document` directly
- Comment content is plain text
