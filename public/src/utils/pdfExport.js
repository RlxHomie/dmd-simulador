// utils/pdfExport.js - VERSIÓN CORREGIDA ✅
import { showNotification } from './notifications.js';

let folioCounter = 0;

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
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount);
}

function generateProfessionalHTML(planData) {
  // Logo SVG inline que siempre funciona
  const logoSVG = `<svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="190" height="50" fill="#0071e3" rx="8"/>
    <text x="100" y="38" font-size="24" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial, sans-serif">DMD ASESORES</text>
  </svg>`;

  // Calcular totales
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
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
        <td style="padding: 12px 8px; font-family: Courier, monospace; font-size: 11px; border: 1px solid #dee2e6;">${deuda.contrato || 'N/A'}</td>
        <td style="padding: 12px 8px; font-size: 12px; border: 1px solid #dee2e6;">${deuda.producto || 'N/A'}</td>
        <td style="padding: 12px 8px; font-weight: 600; font-size: 12px; border: 1px solid #dee2e6;">${deuda.entidad || 'N/A'}</td>
        <td style="padding: 12px 8px; text-align: right; font-size: 12px; border: 1px solid #dee2e6;">${formatCurrency(importe)}</td>
        <td style="padding: 12px 8px; text-align: center; font-weight: bold; color: #dc3545; font-size: 12px; border: 1px solid #dee2e6;">${descuento}%</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #28a745; font-size: 12px; border: 1px solid #dee2e6;">${formatCurrency(importeFinal)}</td>
      </tr>
    `;
  }).join('');

  const descuentoMedio = numDeudas > 0 ? (totalDescuentos / numDeudas) : 0;
  const cuotaMensual = parseFloat(planData.cuotaMensual || 0);
  const numCuotas = parseInt(planData.numCuotas || 0);
  const ahorro = totalOriginal - totalFinal;

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #212529; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px;">
      
      <!-- Cabecera Corporativa con SVG -->
      <div style="background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%); color: white; padding: 30px; text-align: center; margin-bottom: 30px; border-radius: 12px;">
        <div style="margin-bottom: 15px;">${logoSVG}</div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px;">Plan de Reestructuración de Deuda</h1>
        <p style="margin: 15px 0 0; font-size: 18px; opacity: 0.95;">Referencia: ${planData.referencia || 'N/A'}</p>
      </div>

      <!-- Información del Cliente y Plan -->
      <div style="display: flex; gap: 30px; margin-bottom: 30px;">
        <div style="flex: 1;">
          <h3 style="color: #0071e3; margin: 0 0 20px 0; border-bottom: 3px solid #e3f2fd; padding-bottom: 10px; font-size: 18px;">DATOS DEL CLIENTE</h3>
          <p style="margin: 10px 0;"><strong>Nombre:</strong> ${planData.cliente || 'N/A'}</p>
          <p style="margin: 10px 0;"><strong>DNI/NIE:</strong> ${planData.dni || 'N/A'}</p>
          <p style="margin: 10px 0;"><strong>Email:</strong> <span style="color: #0071e3;">${planData.email || 'No especificado'}</span></p>
        </div>
        
        <div style="flex: 1;">
          <h3 style="color: #0071e3; margin: 0 0 20px 0; border-bottom: 3px solid #e3f2fd; padding-bottom: 10px; font-size: 18px;">DATOS DEL PLAN</h3>
          <p style="margin: 10px 0;"><strong>Fecha:</strong> ${new Date(planData.fecha || Date.now()).toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
          <p style="margin: 10px 0;"><strong>Estado:</strong> 
            <span style="background: #e3f2fd; color: #0071e3; padding: 6px 15px; border-radius: 20px; font-size: 13px; font-weight: 500;">
              ${planData.estado?.replace('_', ' ')?.toUpperCase() || 'SIMULADO'}
            </span>
          </p>
        </div>
      </div>

      <!-- Resumen Financiero -->
      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 30px; border-radius: 15px; margin: 30px 0; border-left: 6px solid #0071e3;">
        <h3 style="margin: 0 0 25px 0; color: #0071e3; font-size: 22px; font-weight: 700;">RESUMEN FINANCIERO</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
          <div>
            <div style="margin-bottom: 20px; padding: 20px; background: rgba(220, 53, 69, 0.1); border-radius: 12px; border: 1px solid rgba(220, 53, 69, 0.2);">
              <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Deuda Total Original</div>
              <div style="font-size: 28px; font-weight: 800; color: #dc3545;">${formatCurrency(totalOriginal)}</div>
            </div>
            <div style="margin-bottom: 20px; padding: 20px; background: rgba(253, 126, 20, 0.1); border-radius: 12px; border: 1px solid rgba(253, 126, 20, 0.2);">
              <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Total a Pagar</div>
              <div style="font-size: 28px; font-weight: 800; color: #fd7e14;">${formatCurrency(totalFinal)}</div>
            </div>
          </div>
          
          <div>
            <div style="margin-bottom: 20px; padding: 20px; background: rgba(0, 113, 227, 0.1); border-radius: 12px; border: 1px solid rgba(0, 113, 227, 0.2);">
              <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Cuota Mensual</div>
              <div style="font-size: 32px; font-weight: 900; color: #0071e3;">${formatCurrency(cuotaMensual)}</div>
            </div>
            <div style="margin-bottom: 20px; padding: 20px; background: rgba(40, 167, 69, 0.1); border-radius: 12px; border: 1px solid rgba(40, 167, 69, 0.2);">
              <div style="color: #666; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Ahorro Total</div>
              <div style="font-size: 28px; font-weight: 800; color: #28a745;">${formatCurrency(ahorro)}</div>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 25px; padding-top: 25px; border-top: 2px solid #dee2e6;">
          <span style="color: #666; font-size: 16px; font-weight: 500;">Descuento Promedio: </span>
          <strong style="color: #0071e3; font-size: 22px; margin: 0 20px;">${descuentoMedio.toFixed(1)}%</strong>
          <span style="color: #666; font-size: 16px; font-weight: 500;">Plazo: </span>
          <strong style="color: #0071e3; font-size: 22px;">${numCuotas} meses</strong>
        </div>
      </div>

      <!-- Tabla de Deudas -->
      <div style="margin-top: 30px;">
        <h3 style="color: #0071e3; margin-bottom: 20px; border-bottom: 3px solid #e3f2fd; padding-bottom: 10px; font-size: 20px;">DETALLE DE DEUDAS</h3>
        <table style="width: 100%; border-collapse: collapse; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 10px; overflow: hidden; font-size: 13px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%); color: white;">
              <th style="padding: 15px 10px; text-align: left; font-weight: 700;">Contrato</th>
              <th style="padding: 15px 10px; text-align: left; font-weight: 700;">Producto</th>
              <th style="padding: 15px 10px; text-align: left; font-weight: 700;">Entidad</th>
              <th style="padding: 15px 10px; text-align: right; font-weight: 700;">Original</th>
              <th style="padding: 15px 10px; text-align: center; font-weight: 700;">Desc.</th>
              <th style="padding: 15px 10px; text-align: right; font-weight: 700;">Final</th>
            </tr>
          </thead>
          <tbody>
            ${deudasHTML}
          </tbody>
          <tfoot>
            <tr style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-top: 3px solid #0071e3;">
              <td colspan="3" style="padding: 15px 10px; font-weight: 700; font-size: 14px; text-align: right; border: 1px solid #dee2e6;">TOTALES:</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: 700; font-size: 14px; color: #dc3545; border: 1px solid #dee2e6;">${formatCurrency(totalOriginal)}</td>
              <td style="padding: 15px 10px; text-align: center; font-weight: 700; font-size: 14px; border: 1px solid #dee2e6;">${descuentoMedio.toFixed(1)}%</td>
              <td style="padding: 15px 10px; text-align: right; font-weight: 700; font-size: 14px; color: #28a745; border: 1px solid #dee2e6;">${formatCurrency(totalFinal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Términos y Condiciones -->
      <div style="margin-top: 40px; padding: 25px; background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 12px;">
        <h4 style="margin-top: 0; color: #856404; font-size: 18px; font-weight: 700;">⚠️ TÉRMINOS Y CONDICIONES</h4>
        <ul style="margin: 15px 0; padding-left: 25px; color: #856404; font-size: 14px; line-height: 1.8;">
          <li style="margin-bottom: 8px;">Este plan está sujeto a la aprobación final de las entidades acreedoras</li>
          <li style="margin-bottom: 8px;">Las condiciones pueden variar según la respuesta de cada acreedor</li>
          <li style="margin-bottom: 8px;">El cliente se compromete a mantener al día los pagos acordados</li>
          <li style="margin-bottom: 8px;">DMD Asesores proporcionará seguimiento y gestión integral del plan</li>
        </ul>
      </div>

      <!-- Pie de Página -->
      <div style="text-align: center; font-size: 12px; color: #6c757d; margin-top: 40px; padding-top: 20px; border-top: 2px solid #dee2e6;">
        <p style="margin: 8px 0;">📄 Documento confidencial - Uso exclusivo del cliente</p>
        <p style="margin: 8px 0;">🕒 Generado: ${new Date().toLocaleDateString('es-ES', { 
          weekday: 'long',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        })} a las ${new Date().toLocaleTimeString('es-ES')}</p>
        <p style="margin: 8px 0; font-weight: 600; color: #0071e3;">🏢 DMD Asesores © ${new Date().getFullYear()}</p>
      </div>

    </div>
  `;
}

