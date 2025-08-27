// utils/pdfExport.js - VERSIÓN CORREGIDA + FORMATO PROFESIONAL
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

// Generar HTML profesional del plan
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
      <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'}; border-bottom: 1px solid #e9ecef;">
        <td style="padding: 12px 8px; font-family: 'Courier New', monospace; font-size: 11px; color: #495057;">
          ${deuda.contrato || 'N/A'}
        </td>
        <td style="padding: 12px 8px; font-size: 12px; color: #495057;">${deuda.producto || 'N/A'}</td>
        <td style="padding: 12px 8px; font-weight: 600; font-size: 12px; color: #495057;">${deuda.entidad || 'N/A'}</td>
        <td style="padding: 12px 8px; text-align: right; font-size: 12px; color: #495057;">${formatCurrency(importe)}</td>
        <td style="padding: 12px 8px; text-align: center; font-weight: 700; color: #dc3545; font-size: 12px;">
          ${descuento}%
        </td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #28a745; font-size: 12px;">
          ${formatCurrency(importeFinal)}
        </td>
      </tr>
    `;
  }).join('');

  const descuentoMedio = numDeudas > 0 ? (totalDescuentos / numDeudas) : 0;
  const cuotaMensual = parseFloat(planData.cuotaMensual || 0);
  const numCuotas = parseInt(planData.numCuotas || 0);
  const ahorro = totalOriginal - totalFinal;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.6; }
      </style>
    </head>
    <body style="padding: 0; margin: 0;">
      <div style="max-width: 100%; padding: 0; margin: 0;">
        
        <!-- Cabecera Corporativa -->
        <div style="background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%); color: white; padding: 30px; text-align: center; margin-bottom: 30px; border-radius: 0;">
          <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">DMD ASESORES</h1>
          <h2 style="margin: 12px 0 0 0; font-size: 20px; font-weight: 400; opacity: 0.95;">Plan de Reestructuración de Deuda</h2>
        </div>

        <!-- Información del Cliente y Plan -->
        <div style="display: table; width: 100%; margin-bottom: 30px;">
          <div style="display: table-cell; width: 50%; vertical-align: top; padding-right: 15px;">
            <h3 style="color: #0071e3; margin: 0 0 20px 0; border-bottom: 3px solid #e3f2fd; padding-bottom: 10px; font-size: 18px; font-weight: 600;">DATOS DEL CLIENTE</h3>
            <table style="width: 100%; font-size: 14px; border-spacing: 0;">
              <tr><td style="padding: 6px 0; width: 80px; font-weight: 600; color: #495057;">Nombre:</td><td style="padding: 6px 0; color: #212529;">${planData.cliente || 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600; color: #495057;">DNI/NIE:</td><td style="padding: 6px 0; font-family: 'Courier New', monospace; color: #212529;">${planData.dni || 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600; color: #495057;">Email:</td><td style="padding: 6px 0; color: #0071e3;">${planData.email || 'No especificado'}</td></tr>
            </table>
          </div>
          
          <div style="display: table-cell; width: 50%; vertical-align: top; padding-left: 15px;">
            <h3 style="color: #0071e3; margin: 0 0 20px 0; border-bottom: 3px solid #e3f2fd; padding-bottom: 10px; font-size: 18px; font-weight: 600;">DATOS DEL PLAN</h3>
            <table style="width: 100%; font-size: 14px; border-spacing: 0;">
              <tr><td style="padding: 6px 0; width: 80px; font-weight: 600; color: #495057;">Referencia:</td><td style="padding: 6px 0; font-family: 'Courier New', monospace; color: #0071e3; font-weight: 600;">${planData.referencia || 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600; color: #495057;">Fecha:</td><td style="padding: 6px 0; color: #212529;">${new Date(planData.fecha || Date.now()).toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</td></tr>
              <tr><td style="padding: 6px 0; font-weight: 600; color: #495057;">Estado:</td><td style="padding: 6px 0;">
                <span style="background: #e3f2fd; color: #0071e3; padding: 6px 15px; border-radius: 20px; font-size: 13px; font-weight: 500;">
                  ${planData.estado || 'Simulado'}
                </span>
              </td></tr>
            </table>
          </div>
        </div>

        <!-- Resumen Financiero -->
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 30px; border-radius: 15px; margin: 30px 0; border-left: 6px solid #0071e3;">
          <h3 style="margin: 0 0 25px 0; color: #0071e3; font-size: 22px; font-weight: 700;">RESUMEN FINANCIERO</h3>
          <div style="display: table; width: 100%;">
            <div style="display: table-cell; width: 50%; vertical-align: top; padding-right: 15px;">
              <div style="margin-bottom: 20px; padding: 18px; background: rgba(220, 53, 69, 0.1); border-radius: 12px; border: 1px solid rgba(220, 53, 69, 0.2);">
                <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Deuda Total Original</div>
                <div style="font-size: 24px; font-weight: 800; color: #dc3545;">${formatCurrency(totalOriginal)}</div>
              </div>
              <div style="margin-bottom: 20px; padding: 18px; background: rgba(253, 126, 20, 0.1); border-radius: 12px; border: 1px solid rgba(253, 126, 20, 0.2);">
                <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Total a Pagar</div>
                <div style="font-size: 24px; font-weight: 800; color: #fd7e14;">${formatCurrency(totalFinal)}</div>
              </div>
            </div>
            
            <div style="display: table-cell; width: 50%; vertical-align: top; padding-left: 15px;">
              <div style="margin-bottom: 20px; padding: 18px; background: rgba(0, 113, 227, 0.1); border-radius: 12px; border: 1px solid rgba(0, 113, 227, 0.2);">
                <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Cuota Mensual</div>
                <div style="font-size: 28px; font-weight: 900; color: #0071e3;">${formatCurrency(cuotaMensual)}</div>
              </div>
              <div style="margin-bottom: 20px; padding: 18px; background: rgba(40, 167, 69, 0.1); border-radius: 12px; border: 1px solid rgba(40, 167, 69, 0.2);">
                <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Ahorro Total</div>
                <div style="font-size: 24px; font-weight: 800; color: #28a745;">${formatCurrency(ahorro)}</div>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 25px; padding-top: 25px; border-top: 2px solid #dee2e6;">
            <div style="display: inline-block; margin: 0 25px;">
              <span style="color: #666; font-size: 15px; font-weight: 500;">Descuento Promedio:</span>
              <strong style="color: #0071e3; font-size: 20px; margin-left: 10px;">${descuentoMedio.toFixed(1)}%</strong>
            </div>
            <div style="display: inline-block; margin: 0 25px;">
              <span style="color: #666; font-size: 15px; font-weight: 500;">Plazo:</span>
              <strong style="color: #0071e3; font-size: 20px; margin-left: 10px;">${numCuotas} meses</strong>
            </div>
          </div>
        </div>

        <!-- Salto de Página -->
        <div style="page-break-before: always;"></div>

        <!-- Tabla de Deudas -->
        <div style="margin-top: 30px;">
          <h3 style="color: #0071e3; margin-bottom: 20px; border-bottom: 3px solid #e3f2fd; padding-bottom: 10px; font-size: 20px; font-weight: 600;">DETALLE DE DEUDAS</h3>
          <table style="width: 100%; border-collapse: collapse; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 10px; overflow: hidden; font-size: 13px; border: 1px solid #dee2e6;">
            <thead>
              <tr style="background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%); color: white;">
                <th style="padding: 15px 10px; text-align: left; font-weight: 700; font-size: 13px;">Contrato</th>
                <th style="padding: 15px 10px; text-align: left; font-weight: 700; font-size: 13px;">Producto</th>
                <th style="padding: 15px 10px; text-align: left; font-weight: 700; font-size: 13px;">Entidad</th>
                <th style="padding: 15px 10px; text-align: right; font-weight: 700; font-size: 13px;">Original</th>
                <th style="padding: 15px 10px; text-align: center; font-weight: 700; font-size: 13px;">Desc.</th>
                <th style="padding: 15px 10px; text-align: right; font-weight: 700; font-size: 13px;">Final</th>
              </tr>
            </thead>
            <tbody>
              ${deudasHTML}
            </tbody>
            <tfoot>
              <tr style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-top: 3px solid #0071e3;">
                <td colspan="3" style="padding: 15px 10px; font-weight: 700; font-size: 14px; text-align: right; color: #495057;">TOTALES:</td>
                <td style="padding: 15px 10px; text-align: right; font-weight: 700; font-size: 14px; color: #dc3545;">${formatCurrency(totalOriginal)}</td>
                <td style="padding: 15px 10px; text-align: center; font-weight: 700; font-size: 14px; color: #495057;">${descuentoMedio.toFixed(1)}%</td>
                <td style="padding: 15px 10px; text-align: right; font-weight: 700; font-size: 14px; color: #28a745;">${formatCurrency(totalFinal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Términos y Condiciones -->
        <div style="margin-top: 40px; padding: 25px; background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 12px;">
          <h4 style="margin-top: 0; color: #856404; font-size: 18px; font-weight: 700; display: flex; align-items: center;">
            <span style="margin-right: 8px;">⚠️</span> TÉRMINOS Y CONDICIONES
          </h4>
          <ul style="margin: 15px 0; padding-left: 25px; color: #856404; font-size: 14px; line-height: 1.8;">
            <li style="margin-bottom: 8px;">Este plan está sujeto a la aprobación final de las entidades acreedoras</li>
            <li style="margin-bottom: 8px;">Las condiciones pueden variar según la respuesta de cada acreedor</li>
            <li style="margin-bottom: 8px;">El cliente se compromete a mantener al día los pagos acordados</li>
            <li style="margin-bottom: 8px;">DMD Asesores proporcionará seguimiento y gestión integral del plan</li>
          </ul>
        </div>

        <!-- Pie de Página -->
        <div style="text-align: center; font-size: 12px; color: #6c757d; margin-top: 40px; padding-top: 20px; border-top: 2px solid #dee2e6;">
          <p style="margin: 8px 0; font-weight: 500;">📄 Documento confidencial - Uso exclusivo del cliente</p>
          <p style="margin: 8px 0;">🕒 Generado: ${new Date().toLocaleDateString('es-ES', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
          })} a las ${new Date().toLocaleTimeString('es-ES')}</p>
          <p style="margin: 8px 0; font-weight: 600; color: #0071e3;">🏢 DMD Asesores - Especialistas en reestructuración de deuda</p>
        </div>

      </div>
    </body>
    </html>
  `;
}

