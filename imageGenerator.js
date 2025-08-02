const { createCanvas } = require('canvas');
const { FORMULA_LATEX_TEMPLATES } = require('./config.js');

/**
 * Genera una imagen con la solución del problema, incluyendo fórmulas LaTeX.
 * @param {string} interpretation - La interpretación del problema.
 * @param {Array<object>} steps - Los pasos de cálculo ejecutados.
 * @returns {Buffer} Un buffer de la imagen en formato PNG.
 */
function generateImage(interpretation, steps) {
    // --- Configuración de Estilos y Medidas ---
    const padding = 40;
    const lineHeight = 35;
    const titleFontSize = 22;
    const stepNameFontSize = 18;
    const latexFontSize = 16;
    const substitutedFontSize = 15;
    const headerHeight = 80;
    const stepSpacing = 25;

    // --- Cálculo Dinámico de la Altura ---
    let totalHeight = headerHeight + padding * 2;
    steps.forEach(step => {
        totalHeight += lineHeight * 3 + stepSpacing; // Espacio para nombre, latex, sustituida y resultado
    });

    const canvas = createCanvas(800, totalHeight);
    const ctx = canvas.getContext('2d');

    // --- Dibujo en el Canvas ---
    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Título (Interpretación del problema)
    ctx.fillStyle = '#1E3A8A'; // Azul oscuro
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(wrapText(ctx, interpretation, canvas.width - padding * 2), canvas.width / 2, padding + titleFontSize);

    // Línea separadora
    ctx.strokeStyle = '#E5E7EB'; // Gris claro
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, headerHeight);
    ctx.lineTo(canvas.width - padding, headerHeight);
    ctx.stroke();

    // --- Iterar y Dibujar Pasos de Cálculo ---
    let currentY = headerHeight + padding;
    ctx.textAlign = 'left';

    steps.forEach((step, index) => {
        // 1. Nombre del Paso
        ctx.fillStyle = '#111827'; // Casi negro
        ctx.font = `bold ${stepNameFontSize}px Arial`;
        ctx.fillText(`${index + 1}. ${step.step_name}`, padding, currentY);
        currentY += lineHeight;

        // 2. Fórmula LaTeX Original
        const latexFormula = FORMULA_LATEX_TEMPLATES[step.formula_name] || "Fórmula no encontrada";
        ctx.fillStyle = '#6B7280'; // Gris medio
        ctx.font = `${latexFontSize}px 'Latin Modern Math', 'Courier New', monospace`;
        ctx.fillText(`Fórmula: ${latexFormula}`, padding + 15, currentY);
        currentY += lineHeight;

        // 3. Fórmula Sustituida y Resultado
        ctx.fillStyle = '#1E88E5'; // Azul vibrante
        ctx.font = `bold ${substitutedFontSize}px 'Courier New', monospace`;
        ctx.fillText(`Cálculo: ${step.substituted_formula}`, padding + 15, currentY);
        currentY += lineHeight + stepSpacing;
    });

    return canvas.toBuffer('image/png');
}

/**
 * Ayudante para ajustar el texto a un ancho máximo.
 */
function wrapText(context, text, maxWidth) {
    const words = text.split(' ');
    let line = '';
    let result = '';

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            result += line + '\n';
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    result += line;
    return result;
}

/**
 * Genera una imagen de bienvenida con la lista de comandos.
 * @returns {Buffer} Un buffer de la imagen en formato PNG.
 */
function generateWelcomeImage() {
    const width = 800;
    const height = 550;
    const padding = 50;
    const lineHeight = 40;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fondo con degradado azul
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1E3A8A'); // Azul oscuro
    gradient.addColorStop(1, '#3B82F6'); // Azul más claro
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Título principal
    ctx.fillStyle = '#FFFFFF'; // Texto blanco
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('¡Bienvenido!', width / 2, padding + 60);

    // Subtítulo
    ctx.font = '24px Arial';
    ctx.fillText('Soy tu Asistente de Matemática Financiera', width / 2, padding + 120);

    // Lista de comandos
    ctx.textAlign = 'left';
    ctx.font = '22px Arial';
    let currentY = padding + 220;
    
    const commands = [
        { cmd: '!resolver1', desc: '(Recomendado ✨)' },
        { cmd: '!resolver2', desc: '' },
        { cmd: '!resolver3', desc: '' },
        { cmd: '!resolver4', desc: '' },
        { cmd: '!resolver5', desc: '' },
