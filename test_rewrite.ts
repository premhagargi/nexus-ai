import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function testRewrite() {
  console.log('Testing Query Reformulation with Cerebras...');
  const queries = ['wjhat is market map maker', 'what is marketmapmaker', 'what is it'];
  
  for (const q of queries) {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3.1-70b', 
        messages: [
          { role: 'system', content: 'You are a search query optimizer. Your job is to rewrite the final user question into a clean, standalone search query for a vector database. Resolve any pronouns (it, they, this) using the conversation history. Fix any spelling mistakes (e.g. "wjhat" -> "what") and separate concatenated words (e.g. "marketmapmaker" -> "market map maker"). Reply ONLY with the standalone search query. Do not add quotes or explanations.' },
          { role: 'user', content: q }
        ],
        max_tokens: 50,
        temperature: 0,
      })
    });
    const data = await res.json();
    if (data.error) {
       console.error(`API Error: ${JSON.stringify(data.error)}`);
    } else {
       console.log(`Original: "${q}" -> Rewritten: "${data.choices?.[0]?.message?.content}"`);
    }
  }
}

testRewrite().catch(console.error);
