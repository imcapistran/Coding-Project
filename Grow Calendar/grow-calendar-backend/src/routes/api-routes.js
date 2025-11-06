import express from 'express';
import path, { format } from 'path';
import fs, { stat } from 'fs';
// allows for frontend to backend communication
import axios from 'axios';
import { config } from '../config/env.js';

const router = express.Router();

// Load crop instructions
const instructionsFile = path.resolve('../data/instructions.json');
const cropInstructions = JSON.parse(fs.readFileSync(instructionsFile, 'utf8'));

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

    const checkFrostRisk = (period) => {
      const temp = period.temperature;
      const conditions = period.shortForecast.toLowerCase();
      // Check for frost risk conditions
      const isFrostRisk = temp <= 36 || 
        conditions.includes('frost') || 
        conditions.includes('freeze');
      return {
        risk: isFrostRisk,
        type: temp <= 32 ? 'freeze' : temp <= 36 ? 'frost' : null
      };
    };

    const weeklyForecast = periods.map(p => {
      const frostRisk = checkFrostRisk(p);
      return {
        name: p.name,
        temperature: `${p.temperature}°${p.temperatureUnit}`,
        condition: p.shortForecast,
        details: p.detailedForecast,
        frostRisk: frostRisk.risk,
        frostType: frostRisk.type
      };
    });

    const currentFrostRisk = checkFrostRisk(firstPeriod);
    
    const weather = {
      location: zip,
      temperature: `${firstPeriod.temperature}°${firstPeriod.temperatureUnit}`,
      condition: firstPeriod.shortForecast,
      details: firstPeriod.detailedForecast,
      frostRisk: currentFrostRisk.risk,
      frostType: currentFrostRisk.type,
      weeklyForecast
    };
    

    console.log('Weather Data: ', weather);
    res.json(weather);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }

  });

  // API route for USDA NASS Quick stats
router.get('/crop-progress', async (req, res) => {
  const { zip } = req.query;
  if (!zip || !/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'Valid ZIP code is required' });
  }
  try {

    // Get state code from ZIP using GEO.FCC.us API
    const { lat, lon } = await getCoordinates(zip);
    const fccResponse = await axios.get(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`);
    const fccData = fccResponse.data.results[0];
    const stateCode = fccData.state_code; // e.g. "GA"
    const stateName = fccData.state_name; // e.g. "Georgia"
    console.log(`ZIP ${zip} is in ${stateName} (${stateCode})`);

    const cropResponse = await axios.get('https://quickstats.nass.usda.gov/api/api_GET/', {
      params: {
        key: config.usdaNassKey,
        source_desc: "CENSUS",
        sector_desc: "CROPS",
        group_desc: "VEGETABLES",
        util_practice_desc: "FRESH MARKET",
        prodn_practice_desc: "ALL PRODUCTION PRACTICES",
        statisticcat_desc: "AREA HARVESTED",
        state_alpha: stateCode,
        year__GE: "2015", //Min year
        year__LE: "2025", //Max year
        format: 'JSON'
      },
    });

    console.log('Full USDA API Response:', JSON.stringify(cropResponse.data, null, 2));
    const data = cropResponse.data.data || [];
    
    // Group data by crop name
    // Function to determine growing phase based on date
    const determineGrowingPhase = (crop) => {
      const month = new Date().getMonth(); // 0-11
      // This is a simple example - you might want to make this more sophisticated
      // based on your specific region and climate
      const phases = {
        spring: [2, 3, 4], // March, April, May
        summer: [5, 6, 7], // June, July, August
        fall: [8, 9, 10],  // September, October, November
        winter: [11, 0, 1] // December, January, February
      };

      // Default frost protection guidelines
      const frostProtection = {
        light: [
          "Cover plants with row covers or blankets before nightfall",
          "Water soil well before frost to release heat overnight",
          "Remove covers in the morning to prevent overheating"
        ],
        moderate: [
          "Use thick row covers or double layer protection",
          "Add mulch around base of plants",
          "Consider using cold frames or mini hoop houses"
        ],
        severe: [
          "Move containers indoors if possible",
          "Use greenhouse or permanent protection structures",
          "Consider season extension techniques like high tunnels"
        ]
      };

      let currentPhase = 'dormant';
      if (phases.spring.includes(month)) {
        currentPhase = 'sowed';
      } else if (phases.summer.includes(month)) {
        currentPhase = month < 7 ? 'transplanted' : 'harvested';
      } else if (phases.fall.includes(month)) {
        currentPhase = 'harvested';
      }

      return {
        currentPhase,
        frostProtection
      };
    };

    const groupedResults = data.reduce((acc, item) => {
      const cropName = item.commodity_desc.toLowerCase();
      if (!acc[cropName]) {
        // Find matching instructions (try variations of the name)
        const instructionKey = Object.keys(cropInstructions.crops).find(key => 
          key === cropName || 
          key === cropName.replace(/\s+/g, '_') ||
          key === cropName.replace(/s$/, '') // Try singular form
        );
        
        const { currentPhase, frostProtection } = determineGrowingPhase(cropName);
        
        acc[cropName] = {
          name: item.commodity_desc,
          currentPhase,
          statistics: [],
          instructions: instructionKey ? cropInstructions.crops[instructionKey] : null,
          frostProtection
        };
      }
      
      acc[cropName].statistics.push({
        stat: item.statisticcat_desc,
        value: item.value,
        unit: item.unit_desc,
        year: item.year
      });
      
      return acc;
    }, {});
   
    res.json({
      state: stateName,
      results: Object.values(groupedResults)
    });

  } catch (err) {
    console.error("USDA API Error: ", err.message);
    res.status(500).json({ error: 'Failed to fetch crop progress data' });
  }

});

export default router;
