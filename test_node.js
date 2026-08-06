const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.CEREBRAS_API_KEY;

const data = JSON.stringify({
  model: 'llama3.1-8b',
  messages: [
    { role: 'system', content: 'You are a search query optimizer. Your job is to rewrite the final user question into a clean, standalone search query for a vector database. Resolve any pronouns (it, they, this) using the conversation history. Fix any spelling mistakes (e.g. "wjhat" -> "what") and separate concatenated words (e.g. "marketmapmaker" -> "market map maker"). Reply ONLY with the standalone search query. Do not add quotes or explanations.' },
    { role: 'user', content: 'wjhat is marketmapmaker' }
  ],
  temperature: 0
});

const options = {
  hostname: 'api.cerebras.ai',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log('API Response:', parsed.choices[0].message.content);
    } catch (e) {
      console.log('Raw body:', body);
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
