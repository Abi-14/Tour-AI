const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST endpoint to receive panic alerts
app.post('/api/send-alert', (req, res) => {
  const alert = {
    timestamp: new Date().toISOString(),
    ...req.body
  };

  // Append to alerts.json (create file if not exists)
  const file = path.join(__dirname, 'alerts.json');
  let arr = [];
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file);
      arr = JSON.parse(raw);
    } catch (e) {
      arr = [];
    }
  }
  arr.push(alert);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2));

  console.log('🔴 Panic alert received:');
  console.log(alert);

  // Here you can integrate email/SMS/WhatsApp logic later
  res.json({ status: 'ok', message: 'Alert received on server' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));