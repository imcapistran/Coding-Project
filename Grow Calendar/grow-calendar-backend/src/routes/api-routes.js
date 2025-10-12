import express from 'express';
import path from 'path';
import fs from 'fs';
// allows for frontend to backend communication
import axios from 'axios';

const router = express.Router();

//loads zipFile
const zipFile = path.resolve('../data/zip.txt')
const zipData = {};

//reads zipFile
fs.readFileSync(zipFile, 'utf8')
  .split('\n')
  .slice(1)
  .forEach(line => {
    const [zip, lat, lng] = line.trim().split(',');
    zipData[zip] = { lat: parseFloat(lat), lon: parseFloat(lng) };
  });


  console.log(`Loaded ${Object.keys(zipData).length} ZIP codes`);
//function to convert zip/city into lat & lon
async function getCoordinates(zip) {
  if (zipData[zip]) {
    return zipData[zip];
  }
}

// API route for weather
router.get('/weather', async (req, res) => {
  const zip = req.query.zip;
  if (!zip) {
    return res.status(400).json({ error: 'ZIP code is required' });
  }
  try {
    //gets coordinates
    const { lat, lon } = await getCoordinates(zip);

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
      location: zip,
      temperature: `${firstPeriod.temperature}°${firstPeriod.temperatureUnit}`,
      condition: firstPeriod.shortForecast,
      details: firstPeriod.detailedForecast,
      weeklyForecast
    };
    

    console.log('Weather Data: ', weather);
    res.json(weather);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }

  });

export default router;
