// utils/pdfExport.js - Módulo ES6 para exportar PDF
import { showNotification } from './notifications.js';

let folioCounter = 0;

// Cargar html2pdf dinámicamente si no está disponible
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

// Generar nombre de archivo único
function generateFilename(planData) {
  const counter = ++folioCounter;
  const clientName = (planData.cliente || 'Plan').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${clientName}_${date}_${String(counter).padStart(4, '0')}.pdf`;
}

// Formatear moneda
function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '€0.00';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Generar HTML del plan
function generatePlanHTML(planData) {
  // Calcular totales desde las deudas
  let totalOriginal = 0;
  let totalFinal = 0;
  let totalDescuentos = 0;
  let numDeudas = 0;

  const deudasHTML = (planData.deudas || []).map((deuda, index) => {
    const importe = parseFloat(deuda.importeOriginal || 0);
    const descuento = parseFloat(deuda.descuento || 0);
    const importeFinal = parseFloat(deuda.importeFinal || importe * (1 - descuento / 100));

    if (importe > 0) {
      totalOriginal += importe;
      totalFinal += importeFinal;
      totalDescuentos += descuento;
      numDeudas++;
    }

    return `
      <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 11px;">
          ${deuda.contrato || 'N/A'}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${deuda.producto || 'N/A'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: 500;">${deuda.entidad || 'N/A'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(importe)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-weight: 600; color: #dc3545;">
          ${descuento}%
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: 600; color: #28a745;">
          ${formatCurrency(importeFinal)}
        </td>
      </tr>
    `;
  }).join('');

  const descuentoMedio = numDeudas > 0 ? (totalDescuentos / numDeudas) : 0;
  const cuotaMensual = parseFloat(planData.cuotaMensual || 0);
  const numCuotas = parseInt(planData.numCuotas || 0);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.5; max-width: 100%;">
      <!-- Cabecera corporativa -->
      <div style="background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%); color: white; padding: 25px; text-align: center; margin-bottom: 25px; border-radius: 12px; print-color-adjust: exact;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 700;">DMD ASESORES</h1>
        <h2 style="margin: 10px 0 0 0; font-size: 18px; font-weight: 400; opacity: 0.9;">Plan de Reestructuración de Deuda</h2>
      </div>

      <!-- Información del cliente -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 25px;">
        <div>
          <h3 style="color: #0071e3; margin-bottom: 15px; border-bottom: 2px solid #e3f2fd; padding-bottom: 8px;">DATOS DEL CLIENTE</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 4px 0; width: 80px; font-weight: 600;">Nombre:</td><td>${planData.cliente || 'N/A'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">DNI/NIE:</td><td>${planData.dni || 'N/A'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">Email:</td><td>${planData.email || 'No especificado'}</td></tr>
          </table>
        </div>
        <div>
          <h3 style="color: #0071e3; margin-bottom: 15px; border-bottom: 2px solid #e3f2fd; padding-bottom: 8px;">DATOS DEL PLAN</h3>
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 4px 0; width: 80px; font-weight: 600;">Referencia:</td><td style="font-family: monospace;">${planData.referencia || 'N/A'}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">Fecha:</td><td>${new Date(planData.fecha || Date.now()).toLocaleDateString('es-ES')}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">Estado:</td><td>
              <span style="background: #e3f2fd; color: #0071e3; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                ${planData.estado || 'Simulado'}
              </span>
            </td></tr>
          </table>
        </div>
      </div>

      <!-- Resumen financiero -->
      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 5px solid #0071e3;">
        <h3 style="margin: 0 0 20px 0; color: #0071e3; font-size: 20px;">RESUMEN FINANCIERO</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <div style="margin-bottom: 15px;">
              <div style="color: #666; font-size: 13px; margin-bottom: 4px;">Deuda Total Original</div>
              <div style="font-size: 20px; font-weight: 700; color: #dc3545;">${formatCurrency(totalOriginal)}</div>
            </div>
            <div style="margin-bottom: 15px;">
              <div style="color: #666; font-size: 13px; margin-bottom: 4px;">Total a Pagar</div>
              <div style="font-size: 20px; font-weight: 700; color: #fd7e14;">${formatCurrency(totalFinal)}</div>
            </div>
          </div>
          <div>
            <div style="margin-bottom: 15px;">
              <div style="color: #666; font-size: 13px; margin-bottom: 4px;">Cuota Mensual</div>
              <div style="font-size: 24px; font-weight: 800; color: #0071e3;">${formatCurrency(cuotaMensual)}</div>
            </div>
            <div style="margin-bottom: 15px;">
              <div style="color: #666; font-size: 13px; margin-bottom: 4px;">Ahorro Total</div>
              <div style="font-size: 20px; font-weight: 700; color: #28a745;">${formatCurrency(totalOriginal - totalFinal)}</div>
            </div>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <span style="color: #666;">Descuento Promedio: </span>
          <strong style="color: #0071e3; font-size: 18px;">${descuentoMedio.toFixed(1)}%</strong>
          <span style="margin-left: 25px; color: #666;">Plazo: </span>
          <strong style="color: #0071e3;">${numCuotas} meses</strong>
        </div>
      </div>

      <div class="html2pdf__page-break"></div>

      <!-- Tabla de deudas -->
      <div style="margin-top: 25px;">
        <h3 style="color: #0071e3; margin-bottom: 15px; border-bottom: 2px solid #e3f2fd; padding-bottom: 8px;">DETALLE DE DEUDAS</h3>
        <table style="width: 100%; border-collapse: collapse; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; font-size: 12px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%); color: white;">
              <th style="padding: 12px 10px; text-align: left; font-weight: 600;">Contrato</th>
              <th style="padding: 12px 10px; text-align: left; font-weight: 600;">Producto</th>
              <th style="padding: 12px 10px; text-align: left; font-weight: 600;">Entidad</th>
              <th style="padding: 12px 10px; text-align: right; font-weight: 600;">Original</th>
              <th style="padding: 12px 10px; text-align: center; font-weight: 600;">Desc.</th>
              <th style="padding: 12px 10px; text-align: right; font-weight: 600;">Final</th>
            </tr>
          </thead>
          <tbody>
            ${deudasHTML}
          </tbody>
          <tfoot>
            <tr style="background: #f8f9fa; border-top: 2px solid #0071e3;">
              <td colspan="3" style="padding: 12px 10px; font-weight: 700; text-align: right;">TOTALES:</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 700; color: #dc3545;">${formatCurrency(totalOriginal)}</td>
              <td style="padding: 12px 10px; text-align: center; font-weight: 700;">${descuentoMedio.toFixed(1)}%</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 700; color: #28a745;">${formatCurrency(totalFinal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Términos -->
      <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
        <h4 style="margin-top: 0; color: #856404;">⚠️ TÉRMINOS Y CONDICIONES</h4>
        <ul style="margin: 10px 0; padding-left: 20px; color: #856404; font-size: 13px; line-height: 1.5;">
          <li>Este plan está sujeto a la aprobación de las entidades acreedoras</li>
          <li>El cliente debe mantener al día el pago de las cuotas acordadas</li>
          <li>DMD Asesores realizará el seguimiento y gestión del plan</li>
        </ul>
      </div>

      <!-- Pie -->
      <div style="text-align: center; font-size: 11px; color: #666; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd;">
        <p style="margin: 5px 0;">📄 Documento confidencial - Uso exclusivo del cliente</p>
        <p style="margin: 5px 0;">🕒 Generado: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
        <p style="margin: 5px 0;">🏢 DMD Asesores - Especialistas en reestructuración de deuda</p>
      </div>
    </div>
  `;
}

// Función principal para exportar PDF
export async function exportPlanToPDF(planData) {
  try {
    showNotification('Generando PDF profesional...', 'info');

    // Validar datos
    if (!planData) {
      throw new Error('No hay datos del plan para exportar');
    }

    // Cargar librería si es necesario
    const html2pdf = await ensureHtml2PdfLoaded();

    // Crear contenedor temporal
    let container = document.getElementById('plan-de-liquidacion');
    if (!container) {
      container = document.createElement('div');
      container.id = 'plan-de-liquidacion';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '210mm';
      container.style.backgroundColor = 'white';
      container.style.padding = '20px';
      container.style.fontFamily = 'Arial, sans-serif';
      document.body.appendChild(container);
    }

    // Generar contenido HTML
    container.innerHTML = generatePlanHTML(planData);

    // Configuración del PDF
    const filename = generateFilename(planData);
    const options = {
      margin: [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Generar PDF
    await html2pdf().from(container).set(options).save();

    showNotification(`PDF descargado: ${filename}`, 'success');
    
    return { success: true, filename };

  } catch (error) {
    console.error('Error exportando PDF:', error);
    showNotification(`Error al generar PDF: ${error.message}`, 'error');
    throw error;
  }
}
