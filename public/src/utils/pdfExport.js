// utils/pdfExport.js - TEST DIRECTO SIN TRUCOS
import { showNotification } from './notifications.js';

let folioCounter = 0;

// Cargar html2pdf
async function ensureHtml2PdfLoaded() {
  if (typeof html2pdf !== 'undefined') {
    return html2pdf;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => reject(new Error('No se pudo cargar html2pdf'));
    document.head.appendChild(script);
  });
}

function generateFilename(planData) {
  const counter = ++folioCounter;
  const clientName = (planData.cliente || 'Plan').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${clientName}_${date}_${String(counter).padStart(4, '0')}.pdf`;
}

function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '€0.00';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

// Función SÚPER SIMPLE que sabemos funciona
export async function exportPlanToPDF(planData) {
  try {
    showNotification('Generando PDF (test simple)...', 'info');

    // Cargar html2pdf
    const html2pdf = await ensureHtml2PdfLoaded();
    console.log('✅ html2pdf cargado');

    // Crear elemento DIRECTAMENTE visible en la página
    const testDiv = document.createElement('div');
    testDiv.id = 'pdf-test-visible';
    
    // CONTENIDO SÚPER SIMPLE
    testDiv.innerHTML = `
      <h1 style="color: red; font-size: 24px; margin: 20px;">DMD ASESORES - TEST</h1>
      <h2 style="color: blue;">Cliente: ${planData.cliente || 'Sin nombre'}</h2>
      <div style="background: yellow; padding: 20px; margin: 20px 0;">
        <p><strong>Referencia:</strong> ${planData.referencia}</p>
        <p><strong>DNI:</strong> ${planData.dni}</p>
        <p><strong>Email:</strong> ${planData.email}</p>
        <p><strong>Deuda Total:</strong> ${formatCurrency(planData.deudaTotal || 0)}</p>
      </div>
      <p style="font-size: 18px; font-weight: bold;">Si ves esto, el PDF funciona! ✅</p>
    `;

    // Estilos para hacerlo TOTALMENTE visible
    testDiv.style.cssText = `
      position: fixed;
      top: 100px;
      left: 100px;
      width: 600px;
      height: 400px;
      background: white;
      border: 3px solid red;
      padding: 20px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;

    // Agregar al DOM
    document.body.appendChild(testDiv);
    console.log('✅ Div agregado al DOM');
    console.log('📏 Visible:', testDiv.offsetParent !== null, 'Dimensiones:', testDiv.offsetWidth, 'x', testDiv.offsetHeight);

    // Esperar 500ms para asegurar renderizado
    await new Promise(resolve => setTimeout(resolve, 500));

    // Configuración MUY BÁSICA
    const filename = generateFilename(planData);
    console.log('📄 Generando:', filename);

    // GENERAR PDF DIRECTAMENTE del elemento visible
    await html2pdf()
      .from(testDiv)
      .set({
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.8 },
        html2canvas: { 
          scale: 1,
          logging: true,
          useCORS: true
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        }
      })
      .save();

    console.log('✅ PDF generado!');

    // Remover el div después de 2 segundos
    setTimeout(() => {
      if (testDiv && testDiv.parentNode) {
        testDiv.remove();
      }
    }, 2000);

    showNotification(`✅ PDF generado: ${filename}`, 'success');
    return { success: true, filename };

  } catch (error) {
    console.error('❌ Error:', error);
    showNotification(`❌ Error: ${error.message}`, 'error');
    throw error;
  }
}
