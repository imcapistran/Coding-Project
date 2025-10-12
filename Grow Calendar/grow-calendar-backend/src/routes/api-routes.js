import express from 'express';
const router = express.Router();

// allows for frontend to backend communication
import axios from 'axios';

//function to convert zip/city into lat & lon
async function getCoordinates(location){
  const locations = {
    '30303': { lat: 33.7489, lon: -84.3879 }, // Atlanta ZIP
    'atlanta': { lat: 33.7489, lon: -84.3879 }
  }

  const key = location.trim().toLowerCase();

  if(locations[key]) return locations[key];
  throw new Error('Location not found');
}

// API route for weather
router.get('/weather', async (req, res) => {
  const location = req.query.location;
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  try {
    //gets coordinates
    const { lat, lon } = await getCoordinates(location);

    const pointUrl = `https://api.weather.gov/points/${lat},${lon}`;
    console.log('Point URL: ', pointUrl);
    const pointResponse = await axios.get(pointUrl,
      {
        headers: {
          'User-Agent': 'GrowCalendarApp (cacapi5412@ung.edu)',
          'Accept': 'application/ld+json'
        }
      });
      console.log('Point Response: ', pointResponse.data);
      
    const forecastUrl = pointResponse.data.forecast;
    console.log('Forecast URL: ', forecastUrl);

    const forecastResponse = await axios.get(forecastUrl, {
      headers: {
        'User-Agent': 'GrowCalendarApp (cacapi5412@ung.edu)',
        'Accept': 'application/ld+json'
      }
    });

    console.log('Forecast Response: ', forecastResponse.data);

    const periods = forecastResponse.data.periods;

    const firstPeriod = periods[0];

    const weeklyForecast = periods.map(p => ({
      name: p.name,
      temperature: `${p.temperature}°${p.temperatureUnit}`,
      condition: p.shortForecast,
      details: p.detailedForecast
    }));

    const weather = {
      location,
      temperature: `${firstPeriod.temperature}°${firstPeriod.temperatureUnit}`,
      condition: firstPeriod.shortForecast,
      details: firstPeriod.detailedForecast,
      weeklyForecast
    };
    

    console.log('Weather Data: ', weather);
    res.json(weather);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'failed to fetch weather data'});
  }

  });

export default router;
