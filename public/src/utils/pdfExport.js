// utils/pdfExport.js - Versión DEBUG
import { showNotification } from './notifications.js';

let folioCounter = 0;

// Cargar html2pdf dinámicamente si no está disponible
async function ensureHtml2PdfLoaded() {
  if (typeof html2pdf !== 'undefined') {
    console.log('✅ html2pdf ya está disponible');
    return html2pdf;
  }

  console.log('⚠️ Cargando html2pdf dinámicamente...');
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      console.log('✅ html2pdf cargado exitosamente');
      resolve(window.html2pdf);
    };
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

// Función principal para exportar PDF - VERSION DEBUG
export async function exportPlanToPDF(planData) {
  console.log('🔍 DEBUG: Iniciando exportPlanToPDF');
  console.log('📊 Datos del plan recibidos:', planData);
  
  try {
    showNotification('Generando PDF (modo debug)...', 'info');

    // Validar datos
    if (!planData) {
      throw new Error('No hay datos del plan para exportar');
    }

    console.log('✅ Datos validados correctamente');

    // Cargar librería si es necesario
    const html2pdf = await ensureHtml2PdfLoaded();
    console.log('✅ html2pdf disponible:', typeof html2pdf);

    // CREAR CONTENIDO HTML SIMPLE PARA PRUEBA
    const testHTML = `
      <div style="padding: 20px; font-family: Arial;">
        <h1 style="color: red;">TEST PDF - DMD ASESORES</h1>
        <h2>Cliente: ${planData.cliente || 'Sin nombre'}</h2>
        <h3>Referencia: ${planData.referencia || 'Sin referencia'}</h3>
        
        <div style="background: yellow; padding: 10px; margin: 20px 0;">
          <p><strong>Deuda Total:</strong> €${planData.deudaTotal || 0}</p>
          <p><strong>Cuota Mensual:</strong> €${planData.cuotaMensual || 0}</p>
          <p><strong>Número de Deudas:</strong> ${(planData.deudas || []).length}</p>
        </div>

        <table border="1" style="width: 100%; border-collapse: collapse;">
          <tr>
            <th style="padding: 10px; background: blue; color: white;">Campo</th>
            <th style="padding: 10px; background: blue; color: white;">Valor</th>
          </tr>
          <tr>
            <td style="padding: 8px;">Cliente</td>
            <td style="padding: 8px;">${planData.cliente || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">DNI</td>
            <td style="padding: 8px;">${planData.dni || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">Email</td>
            <td style="padding: 8px;">${planData.email || 'N/A'}</td>
          </tr>
        </table>

        <p style="margin-top: 20px; font-size: 20px; font-weight: bold; color: green;">
          Si ves esto, el PDF está funcionando! 🎉
        </p>
      </div>
    `;

    console.log('📄 HTML generado:', testHTML);

    // Crear contenedor temporal VISIBLE
    let container = document.getElementById('plan-de-liquidacion-debug');
    if (container) {
      container.remove();
    }
    
    container = document.createElement('div');
    container.id = 'plan-de-liquidacion-debug';
    container.innerHTML = testHTML;
    
    // HACER COMPLETAMENTE VISIBLE
    container.style.position = 'fixed';
    container.style.top = '50px';
    container.style.left = '50px';
    container.style.width = '700px';
    container.style.backgroundColor = 'white';
    container.style.border = '2px solid red';
    container.style.padding = '20px';
    container.style.zIndex = '9999';
    container.style.fontFamily = 'Arial, sans-serif';
    
    document.body.appendChild(container);
    console.log('✅ Contenedor creado y agregado al DOM');
    console.log('📐 Dimensiones del contenedor:', {
      width: container.offsetWidth,
      height: container.offsetHeight,
      visible: container.offsetParent !== null
    });

    // Esperar 1 segundo para que se renderice
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Configuración del PDF MUY SIMPLE
    const filename = generateFilename(planData);
    const options = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.9 },
      html2canvas: {
        scale: 1,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    console.log('⚙️ Opciones PDF:', options);
    console.log('🎯 Iniciando generación PDF...');

    // Generar PDF
    await html2pdf().from(container).set(options).save();

    console.log('✅ PDF generado exitosamente!');

    // Limpiar - remover contenedor después de 3 segundos
    setTimeout(() => {
      if (container && container.parentNode) {
        container.remove();
        console.log('🧹 Contenedor de debug removido');
      }
    }, 3000);

    showNotification(`PDF generado: ${filename}`, 'success');
    
    return { success: true, filename };

  } catch (error) {
    console.error('❌ ERROR en exportPlanToPDF:', error);
    console.error('Stack trace:', error.stack);
    showNotification(`Error: ${error.message}`, 'error');
    throw error;
  }
}
