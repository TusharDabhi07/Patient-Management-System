const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (protected in real prod)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'Patient Management System API',
    version: '1.0.0',
    status: 'running'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeded (max 5 MB).' });
  }
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`PMS Backend running on http://localhost:${PORT}`);
});
