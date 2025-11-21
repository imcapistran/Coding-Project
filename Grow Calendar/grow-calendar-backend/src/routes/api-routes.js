import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// allows for frontend to backend communication
import axios from 'axios';
import { config } from '../config/env.js';

const router = express.Router();

// Resolve data paths relative to this module so imports work from any CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load crop instructions
const instructionsFile = path.join(__dirname, '..', '..', 'data', 'instructions.json');
const cropInstructions = JSON.parse(fs.readFileSync(instructionsFile, 'utf8'));

//loads zipFile
const zipFile = path.join(__dirname, '..', '..', 'data', 'zip.txt');
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

    // Detect frost/freeze risk: simple rule based on forecasted temperatures
    const temps = periods.map(p => Number(p.temperature)).filter(t => !Number.isNaN(t));
    const minTemp = temps.length ? Math.min(...temps) : null;
    let frostRisk = false;
    let frostType = null;
    if (minTemp != null) {
      if (minTemp <= 32) {
        frostRisk = true;
        frostType = 'freeze';
      } else if (minTemp <= 36) {
        frostRisk = true;
        frostType = 'frost';
      }
    }

    // annotate weeklyForecast with frost flags per period
    const annotatedWeekly = periods.map(p => {
      const t = Number(p.temperature);
      const pFrost = !Number.isNaN(t) && t <= 36;
      const pFreeze = !Number.isNaN(t) && t <= 32;
      return {
        name: p.name,
        temperature: `${p.temperature}°${p.temperatureUnit}`,
        condition: p.shortForecast,
        details: p.detailedForecast,
        frostRisk: pFrost,
        frostType: pFreeze ? 'freeze' : (pFrost ? 'frost' : null)
      };
    });

    const weather = {
      location: zip,
      temperature: `${firstPeriod.temperature}°${firstPeriod.temperatureUnit}`,
      condition: firstPeriod.shortForecast,
      details: firstPeriod.detailedForecast,
      weeklyForecast: annotatedWeekly,
      frostRisk,
      frostType,
      minForecastTemp: minTemp
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
    // Determine growing phase from per-crop growingWindows if present.
    const monthNameToNumber = (m) => {
      if (m == null) return null;
      if (typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 12) return m;
      const s = String(m).trim().toLowerCase();
      const map = {
        january: 1, jan: 1,
        february: 2, feb: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9, sept: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12
      };
      if (map[s]) return map[s];
      const n = Number(s);
      return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
    };

    const gatherMonthsFromWindow = (window) => {
      const months = new Set();
      if (!window) return months;
      // window might be an array of months, or an object mapping seasons -> arrays
      if (Array.isArray(window)) {
        window.forEach(v => { const n = monthNameToNumber(v); if (n) months.add(n); });
        return months;
      }
      // object: values may be arrays or single values
      Object.values(window).forEach(v => {
        if (Array.isArray(v)) v.forEach(x => { const n = monthNameToNumber(x); if (n) months.add(n); });
        else { const n = monthNameToNumber(v); if (n) months.add(n); }
      });
      return months;
    };

    const monthNumberToName = (n) => {
      const names = [null,'January','February','March','April','May','June','July','August','September','October','November','December'];
      return names[n] || String(n);
    };

    const determineGrowingPhase = (cropKey, cropInstruction) => {
      const month1 = new Date().getMonth() + 1; // 1-12
      const monthName = monthNumberToName(month1);

      const hasGW = cropInstruction && cropInstruction.growingWindows;
      const isPerennial = !!(cropInstruction && cropInstruction.characteristics && cropInstruction.characteristics.perennial === true);

      if (hasGW) {
        const gw = cropInstruction.growingWindows;
        const sowMonths = gatherMonthsFromWindow(gw.sowing);
        const transplantMonths = gatherMonthsFromWindow(gw.transplanting);
        const harvestMonths = gatherMonthsFromWindow(gw.harvesting);

        if (sowMonths.has(month1)) return { currentPhase: 'sowed', phaseExplanation: `Current month (${monthName}) is inside the sowing window for this crop.` };
        if (transplantMonths.has(month1)) return { currentPhase: 'transplanted', phaseExplanation: `Current month (${monthName}) is inside the transplanting window for this crop.` };
        if (harvestMonths.has(month1)) return { currentPhase: 'harvested', phaseExplanation: `Current month (${monthName}) is inside the harvesting window for this crop.` };

        // Not in any active window
        if (isPerennial) {
          return { currentPhase: 'dormant', phaseExplanation: `Perennial crop and ${monthName} is outside active windows — crop is likely dormant.` };
        }
        return { currentPhase: 'cant_sow_yet', phaseExplanation: `No active sow/transplant/harvest window covers ${monthName}; sowing is not recommended now.` };
      }

      // No growingWindows available: for perennials mark dormant, otherwise indicate can't sow
      if (isPerennial) return { currentPhase: 'dormant', phaseExplanation: `Perennial crop with no defined growingWindows; treated as dormant.` };
      return { currentPhase: 'cant_sow_yet', phaseExplanation: `No growingWindows defined for this crop; sowing not recommended at this time.` };
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

        const cropInstruction = instructionKey ? cropInstructions.crops[instructionKey] : null;
        const { currentPhase, phaseExplanation } = determineGrowingPhase(cropName, cropInstruction);
        const instructionBlock = cropInstruction || null;

        acc[cropName] = {
          name: item.commodity_desc,
          currentPhase,
          phaseExplanation,
          statistics: [],
          // return the full instruction object; frontend will pick the phase block if present
          instructions: instructionBlock
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
