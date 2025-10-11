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

    // Display results nicely
    resultsDiv.innerHTML = `
      <h3>Weather for ${data.location}</h3>
      <p>Temperature: ${data.temperature}</p>
      <p>Condition: ${data.condition}</p>
    `;
  } catch (error) {
    console.error(error);
    resultsDiv.innerText = 'Error fetching weather data.';
  }
}
