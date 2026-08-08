import Cerebras from '@cerebras/cerebras_cloud_sdk'

export type RouteIntent = 'CHAT' | 'RAG' | 'TOOL' | 'CLARIFICATION'

export interface RouteDecision {
  route: RouteIntent
  reason: string
  searchQuery?: string
  confidence: number
}

/**
 * Stage 1: Fast Rule-Based Interceptor (0ms overhead)
 * Instantly resolves obvious non-RAG or explicit RAG queries before making any network calls.
 */
export function matchRuleBasedRoute(queryText: string): RouteDecision | null {
  if (!queryText || typeof queryText !== 'string') {
    return { route: 'CHAT', reason: 'Empty or invalid input string', confidence: 1.0 }
  }

  const cleaned = queryText.toLowerCase().trim()
  if (!cleaned) {
    return { route: 'CHAT', reason: 'Empty query', confidence: 1.0 }
  }

  // 1. Casual Greetings, Farewells, and Meta Acknowledgments -> CHAT
  if (
    /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|thanks|thank\s+you|thx|cool|ok|okay|got\s+it|sounds\s+good|bye|who\s+are\s+you|what\s+can\s+you\s+do)($|\s+.*)/i.test(
      cleaned
    ) &&
    !/(document|file|pdf|report|contract|policy|q3|revenue|vacation)/i.test(cleaned)
  ) {
    return { route: 'CHAT', reason: 'Conversational greeting or acknowledgment', confidence: 1.0 }
  }

  // 2. Pure Math Calculations -> CHAT
  if (/^(what\s+is\s+|calculate\s+|compute\s+)?\d+(\.\d+)?\s*[\+\-\*\/\^\%]\s*\d+(\.\d+)?$/i.test(cleaned)) {
    return { route: 'CHAT', reason: 'Pure mathematical expression', confidence: 1.0 }
  }

  // 3. General Programming / Coding Prompts -> CHAT
  if (
    /^(write|give\s+me|create|build|implement|show\s+me)\s+(a|an|the)?\s*(python|typescript|javascript|react|html|css|sql|function|script|regex|class|code)/i.test(
      cleaned
    ) ||
    /how\s+to\s+(center\s+a\s+div|reverse\s+a\s+string|parse\s+json|sort\s+an\s+array)/i.test(cleaned)
  ) {
    return { route: 'CHAT', reason: 'General programming or coding request', confidence: 0.95 }
  }

  // 4. Action / Tool Keywords -> TOOL
  if (
    /(create|add|make|set\s*up|put|save)\s+(a\s+|an\s+|the\s+|new\s+)?(task|action\s+item|todo|reminder)/i.test(
      cleaned
    )
  ) {
    return { route: 'TOOL', reason: 'Task creation request', confidence: 0.95 }
  }

  if (/(summarize|summary|overview)\s+(the\s+|this\s+|all\s+)?(workspace|documents|files)/i.test(cleaned)) {
    return { route: 'TOOL', reason: 'Workspace summarization request', confidence: 0.95 }
  }

  // 5. Explicit Document Grounding Keywords -> RAG
  if (
    /(according\s+to|in\s+(the\s+)?(uploaded\s+)?(document|file|pdf|report|contract)|what\s+does\s+the\s+file\s+say|policy|vacation\s+days|q3\s+revenue)/i.test(
      cleaned
    )
  ) {
    return {
      route: 'RAG',
      reason: 'Explicit document reference or grounding keyword detected',
      searchQuery: queryText,
      confidence: 0.95,
    }
  }

  return null // Ambiguous — proceed to Stage 2 LLM Classifier
}

/**
 * Stage 2: Fast LLM Classifier Pass (Lightweight JSON intent classification)
 * Runs when rules cannot decisively route the query.
 */
export async function classifyIntentWithLLM(
  queryText: string,
  recentHistory: string,
  cerebras: InstanceType<typeof Cerebras>
): Promise<RouteDecision> {
  try {
    const prompt = `System: You are an intent classifier for a enterprise document assistant.
Analyze the user message and conversation history to determine if answering it REQUIRES searching the user's uploaded workspace documents (RAG), calling a workspace tool (TOOL), or if it can be answered directly by standard LLM knowledge/conversation (CHAT).

Routes:
- "RAG": Requires looking up info inside the user's uploaded files/documents (e.g. contracts, policies, financial reports, specific workspace facts).
- "CHAT": Conversational chat, general coding, writing assistance, general knowledge, greetings.
- "TOOL": Creating tasks, summarizing workspace, note saving.
- "CLARIFICATION": Ambiguous or incomplete input requiring user follow-up.

USER QUERY: "${queryText}"
RECENT HISTORY:
${recentHistory || 'None'}

Return ONLY a valid JSON object matching this schema:
{
  "route": "CHAT" | "RAG" | "TOOL" | "CLARIFICATION",
  "reason": "short explanation",
  "searchQuery": "clean search query for vector DB if route is RAG, otherwise empty string"
}`

    const resp = await cerebras.chat.completions.create({
      model: 'gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 60,
      temperature: 0.0,
    })

    const rawContent = ((resp as any).choices?.[0]?.message?.content || '').trim()
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const route = (['CHAT', 'RAG', 'TOOL', 'CLARIFICATION'].includes(parsed.route)
        ? parsed.route
        : 'RAG') as RouteIntent

      return {
        route,
        reason: parsed.reason || 'LLM Intent Classifier decision',
        searchQuery: parsed.searchQuery || queryText,
        confidence: 0.85,
      }
    }
  } catch (error: any) {
    console.warn('[Intent Router] LLM Classifier failed, falling back to RAG:', error?.message || error)
  }

  return { route: 'RAG', reason: 'Classifier fallback default', searchQuery: queryText, confidence: 0.5 }
}

/**
 * Main Hybrid Router Entry Point:
 * Integrates Stage 1 (Fast Rules) + Stage 2 (LLM Classifier).
 */
export async function routeQueryIntent(
  queryText: string,
  recentHistory: string,
  cerebras: InstanceType<typeof Cerebras>
): Promise<RouteDecision> {
  // Stage 1: Fast Rule Interceptor
  const ruleDecision = matchRuleBasedRoute(queryText)
  if (ruleDecision) {
    console.log(`[Intent Router] [Stage 1 Rule] -> Route: ${ruleDecision.route} | Reason: ${ruleDecision.reason}`)
    return ruleDecision
  }

  // Stage 2: LLM Classifier Pass
  console.log(`[Intent Router] [Stage 2 LLM Classifier] -> Classifying: "${queryText}"`)
  const llmDecision = await classifyIntentWithLLM(queryText, recentHistory, cerebras)
  console.log(`[Intent Router] [Stage 2 LLM Classifier] -> Route: ${llmDecision.route} | Reason: ${llmDecision.reason}`)
  return llmDecision
}
