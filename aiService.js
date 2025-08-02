const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require('node-fetch');
const { API_KEYS, OPENROUTER_MODELS, FORMULA_LATEX_TEMPLATES, VARIABLE_DESCRIPTIONS } = require('./config.js');

// --- Construcción del Prompt del Sistema ---
const formulaKnowledgeBase = Object.keys(FORMULA_LATEX_TEMPLATES)
    .map(key => `- ${key}`)
    .join('\n');

const variableDictionary = Object.entries(VARIABLE_DESCRIPTIONS)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

const currentYear = new Date().getFullYear();

// --- Prompt del Sistema para la Generación de Planes ---
const PLAN_GENERATION_SYSTEM_PROMPT = `
Eres un experto en finanzas que crea planes de cálculo para resolver problemas de matemática financiera.
Tu única función es analizar un problema financiero y generar un plan de cálculo secuencial en estricto formato JSON por que hay un sistema que lo resulve.
Tu salida DEBE ser única y exclusivamente el objeto JSON. No incluyas absolutamente ningún texto adicional, explicaciones, o formato markdown.

REGLAS CRÍTICAS (NO ROMPER NUNCA):
- Tu única salida debe ser un objeto JSON válido. Nada de texto antes o después.
- NO INVENTES FÓRMULAS. Debes usar ÚNICAMENTE los nombres de la \`LISTA DE FÓRMULAS DISPONIBLES\`. Si creas una fórmula que no está en la lista, el plan fallará porque la calculadora especializada no la reconocerá.
- NO HAGAS CÁLCULOS en \`initial_data\` ni en los \`inputs\`. Usa un paso de cálculo para CADA operación matemática (suma, división, etc.), usando las fórmulas de utilidad.
- NOMBRES DE VARIABLES: Usa una sola palabra con guiones bajos (ej: \`tasa_mensual\`).
- REFERENCIAS A VARIABLES: Usa la sintaxis exacta \`{{nombre_variable}}\`. NUNCA uses expresiones como \`{{var1 / var2}}\`.
- PARÁMETROS DE ENTRADA (inputs): Las claves del objeto 'inputs' DEBEN coincidir con los nombres de las variables que espera la fórmula (ej: P, i, n, i_conocida).
- MANEJO DE ERRORES: Si el problema no se puede resolver (faltan datos), devuelve este JSON y nada más: \`{"error": "Faltan datos para resolver el problema."}\`

PROCESO A SEGUIR:
1.  \`interpretation\`: Describe brevemente el plan para resolver el problema.
2.  \`initial_data\`: Extrae los datos BRUTOS del problema. Usa el \`DICCIONARIO DE VARIABLES\`. Si una fecha no tiene año, asume el año actual (${currentYear}).
3.  \`calculation_steps\`: Un array de pasos. Cada paso es una operación de la \`LISTA DE FÓRMULAS\`.
4.  \`final_variable\`: El nombre de la variable final que se pide calcular.

DICCIONARIO DE VARIABLES:
${variableDictionary}

LISTA DE FÓRMULAS DISPONIBLES:
${formulaKnowledgeBase}

EJEMPLO DE PLAN VÁLIDO:
Problema: "Convierta una tasa efectiva de 72.8 días cuyo valor es de 0.0168 en una tasa efectiva de 187 días."
JSON ESPERADO:
{
  "interpretation": "Se necesita convertir una tasa efectiva a otra tasa efectiva con un plazo diferente, usando la fórmula de tasas equivalentes.",
  "initial_data": { "i_conocida": 0.0168, "n_dias_conocido": 72.8, "n_dias_deseado": 187 },
  "final_variable": "i_equivalente_187_dias",
  "calculation_steps": [
    {
      "step_name": "Calcular Tasa Efectiva Equivalente para 187 días",
      "target_variable": "i_equivalente_187_dias",
      "formula_name": "formula_tasa_equivalente",
      "inputs": { "i_conocida": "{{i_conocida}}", "n_dias_conocido": "{{n_dias_conocido}}", "n_dias_deseado": "{{n_dias_deseado}}" }
    }
  ]
}

RECUERDA: TU ÚNICA SALIDA DEBE SER EL OBJETO JSON CRUDO.
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
