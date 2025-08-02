require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const { generateCalculationPlan } = require('./aiService.js');
const { executePlan } = require('./calculationEngine.js');
const { generateImage } = require('./imageGenerator.js');

// --- Configuración de Twilio y Express ---
const app = express();
app.use(express.urlencoded({ extended: false }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // Formato: 'whatsapp:+14155238886'

// --- Configuración de Comandos ---
const commandMap = {
    '!resolver1': 'gemini_studio',
    '/resolver1': 'gemini_studio',
    '#resolver1': 'gemini_studio',
    '!resolver2': 'kimi',
    '/resolver2': 'kimi',
    '#resolver2': 'kimi',
    '!resolver3': 'mistral',
    '/resolver3': 'mistral',
    '#resolver3': 'mistral',
    '!resolver4': 'llama',
    '/resolver4': 'llama',
    '#resolver4': 'llama',
    '!resolver5': 'deepseek',
    '/resolver5': 'deepseek',
    '#resolver5': 'deepseek',
};

// --- Ruta del Webhook para Twilio ---
app.post('/whatsapp', async (req, res) => {
    const incomingMsg = req.body.Body;
    const from = req.body.From;

    console.log(`[+] Mensaje recibido de ${from}: "${incomingMsg}"`);

    await handleMessage(incomingMsg, from);

    res.status(200).send('Message received');
});

// --- Lógica Principal del Bot ---
async function handleMessage(messageBody, from) {
    const messageText = messageBody.trim().toLowerCase(); // Convertimos a minúsculas para que !menu, !Menu, etc. funcionen
    let usedCommand = null;

    // =================================================================
    // 1. AÑADIMOS LA LÓGICA PARA EL COMANDO !menu
    // =================================================================
    if (messageText === '!menu' || messageText === '/menu' || messageText === '#menu') {
        const welcomeMessage = `👋 ¡Hola! Soy tu asistente de Matemática Financiera.

Puedes usar los siguientes comandos para resolver problemas:
* *!resolver1* (Recomendado ✨)
* *!resolver2*
* *!resolver3*
* *!resolver4*
* *!resolver5*

Simplemente escribe el comando seguido de tu problema.
*Ejemplo:* \`!resolver1 ¿Cuál es el interés simple de S/1000 al 5% anual por 2 años?\``;
        
        await sendMessage(welcomeMessage, from);
        return; // Detenemos la ejecución para que no busque otros comandos
    }
    // =================================================================

    for (const command in commandMap) {
        if (messageText.startsWith(command)) {
            usedCommand = command;
            break;
        }
    }

    if (!usedCommand) {
        // Si no es !menu ni un comando de resolución, no hace nada.
        return; 
    }

    const provider = commandMap[usedCommand];
    const userProblem = messageBody.trim().substring(usedCommand.length).trim();

    if (!userProblem) {
        await sendMessage(`Por favor, escribe un problema después del comando ${usedCommand}.`, from);
        return;
    }

    try {
        console.log(`[+] Comando: ${usedCommand} | Proveedor: ${provider} | Problema: "${userProblem}"`);
        await sendMessage(`Analizando con ${provider}... 🧠✨`, from);

        const plan = await generateCalculationPlan(provider, userProblem);
        const executedSteps = executePlan(plan);
        const imageBuffer = generateImage(plan.interpretation, executedSteps);

        await sendMedia(imageBuffer, from);
        console.log(`[+] Solución enviada a ${from}`);

    } catch (error) {
        console.error(`Error procesando con ${provider}:`, error);
        await sendMessage(`Lo siento, ocurrió un error con el proveedor ${provider}. Detalles: ${error.message}`, from);
    }
}

// --- Funciones de Envío de Mensajes con Twilio ---
async function sendMessage(text, to) {
    try {
        await client.messages.create({
            body: text,
            from: twilioPhoneNumber,
            to: to
        });
    } catch (error) {
        console.error('Error al enviar mensaje de texto:', error);
    }
}

async function sendMedia(imageBuffer, to) {
    try {
        const media = await client.media.uploads.create({ 
            media: imageBuffer, 
            contentType: 'image/png' 
        });

        await client.messages.create({
            mediaUrl: [media.mediaUrl],
            from: twilioPhoneNumber,
            to: to
        });
    } catch (error) {
        console.error('Error al enviar imagen:', error);
    }
}

// --- Inicialización del Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    console.log('Configura tu webhook de Twilio para que apunte a esta URL + /whatsapp');
});