export async function exportPlanToPDF(planData) {
  try {
    showNotification('Generando PDF profesional...', 'info');
    const h2p = await ensureHtml2PdfLoaded();

    // 1) Nodo preferido (si existe en tu HTML)
    let host = document.getElementById('plan-de-liquidacion');
    const createdHost = !host;
    if (!host) {
      host = document.createElement('div');
      host.id = 'plan-de-liquidacion';
      document.body.appendChild(host);
    }

    // 2) Contenido + visibilidad en DOM real (no dependemos de CSS externo)
    host.innerHTML = generateProfessionalHTML(planData);
    host.classList.add('pdf-generating');
    Object.assign(host.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      visibility: 'visible',
      display: 'block',
      background: '#fff',
      width: '800px',        // A4 ~ 794px a 96dpi
      minHeight: '1200px',   // A4 ~ 1123px; dejamos holgura
      zIndex: '9999'
    });

    // 3) Esperar pintado
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} }

    // 4) Medidas del nodo real
    const w = Math.max(host.scrollWidth, host.offsetWidth, 800);
    const h = Math.max(host.scrollHeight, host.offsetHeight, 1200);
    console.warn(`[PDFDBG] REAL w=${w} h=${h}`);

    const filename = generateFilename(planData);

    // 5) Opciones html2pdf: forzamos tamaño/visibilidad en el CLON
    const opts = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        removeContainer: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: w,
        windowHeight: h,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('plan-de-liquidacion');
          if (el) {
            // 👇 crítico: el clon a veces hereda el estado "oculto"; lo forzamos visible y con tamaño
            el.classList.add('pdf-generating');
            el.style.position = 'absolute';
            el.style.left = '0';
            el.style.top = '0';
            el.style.visibility = 'visible';
            el.style.display = 'block';
            el.style.background = '#fff';
            el.style.width = '800px';
            el.style.minHeight = '1200px';
            el.style.zIndex = '9999';
            const r = el.getBoundingClientRect();
            console.warn(`[PDFDBG] CLONE w=${r.width} h=${r.height}`);
          }
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    // 6) Primer intento con el host habitual
    await h2p().set(opts).from(host).save();

    // 7) Limpieza
    host.classList.remove('pdf-generating');
    host.innerHTML = '';
    if (createdHost) host.remove();

    showNotification(`✅ PDF profesional generado: ${filename}`, 'success');
    return { success: true, filename };
  } catch (error) {
    console.error('❌ Error exportando PDF:', error);

    // --- FALLBACK DURO: contenedor temporal propio si algo fue mal ---
    try {
      const temp = document.createElement('div');
      temp.id = 'pdf-export-temp';
      Object.assign(temp.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        visibility: 'visible',
        display: 'block',
        background: '#fff',
        width: '800px',
        minHeight: '1200px',
        zIndex: '9999',
        padding: '0',
        margin: '0'
      });
      temp.innerHTML = generateProfessionalHTML(planData);
      document.body.appendChild(temp);

      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const w2 = Math.max(temp.scrollWidth, temp.offsetWidth, 800);
      const h2 = Math.max(temp.scrollHeight, temp.offsetHeight, 1200);
      console.warn(`[PDFDBG] FALLBACK REAL w=${w2} h=${h2}`);

      const h2p = await ensureHtml2PdfLoaded();
      await h2p().set({
        margin: [10,10,10,10],
        filename: generateFilename(planData),
        image: { type:'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2, useCORS: true, backgroundColor:'#fff',
          removeContainer:true, scrollX:0, scrollY:0, windowWidth:w2, windowHeight:h2,
          onclone: (cd)=>{ const e=cd.getElementById('pdf-export-temp');
            if(e){ e.style.position='absolute'; e.style.left='0'; e.style.top='0';
              e.style.visibility='visible'; e.style.display='block'; e.style.width='800px'; e.style.minHeight='1200px'; } }
        },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait', compress:true }
      }).from(temp).save();

      temp.remove();
      showNotification('✅ PDF generado con fallback', 'success');
      return { success: true, filename: 'fallback.pdf' };
    } catch (err2) {
      // limpiar y propagar
      const host = document.getElementById('plan-de-liquidacion');
      if (host) { host.classList.remove('pdf-generating'); host.innerHTML=''; }
      showNotification(`Error generando PDF: ${error.message}`, 'error');
      throw error;
    }
  }
}
