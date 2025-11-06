async function fetchWeather(zip) {
  const response = await fetch(`/api/weather?zip=${encodeURIComponent(zip)}`);
  if (!response.ok) throw new Error('Failed to fetch weather data');
  return response.json();
}

async function fetchCropProgress(zip) {
  const response = await fetch(`/api/crop-progress?zip=${encodeURIComponent(zip)}`);
  if (!response.ok) throw new Error('Failed to fetch crop progress data');
  return response.json();
}

function renderWeather(weatherData, container) {
  container.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = `7-Day Forecast for ${weatherData.location}`;
  container.appendChild(title);

  // Frost banner
  if (weatherData.frostRisk) {
    const banner = document.createElement('div');
    banner.className = 'frost-banner';
    banner.innerHTML = `<strong>Frost alert:</strong> ${weatherData.frostType || 'possible frost'} expected — consider frost protection.`;
    container.appendChild(banner);
  }

  const weekly = document.createElement('div');
  weekly.className = 'weekly-forecast';
  const weeklyForecast = weatherData.weeklyForecast || [];

  if (weeklyForecast.length === 0) {
    weekly.innerHTML = `<p>No weather data available.</p>`;
    container.appendChild(weekly);
    return;
  }

  weeklyForecast.forEach(day => {
    const d = document.createElement('div');
    d.className = 'forecast-day';
    d.innerHTML = `
      <strong>${day.name}</strong>
      <p>${day.temperature} — ${day.condition}</p>
      <p>${day.details}</p>
    `;
    if (day.frostRisk) {
      const note = document.createElement('p');
      note.className = 'frost-note';
      note.textContent = `⚠️ Frost/Freeze risk (${day.frostType})`;
      d.appendChild(note);
    }
    weekly.appendChild(d);
  });

  container.appendChild(weekly);
}

function createList(items) {
  const ul = document.createElement('ul');
  items.forEach(i => {
    const li = document.createElement('li');
    li.textContent = i;
    ul.appendChild(li);
  });
  return ul;
}

function renderCropProgress(cropData, container, zip, weatherData) {
  container.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = `Crop Progress for ${zip} (${cropData.state || 'Unknown state'})`;
  container.appendChild(title);

  const crops = cropData.results || [];
  if (crops.length === 0) {
    container.innerHTML += `<p>No Crop Progress Found For This ZIP Code.</p>`;
    return;
  }

  // For each crop, render a "seed packet" card
  crops.forEach(c => {
    const cropName = c.name || c.crop || 'Unknown';
    const card = document.createElement('div');
    card.className = 'seed-packet';

    // Header: name + phase badge
    const header = document.createElement('div');
    header.className = 'seed-header';
    const h = document.createElement('h4');
    h.textContent = cropName;
    header.appendChild(h);

    const phase = document.createElement('span');
    phase.className = 'phase-badge';
    phase.textContent = (c.currentPhase || 'unknown').toUpperCase();
    header.appendChild(phase);
    card.appendChild(header);

    // Instructions for current phase (fall back to sowed/transplanted/harvested in order)
    const instrContainer = document.createElement('div');
    instrContainer.className = 'instructions';
    const instr = c.instructions || {};
    const phaseKey = c.currentPhase || 'sowed';
    let phaseInstr = instr[phaseKey];
    if (!phaseInstr) {
      // fallback order
      phaseInstr = instr.sowed || instr.transplanted || instr.harvested || null;
    }

    if (phaseInstr) {
      const desc = document.createElement('p');
      desc.innerHTML = `<strong>${phaseKey}:</strong> ${phaseInstr.description}`;
      instrContainer.appendChild(desc);
      if (Array.isArray(phaseInstr.instructions)) {
        instrContainer.appendChild(createList(phaseInstr.instructions));
      }
    } else {
      instrContainer.innerHTML = `<p><em>No growing instructions available.</em></p>`;
    }
    card.appendChild(instrContainer);

    // Frost protection guidance
    const frostDiv = document.createElement('div');
    frostDiv.className = 'frost-guidance';
    const frostRisk = weatherData && weatherData.frostRisk;
    if (frostRisk && c.frostProtection) {
      // Map weather frost type to protection level
      const level = weatherData.frostType === 'freeze' ? 'severe' : (weatherData.frostType === 'frost' ? 'moderate' : 'light');
      const guidance = c.frostProtection[level] || c.frostProtection.moderate || c.frostProtection.light;
      frostDiv.innerHTML = `<strong>Frost protection (${level}):</strong>`;
      frostDiv.appendChild(createList(guidance));
    } else if (c.frostProtection) {
      // Show light guidance as general advice
      frostDiv.innerHTML = `<strong>Frost protection (general):</strong>`;
      frostDiv.appendChild(createList(c.frostProtection.light));
    }
    card.appendChild(frostDiv);

    container.appendChild(card);
  });
}

async function handleZipSearch() {
  const input = document.getElementById('placesSearch').value.trim();
  const weatherDiv = document.getElementById('weatherResults');
  const calendarDiv = document.getElementById('calendarResults');

  if (!input) {
    weatherDiv.innerText = 'Please enter a city or ZIP code.';
    return;
  }

  // Clear previous results
  weatherDiv.innerHTML = 'Loading weather...';
  calendarDiv.innerHTML = 'Loading crop data...';

  try {
    const [weatherData, cropData] = await Promise.all([
      fetchWeather(input),
      fetchCropProgress(input)
    ]);

    renderWeather(weatherData, weatherDiv);
    renderCropProgress(cropData, calendarDiv, input, weatherData);

  } catch (error) {
    console.error('Search error:', error);
    weatherDiv.innerHTML = 'Error fetching weather data. Please try again.';
    calendarDiv.innerHTML = 'Error fetching crop progress data.';
  }
}
