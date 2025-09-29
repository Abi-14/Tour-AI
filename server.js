import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('.')); // serve index.html and script.js

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Test route
app.get('/ping', (req, res) => res.json({ ok: true, msg: 'pong' }));

// Mood-based itinerary route
app.post('/get-itinerary', async (req, res) => {
  const { mood } = req.body;
  if (!mood) return res.status(400).json({ error: 'Mood is required' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful travel planner.' },
        { role: 'user', content: `Create a one-day itinerary for someone feeling ${mood}. Keep it short and actionable.` }
      ]
    });

    const itinerary = response.choices[0].message.content;
    res.json({ itinerary });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'Failed to generate itinerary' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

