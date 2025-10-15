(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rallye_id: 1 })
    });
    console.log('status', res.status);
    const json = await res.json().catch(() => null);
    console.log('body', json);
  } catch (e) {
    console.error('request failed', e.message || e);
  }
})();
