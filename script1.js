document.getElementById('generateBtn').addEventListener('click', async () => {
  const mood = document.getElementById('mood').value;

  try {
    const response = await fetch('/get-itinerary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood })
    });

    const data = await response.json();
    document.getElementById('result').innerText = data.itinerary || 'No itinerary returned.';
  } catch (err) {
    console.error(err);
    document.getElementById('result').innerText = 'Error fetching itinerary.';
  }
});
