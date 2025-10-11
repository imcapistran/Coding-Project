import express from 'express';
const router = express.Router();

// Example API route for weather
router.get('/weather', async (req, res) => {
  const location = req.query.location;
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  // Here is where you would call your real weather API
  // For now, let’s send back a mock response
  const mockWeather = {
    location,
    temperature: '72°F',
    condition: 'Sunny',
  };

  res.json(mockWeather);
});

export default router;
