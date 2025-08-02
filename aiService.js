const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch');
const { API_KEYS, OPENROUTER_MODELS } = require('./config.js');

// --- Prompt del Sistema para la Generación de Planes ---
const PLAN_GENERATION_SYSTEM_PROMPT = `
Eres un experto en finanzas que crea planes de cálculo para resolver problemas de matemática financiera.
Tu respuesta DEBE ser un objeto JSON con la siguiente estructura:

{
  "interpretation": "<Breve descripción de cómo interpretaste el problema>",
  "initial_data": { "<variable_1>": <valor_1>, "<variable_2>": <valor_2> },
  "calculation_steps": [
    {
      "step_name": "<Nombre del paso>",
      "formula_name": "<nombre_de_la_formula>",
      "inputs": { "<param_1>": "{{variable_or_value}}", "<param_2>": "{{variable_or_value}}" },
      "target_variable": "<nombre_de_la_variable_resultado>"
    }
  ],
  "final_variable": "<nombre_de_la_variable_final>"
}

- Utiliza ÚNICAMENTE las fórmulas de la lista proporcionada.
- No inventes fórmulas.
- No incluyas la respuesta final en el plan.
`;

/**
 * Llama a la API de Google AI Studio.
 */
async function callGoogleStudio(systemPrompt, userPrompt) {
    const apiKey = API_KEYS.gemini_studio;
    if (!apiKey || apiKey.includes('...')) throw new Error("API key for Google AI Studio is not configured.");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([systemPrompt, userPrompt]);
    return await result.response.text();
}

/**
 * Llama a la API de OpenRouter para un proveedor específico.
 */
async function callOpenRouter(provider, systemPrompt, userPrompt) {
    const model = OPENROUTER_MODELS[provider];
    const apiKey = API_KEYS[provider];

    if (!apiKey || apiKey.includes('...')) throw new Error(`API key for ${provider} is not configured.`);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API error for ${provider}: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Genera un plan de cálculo utilizando el proveedor de IA especificado.
 * @param {string} provider - El proveedor de IA a utilizar (ej. 'gemini_studio', 'kimi').
 * @param {string} problem - El problema a resolver.
 * @returns {Promise<object>} El plan de cálculo en formato JSON.
 */
async function generateCalculationPlan(provider, problem) {
    const userPrompt = `Problema a resolver: "${problem}"`;
    let rawJsonText;

    try {
        console.log(`[AI Service] Calling provider: ${provider}`);
        if (provider === 'gemini_studio') {
            rawJsonText = await callGoogleStudio(PLAN_GENERATION_SYSTEM_PROMPT, userPrompt);
        } else {
            rawJsonText = await callOpenRouter(provider, PLAN_GENERATION_SYSTEM_PROMPT, userPrompt);
        }
        console.log(`[AI Service] Raw response from ${provider}:`, rawJsonText);

        const jsonString = rawJsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);

    } catch (error) {
        console.error(`[AI Service] Error calling ${provider}:`, error);
        throw new Error(`Failed to generate calculation plan from ${provider}.`);
    }
}

module.exports = { generateCalculationPlan };
