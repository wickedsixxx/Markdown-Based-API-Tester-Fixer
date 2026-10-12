const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

const maxRequestBodySize = '10kb';
const maxNameLength = 100;

// In-memory storage for created items
const items = [];
let nextItemId = 1;

// Do not expose the server technology in response headers
app.disable('x-powered-by');

app.use(express.json({ limit: maxRequestBodySize }));

// Return all stored items
app.get('/items', (req, res) => {
  res.status(200).json(items);
});

// Create a new item from the request body
app.post('/items', (req, res) => {
  const { name } = req.body || {};

  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Field "name" is required and must be a non-empty string.' });
  }

  const trimmedName = name.trim();

  if (trimmedName.length > maxNameLength) {
    return res.status(400).json({ error: `Field "name" must not exceed ${maxNameLength} characters.` });
  }

  const newItem = { id: nextItemId++, name: trimmedName };
  items.push(newItem);

  res.status(201).json(newItem);
});

// Return request parsing errors as JSON instead of the default HTML page
app.use((error, req, res, next) => {
  const statusCode = error.status || 500;
  const message = error.expose ? error.message : 'Internal server error.';

  res.status(statusCode).json({ error: message });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
