async function test() {
  const fallbackMessage = "Nexus AI Assistant is ready! To enable live Gemini AI responses, please add a valid Google AI Studio API key (starting with AIzaSy) to your environment variables.";
  const payload = `0:${JSON.stringify(fallbackMessage)}\n`;
  console.log('Test fallback stream payload:', payload);
}
test();
