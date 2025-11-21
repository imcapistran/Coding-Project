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

  // Find the first day with frost/freeze
  const frostDay = weatherData.weeklyForecast?.find(d => d.frostRisk);
  if (frostDay) {
    const banner = document.createElement('div');
    banner.className = 'frost-banner';
    banner.innerHTML = `<strong>Frost alert (${frostDay.name}):</strong> ${frostDay.frostType || 'possible frost'} expected — consider frost protection.`;
    container.appendChild(banner);
  }

  const weekly = document.createElement('div');
  weekly.className = 'weekly-forecast';

  if (!weatherData.weeklyForecast || !weatherData.weeklyForecast.length) {
    weekly.innerHTML = `<p>No weather data available.</p>`;
    container.appendChild(weekly);
    return;
  }

  weatherData.weeklyForecast.forEach(day => {
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
      note.textContent = `⚠️❄️ Frost/Freeze risk (${day.frostType})`;
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

    const monthNow = new Date().getMonth() + 1; // 1-12
    const winterMonths = new Set([11, 12, 1, 2, 3]); // Nov-Mar considered winter/fall

    // --- Helper: Pretty Characteristics ---
    function renderCharacteristics(characteristics) {
        if (!characteristics) return null;

        const charDiv = document.createElement('div');
        charDiv.className = 'crop-characteristics';
        charDiv.style.marginBottom = '10px';
        charDiv.style.fontStyle = 'italic';
        charDiv.style.fontSize = '0.9em';

        const lines = [];

        // Days to Maturity
        if (characteristics.daysToMaturity) {
            lines.push(`Days to Maturity: ${characteristics.daysToMaturity}`);
        }

        // Maturity Notes
        if (characteristics.maturityNotes) {
            lines.push(`Maturity Notes: ${characteristics.maturityNotes}`);
        }

        // Boolean traits: show only if true
        ['frostTolerant', 'heatTolerant', 'heatSensitive', 'droughtTolerant', 'droughtSensitive', 'perennial', 'partialShadeOk'].forEach(trait => {
            if (characteristics[trait]) {
                const pretty = trait
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^\w/, c => c.toUpperCase());
                lines.push(pretty);
            }
        });

        // Sun requirement
        if (characteristics.sunRequirement) {
            lines.push(`Sun Requirement: ${characteristics.sunRequirement}`);
        }

        // Soil temperature
        if (characteristics.soilTemp?.min && characteristics.soilTemp?.max) {
            lines.push(`Soil Temperature: ${characteristics.soilTemp.min}-${characteristics.soilTemp.max}°F`);
        }

        // Companions
        if (Array.isArray(characteristics.companions) && characteristics.companions.length) {
            lines.push(`Companions: ${characteristics.companions.join(', ')}`);
        }

        // Family
        if (characteristics.family) {
            lines.push(`Family: ${characteristics.family}`);
        }

        charDiv.innerHTML = `<strong>Characteristics:</strong><br>• ${lines.join('<br>• ')}`;
        return charDiv;
    }

    crops.forEach(c => {
        if (c.currentPhase === 'cant_sow_yet') return; // hide entirely

        const cropName = c.name || c.crop || 'Unknown';
        const card = document.createElement('div');
        card.className = 'seed-packet';

        // --- Header: crop name + phase badge ---
        const header = document.createElement('div');
        header.className = 'seed-header';
        const h = document.createElement('h4');
        h.textContent = cropName;
        header.appendChild(h);

        const phase = document.createElement('span');
        phase.className = 'phase-badge';
        phase.textContent = (c.currentPhase || 'unknown').toUpperCase();

        // Badge colors
        let instrClass = '';
        if (c.currentPhase === 'sowed') { phase.classList.add('badge-sowing'); instrClass='instr-sowing'; }
        else if (c.currentPhase === 'transplanted') { phase.classList.add('badge-transplant'); instrClass='instr-transplant'; }
        else if (c.currentPhase === 'harvested') { phase.classList.add('badge-harvest'); instrClass='instr-harvest'; }
        else if (c.currentPhase === 'dormant') { phase.classList.add('badge-dormant'); instrClass='instr-dormant'; }

        header.appendChild(phase);
        card.appendChild(header);

        // --- Crop Characteristics ---
        const charDiv = renderCharacteristics(c.instructions?.characteristics);
        if (charDiv) card.appendChild(charDiv);

        // --- Frost guidance ---
        const frostDay = weatherData?.weeklyForecast?.find(d => d.frostRisk);
        const frostRelevant = c.instructions?.characteristics?.frostTolerant 
                            || c.instructions?.characteristics?.perennial
                            || (c.currentPhase === 'sowed' && winterMonths.has(monthNow))
                            || (c.currentPhase === 'transplanted' && winterMonths.has(monthNow));

        if (frostDay && frostRelevant) {
            const frostDiv = document.createElement('div');
            frostDiv.className = 'frost-guidance';
            frostDiv.style.marginBottom = '10px';
            frostDiv.style.fontStyle = 'italic';
            frostDiv.style.fontSize = '0.9em';
            frostDiv.style.borderLeft = '3px solid #007BFF';
            frostDiv.style.paddingLeft = '8px';
            frostDiv.style.background = '#eaf5ff';

            const frostTypeText = frostDay.frostType === 'freeze' ? 'Freeze' 
                                   : (frostDay.frostType === 'frost' ? 'Frost' : 'Cold');

            frostDiv.innerHTML = `<strong>${frostTypeText} expected on ${frostDay.name}.</strong> 
                Protect frost-sensitive crops and ensure perennials are mulched or covered.`;

            card.appendChild(frostDiv);
        }

        // --- Phase instructions ---
        const instrContainer = document.createElement('div');
        instrContainer.className = 'instructions ' + instrClass;

        const phaseKey = c.currentPhase || null;
        let phaseInstr = c.instructions?.[phaseKey];
        if (!phaseInstr) {
            phaseInstr = c.instructions?.sowed || c.instructions?.transplanted || c.instructions?.harvested || null;
        }

        if (phaseInstr) {
            const desc = document.createElement('p');
            desc.innerHTML = `<strong>${phaseKey}:</strong> ${phaseInstr.description}`;
            instrContainer.appendChild(desc);

            if (Array.isArray(phaseInstr.instructions)) {
                const ul = document.createElement('ul');
                phaseInstr.instructions.forEach(ins => {
                    const li = document.createElement('li');
                    li.textContent = ins;
                    ul.appendChild(li);
                });
                instrContainer.appendChild(ul);
            }
        } else {
            instrContainer.innerHTML = `<p><em>No growing instructions available.</em></p>`;
        }

        card.appendChild(instrContainer);
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