// Función principal para exportar PDF - CORREGIDA
export async function exportPlanToPDF(planData) {
  try {
    showNotification('Generando PDF profesional...', 'info');

    // Validar datos
    if (!planData) {
      throw new Error('No hay datos del plan para exportar');
    }

    // Cargar librería
    const html2pdf = await ensureHtml2PdfLoaded();

    // Crear contenedor temporal pero COMPLETAMENTE VISIBLE
    let container = document.getElementById('plan-de-liquidacion-temp');
    if (container) {
      container.remove();
    }
    
    container = document.createElement('div');
    container.id = 'plan-de-liquidacion-temp';
    container.innerHTML = generatePlanHTML(planData);
    
    // HACER VISIBLE: La clave está aquí
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.width = '210mm';
    container.style.backgroundColor = 'white';
    container.style.zIndex = '-1000'; // Detrás pero VISIBLE
    container.style.opacity = '1';
    container.style.visibility = 'visible';
    container.style.display = 'block';
    
    // CRUCIAL: Agregar al body PRIMERO
    document.body.appendChild(container);
    
    // Esperar a que se renderice completamente
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    // Verificar visibilidad
    console.log('📐 Container visible:', container.offsetParent !== null);
    console.log('📏 Dimensions:', container.offsetWidth, 'x', container.offsetHeight);

    // Configuración optimizada
    const filename = generateFilename(planData);
    const options = {
      margin: [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200,
        windowHeight: 1600,
        logging: false
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

    // Limpiar
    container.remove();

    showNotification(`PDF descargado: ${filename}`, 'success');
    
    return { success: true, filename };

  } catch (error) {
    console.error('Error exportando PDF:', error);
    showNotification(`Error al generar PDF: ${error.message}`, 'error');
    throw error;
  }
}
