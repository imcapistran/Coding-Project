async function handleZipSearch() {
  const input = document.getElementById('placesSearch').value.trim();
  const resultsDiv = document.getElementById('zipResults');

  if (!input) {
    resultsDiv.innerText = 'Please enter a city or ZIP code.';
    return;
  }

  try {
    // Call backend API
    const response = await fetch(`/api/weather?location=${encodeURIComponent(input)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }

   const data = await response.json();
   const weeklyForecast = data.weeklyForecast;

   resultsDiv.innerHTML = '';

   weeklyForecast.forEach(day => {
      const dayDiv = document.createElement('div');
      dayDiv.classList.add('forecast-day');
      dayDiv.innerHTML = `
        <h4>${day.name}</h4>
        <p>Temperature: ${day.temperature}</p>
        <p>Condition: ${day.condition}</p>
        <p>Details: ${day.details}</p>        
      `;
      resultsDiv.appendChild(dayDiv);
   });
  } catch (error) {
    console.error(error);
    resultsDiv.innerText = 'Error fetching weather data. Please try again.';
  }
}

