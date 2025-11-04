async function handleZipSearch() {
  const input = document.getElementById('placesSearch').value.trim();
  const resultsDiv = document.getElementById('zipResults');

  if (!input) {
    resultsDiv.innerText = 'Please enter a city or ZIP code.';
    return;
  }

  try {
    // Call backend API
    const weatherResponse = await fetch(`/api/weather?zip=${encodeURIComponent(input)}`);
    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }
  const weatherData = await weatherResponse.json();
  const weeklyForecast = weatherData.weeklyForecast;

  //Weather for Each Day
   weeklyForecast.forEach(day => {
      const dayDiv = document.createElement('div');
      dayDiv.classList.add('forecast-day');
      dayDiv.innerHTML = `
        <strong>${day.name}</strong>
        <p>Temperature: ${day.temperature}</p>
        <p>Condition: ${day.condition}</p>
        <p>Details: ${day.details}</p>        
      `;
      resultsDiv.appendChild(dayDiv);
   });
   // Results for Crop Progress
  const cropResponse = await fetch(`/api/crop-progress?zip=${encodeURIComponent(input)}`);
  if (!cropResponse.ok) {
    throw new Error('Failed to fetch crop progress data');
  }
  const cropData = await cropResponse.json();
  
  resultsDiv.innerHTML += `<h3>Crop Progress: for ${input}</h3>`;

  const records = cropData.results || [];
  if (records.length === 0) {
    const noData = document.createElement('p');
    noData.innerText = 'No Crop Progress Found For This ZIP Code.';
    resultsDiv.appendChild(noData);
  } else {
    records.forEach(item => {
      const cropDiv = document.createElement('div');
      cropDiv.classList.add('crop-item');
      cropDiv.innerHTML = `
      <strong>Crop:</strong> ${item.commodity_desc || cropData.crop} <br>
      <strong>Statistic:</strong> ${item.statisticcat_desc} <br>
      <strong>Value:</strong> ${item.Value || 'N/A'} ${item.unit_desc || ''} <br>
    `;
      resultsDiv.appendChild(cropDiv);
    });
  }
  } catch (error) {
    console.error(error);
    resultsDiv.innerText = 'Error fetching weather data. Please try again.';
  }
}

