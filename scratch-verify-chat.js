require('dotenv').config({ path: '.env' });
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { streamText } = require('ai');

async function testSanitizer() {
  const incomingMessages = [
    { parts: [{ type: "text", text: "hi" }], id: "gqEdhGM6iGWIZQ3r", role: "user" }
  ];

  const formattedMessages = incomingMessages.map((m) => {
    let content = m.content;
    if (!content && Array.isArray(m.parts)) {
      content = m.parts.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
    }
    return {
      role: m.role || 'user',
      content: content || '',
    };
  }).filter((m) => m.content.trim().length > 0);

  console.log('Formatted Messages:', formattedMessages);

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const google = createGoogleGenerativeAI({ apiKey });

  try {
    const result = streamText({
      model: google('gemini-1.5-flash'),
      messages: formattedMessages,
    });
    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
    }
    console.log('Stream Output:', text);
  } catch (e) {
    console.error('Stream Error:', e.message);
  }
}

testSanitizer();
