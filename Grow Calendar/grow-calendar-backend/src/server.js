import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import apiRoutes from './routes/api-routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------
// Serve frontend files
// ---------------------------
const frontendPath = path.join(__dirname, '../../grow-calendar-frontend');
app.use(express.static(frontendPath));

// Optional: serve home.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'home.html'));
});

// ---------------------------
// Middleware & API routes
// ---------------------------
app.use(express.json());
app.use('/api', apiRoutes);

// ---------------------------
// Start server
// ---------------------------
app.listen(config.port, () => {
  console.log(`✅ Server running on port ${config.port}`);
  console.log(`Serving frontend from: ${frontendPath}`);
});
