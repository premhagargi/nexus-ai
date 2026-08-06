import { config } from 'dotenv';
import OpenAI from 'openai';

config({ path: '.env.local' });
config({ path: '.env' });

const cerebras = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: 'https://api.cerebras.ai/v1',
});

async function run() {
  const q = 'wjhat is market map maker';
  const rewriteResp = await cerebras.chat.completions.create({
    model: 'llama3.1-8b',
    messages: [
      { role: 'system', content: 'You are a search query optimizer. Your job is to rewrite the final user question into a clean, standalone search query for a vector database. Resolve any pronouns (it, they, this) using the conversation history. Fix any spelling mistakes (e.g. "wjhat" -> "what") and separate concatenated words (e.g. "marketmapmaker" -> "market map maker"). Reply ONLY with the standalone search query. Do not add quotes or explanations.' },
      { role: 'user', content: q }
    ],
    max_completion_tokens: 50,
    temperature: 0,
  });
  console.log(rewriteResp);
}

run().catch(console.error);
