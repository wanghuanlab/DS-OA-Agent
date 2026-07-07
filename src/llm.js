export function extractJsonObject(text) {
  const cleaned = String(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    if (start === -1) {
      throw new Error('LLM response does not contain a JSON object.');
    }
    let depth = 0;
    for (let index = start; index < cleaned.length; index += 1) {
      const char = cleaned[index];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, index + 1));
      }
    }
    throw new Error('LLM response contains incomplete JSON.');
  }
}

export async function chatCompletion(llmConfig, messages) {
  if (!llmConfig?.baseUrl || !llmConfig?.apiKey || !llmConfig?.model) {
    throw new Error('LLM configuration requires baseUrl, apiKey, and model.');
  }

  const baseUrl = llmConfig.baseUrl.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${llmConfig.apiKey}`
    },
    body: JSON.stringify({
      model: llmConfig.model,
      temperature: llmConfig.temperature ?? 0.2,
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM response does not include message content.');
  }
  return content;
}

export async function generateJson(llmConfig, messages) {
  return extractJsonObject(await chatCompletion(llmConfig, messages));
}
