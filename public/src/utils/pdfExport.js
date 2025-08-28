// utils/pdfExport.js — Generación directa con jsPDF (sin html2pdf/html2canvas)
import { showNotification } from './notifications.js'; // ajusta a ../notifications.js si corresponde

// Carga jsPDF si no existe
async function ensureJsPDFLoaded() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
    document.head.appendChild(s);
  });
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF no disponible tras la carga');
  return window.jspdf.jsPDF;
}

let folioCounter = 0;
function generateFilename(planData) {
  const counter = ++folioCounter;
  const clientName = String(planData?.cliente || 'Plan').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${clientName}_${date}_${String(counter).padStart(4, '0')}.pdf`;
}

function toNumber(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  // soporta "31.507,50" o "31,507.50"
  const s = String(v).replace(/[^\d,.-]/g, '');
  const hasComma = s.includes(','), hasDot = s.includes('.');
  if (hasComma && hasDot) {
    const last = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const norm = s
      .replace(/[.,](?=.*[.,])/g, (m, i) => (i === last ? 'DEC' : ''))
      .replace(/[.,]/g, '')
      .replace('DEC', '.');
    return Number(norm);
  }
  if (hasComma && !hasDot) return Number(s.replace(/\./g, '').replace(',', '.'));
  return Number(s.replace(/,/g, ''));
}
const fmtEUR = (n) => Number(n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

async function imgToDataURL(path) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ===== DISEÑO APPLE MINIMALISTA =====
const PAGE = { w: 210, h: 297, lm: 20, rm: 20, tm: 25, bm: 20 }; // A4 mm
const COLORS = {
  // Paleta Apple-inspired
  black: '#1d1d1f',
  darkGray: '#424245',
  gray: '#86868b',
  lightGray: '#f5f5f7',
  ultraLight: '#fbfbfd',
  white: '#ffffff',
  
  // Colores de acento (estilo SF Symbols)
  blue: '#007aff',
  green: '#34c759',
  red: '#ff3b30',
  orange: '#ff9500',
  purple: '#af52de',
  
  // Gradientes sutiles
  gradientStart: '#007aff',
  gradientEnd: '#5856d6',
};

// Función auxiliar para crear gradientes sutiles
function drawGradientRect(doc, x, y, w, h, color1, color2, opacity = 1) {
  // jsPDF no soporta gradientes nativos, simulamos con múltiples rectángulos
  const steps = 20;
  const stepHeight = h / steps;
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    
    doc.setFillColor(r, g, b);
    doc.setGlobalAlpha(opacity);
    doc.rect(x, y + i * stepHeight, w, stepHeight + 0.1, 'F');
  }
  doc.setGlobalAlpha(1);
}

function header(doc, plan, logoDataURL) {
  // Fondo blanco limpio
  doc.setFillColor(COLORS.white);
  doc.rect(0, 0, PAGE.w, 45, 'F');
  
  // Logo o nombre de empresa (más pequeño y elegante)
  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', PAGE.lm, 12, 30, 12);
  } else {
    // Texto minimalista sin logo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(COLORS.black);
    doc.text('DMD', PAGE.lm, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.gray);
    doc.text('ASESORES', PAGE.lm, 26);
  }
  
  // Título principal - Estilo San Francisco
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(24);
  doc.setTextColor(COLORS.black);
  doc.text('Plan de Reestructuración', PAGE.w - PAGE.rm, 20, { align: 'right' });
  
  // Referencia - Más sutil
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(COLORS.gray);
  const ref = plan?.referencia || 'REF-000000';
  doc.text(ref, PAGE.w - PAGE.rm, 28, { align: 'right' });
  
  // Línea divisoria ultra sutil
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.5);
  doc.line(PAGE.lm, 38, PAGE.w - PAGE.rm, 38);
}

function clientAndPlanBlock(doc, plan, y) {
  // Sin cajas, solo espaciado y tipografía
  const colWidth = (PAGE.w - PAGE.lm - PAGE.rm) / 2;
  
  // Cliente
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text('CLIENTE', PAGE.lm, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(COLORS.black);
  const nombre = plan?.cliente || 'Sin especificar';
  doc.text(nombre, PAGE.lm, y + 7);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(COLORS.darkGray);
  const dni = plan?.dni || 'N/A';
  const email = plan?.email || 'No especificado';
  doc.text(`${dni} · ${email}`, PAGE.lm, y + 13);
  
  // Plan (columna derecha)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text('INFORMACIÓN DEL PLAN', PAGE.lm + colWidth, y);
  
  const fecha = new Date(plan?.fecha || Date.now());
  const fechaFormateada = fecha.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  }).replace('.', '');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(COLORS.black);
  doc.text(fechaFormateada, PAGE.lm + colWidth, y + 7);
  
  // Estado con color según el tipo
  const estado = String(plan?.estado || 'SIMULADO').replace('_', ' ').toUpperCase();
  const estadoColor = estado === 'ACTIVO' ? COLORS.green : 
                     estado === 'SIMULADO' ? COLORS.orange : COLORS.gray;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(estadoColor);
  doc.text(`● ${estado}`, PAGE.lm + colWidth, y + 13);
  
  return y + 25;
}

function summaryCards(doc, totals, y) {
  // Cards estilo iOS con sombras muy sutiles
  const cardWidth = (PAGE.w - PAGE.lm - PAGE.rm - 15) / 2;
  const cardHeight = 45;
  const borderRadius = 8;
  
  // Helper para dibujar card con sombra
  function drawCard(x, y, w, h) {
    // Sombra ultra sutil
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(x + 1, y + 1, w, h, borderRadius, borderRadius, 'F');
    
    // Card principal
    doc.setFillColor(COLORS.white);
    doc.setDrawColor(235, 235, 237);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, w, h, borderRadius, borderRadius, 'FD');
  }
  
  // Card 1: Deuda Original
  drawCard(PAGE.lm, y, cardWidth, cardHeight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text('Deuda Original', PAGE.lm + 12, y + 14);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(COLORS.black);
  doc.text(fmtEUR(totals.totalOriginal), PAGE.lm + 12, y + 28);
  
  // Indicador visual
  doc.setFillColor(COLORS.red);
  doc.circle(PAGE.lm + 12, y + 35, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.gray);
  doc.text('Importe inicial', PAGE.lm + 17, y + 36);
  
  // Card 2: Total a Pagar
  drawCard(PAGE.lm + cardWidth + 15, y, cardWidth, cardHeight);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text('Total a Pagar', PAGE.lm + cardWidth + 27, y + 14);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(COLORS.blue);
  doc.text(fmtEUR(totals.totalFinal), PAGE.lm + cardWidth + 27, y + 28);
  
  // Indicador de ahorro
  const ahorroPercent = ((totals.ahorro / totals.totalOriginal) * 100).toFixed(0);
  doc.setFillColor(COLORS.green);
  doc.roundedRect(PAGE.lm + cardWidth + 27, y + 32, 35, 6, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COLORS.white);
  doc.text(`-${ahorroPercent}%`, PAGE.lm + cardWidth + 44.5, y + 36, { align: 'center' });
  
  // Segunda fila de métricas (más compacta)
  y += cardHeight + 12;
  
  // Métricas en línea estilo widget
  const metricsY = y;
  const metricSpacing = (PAGE.w - PAGE.lm - PAGE.rm) / 3;
  
  // Cuota Mensual
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text('Cuota Mensual', PAGE.lm, metricsY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(COLORS.black);
  doc.text(fmtEUR(totals.cuotaMensual), PAGE.lm, metricsY + 8);
  
  // Plazo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text('Plazo', PAGE.lm + metricSpacing, metricsY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(COLORS.black);
  doc.text(`${totals.numCuotas} meses`, PAGE.lm + metricSpacing, metricsY + 8);
  
  // Ahorro Total
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text('Ahorro Total', PAGE.lm + metricSpacing * 2, metricsY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(COLORS.green);
  doc.text(fmtEUR(totals.ahorro), PAGE.lm + metricSpacing * 2, metricsY + 8);
  
  return metricsY + 20;
}

function tableDeudas(doc, rows, startY) {
  const x = PAGE.lm;
  const w = PAGE.w - PAGE.lm - PAGE.rm;
  const rowH = 9;
  const headH = 12;
  
  const cols = [
    { key: 'contrato', title: 'Contrato', w: w * 0.16 },
    { key: 'producto', title: 'Producto', w: w * 0.16 },
    { key: 'entidad',  title: 'Entidad',  w: w * 0.22 },
    { key: 'importeOriginal', title: 'Original', w: w * 0.16, align: 'right', fmt: v => fmtEUR(v) },
    { key: 'descuento', title: 'Desc.', w: w * 0.12, align: 'center', fmt: v => `${toNumber(v).toFixed(0)}%` },
    { key: 'importeFinal', title: 'Final', w: w * 0.18, align: 'right', fmt: v => fmtEUR(v) },
  ];
  
  function drawHeader(y) {
    // Sin fondo, solo línea inferior
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.gray);
    let cx = x;
    cols.forEach(c => {
      if (c.align === 'right') {
        doc.text(c.title.toUpperCase(), cx + c.w - 2, y + 8, { align: 'right' });
      } else if (c.align === 'center') {
        doc.text(c.title.toUpperCase(), cx + c.w / 2, y + 8, { align: 'center' });
      } else {
        doc.text(c.title.toUpperCase(), cx, y + 8);
      }
      cx += c.w;
    });
    
    // Línea divisoria
    doc.setDrawColor(235, 235, 237);
    doc.setLineWidth(0.5);
    doc.line(x, y + headH, x + w, y + headH);
  }
  
  function maybePageBreak(y) {
    if (y + rowH + PAGE.bm > PAGE.h) {
      doc.addPage();
      drawHeader(PAGE.tm);
      return PAGE.tm + headH;
    }
    return y;
  }
  
  // Título de sección
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.black);
  doc.text('Detalle de Deudas', x, startY);
  
  let y = startY + 8;
  drawHeader(y);
  y += headH + 2;
  
  // Filas con diseño minimalista
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  rows.forEach((r, i) => {
    y = maybePageBreak(y);
    
    // Alternancia muy sutil
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(x, y - 2, w, rowH, 'F');
    }
    
    let cx = x;
    cols.forEach(c => {
      const raw = r[c.key];
      const text = c.fmt ? c.fmt(raw) : String(raw ?? '—');
      const ty = y + 4;
      
      // Color según el tipo de dato
      if (c.key === 'importeFinal') {
        doc.setTextColor(COLORS.blue);
      } else if (c.key === 'descuento') {
        const desc = toNumber(raw);
        doc.setTextColor(desc >= 50 ? COLORS.green : desc >= 30 ? COLORS.orange : COLORS.gray);
      } else {
        doc.setTextColor(COLORS.darkGray);
      }
      
      if (c.align === 'right') {
        doc.text(text, cx + c.w - 2, ty, { align: 'right' });
      } else if (c.align === 'center') {
        doc.text(text, cx + c.w / 2, ty, { align: 'center' });
      } else {
        doc.text(text, cx, ty);
      }
      cx += c.w;
    });
    y += rowH;
  });
  
  // Totales con diseño destacado
  const totalOriginal = rows.reduce((s, r) => s + toNumber(r.importeOriginal), 0);
  const totalFinal = rows.reduce((s, r) => s + toNumber(r.importeFinal), 0);
  const ds = rows.map(r => toNumber(r.descuento)).filter(n => !Number.isNaN(n));
  const descuentoMedio = ds.length ? (ds.reduce((a,b)=>a+b,0) / ds.length) : 0;
  
  y = maybePageBreak(y + 6);
  
  // Línea superior de totales
  doc.setDrawColor(COLORS.black);
  doc.setLineWidth(1);
  doc.line(x, y, x + w, y);
  
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(COLORS.black);
  
  // Layout de totales más espaciado
  let cx = x + cols[0].w + cols[1].w + cols[2].w;
  
  // Label
  doc.text('TOTAL', x, y);
  
  // Original
  doc.setTextColor(COLORS.darkGray);
  doc.text(fmtEUR(totalOriginal), cx + cols[3].w - 2, y, { align: 'right' });
  
  // Descuento medio
  doc.setTextColor(COLORS.blue);
  doc.text(`${descuentoMedio.toFixed(0)}%`, cx + cols[3].w + cols[4].w / 2, y, { align: 'center' });
  
  // Final
  doc.setTextColor(COLORS.blue);
  doc.setFontSize(12);
  doc.text(fmtEUR(totalFinal), cx + cols[3].w + cols[4].w + cols[5].w - 2, y, { align: 'right' });
  
  return y + 12;
}

function termsAndFooter(doc, y) {
  // Asegurar que hay espacio suficiente
  if (y + 50 > PAGE.h - PAGE.bm) {
    doc.addPage();
    y = PAGE.tm;
  }
  
  // Términos con diseño minimalista
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.gray);
  doc.text('INFORMACIÓN IMPORTANTE', PAGE.lm, y);
  
  y += 6;
  const terms = [
    'Plan sujeto a aprobación de las entidades acreedoras',
    'Las condiciones pueden variar según la respuesta de cada acreedor',
    'Compromiso de mantener los pagos acordados al día',
    'Seguimiento y gestión integral por DMD Asesores'
  ];
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.darkGray);
  
  terms.forEach((term, i) => {
    doc.text(`• ${term}`, PAGE.lm + 2, y + (i * 5));
  });
  
  // Footer minimalista
  y = PAGE.h - 25;
  
  // Línea divisoria sutil
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.5);
  doc.line(PAGE.lm, y, PAGE.w - PAGE.rm, y);
  
  y += 6;
  const genDate = new Date();
  
  // Info del documento
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.gray);
  
  // Izquierda: Confidencialidad
  doc.text('Documento confidencial', PAGE.lm, y);
  
  // Centro: Fecha de generación
  const fechaGen = genDate.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  doc.text(fechaGen, PAGE.w / 2, y, { align: 'center' });
  
  // Derecha: Copyright
  doc.text(`© ${genDate.getFullYear()} DMD Asesores`, PAGE.w - PAGE.rm, y, { align: 'right' });
}

// ====== API compatible con tu simulador ======
export async function exportPlanToPDF(planData) {
  showNotification('Generando PDF...', 'info');

  const jsPDF = await ensureJsPDFLoaded();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  // Logo (si tienes /logo.png servible; si no, se imprime el texto)
  const logoDataURL = await imgToDataURL('logo.png');

  // Calcular totales a partir de planData.deudas
  const deudas = Array.isArray(planData?.deudas) ? planData.deudas.map(d => ({
    contrato: d?.contrato || '—',
    producto: d?.producto || '—',
    entidad:  d?.entidad  || '—',
    importeOriginal: toNumber(d?.importeOriginal ?? 0),
    descuento: toNumber(d?.descuento ?? 0),
    importeFinal: toNumber(d?.importeFinal ?? 0),
  })) : [];

  const totalOriginal = deudas.reduce((s, r) => s + toNumber(r.importeOriginal), 0);
  const totalFinal = deudas.reduce((s, r) => s + toNumber(r.importeFinal), 0);
  const ds = deudas.map(r => toNumber(r.descuento)).filter(n => !Number.isNaN(n));
  const descuentoMedio = ds.length ? (ds.reduce((a,b)=>a+b,0) / ds.length) : 0;
  const cuotaMensual = toNumber(planData?.cuotaMensual ?? 0);
  const numCuotas = Number(planData?.numCuotas ?? 0);
  const ahorro = Math.max(0, totalOriginal - totalFinal);

  // Dibujo con diseño Apple
  header(doc, planData, logoDataURL);
  let y = clientAndPlanBlock(doc, planData, 50);
  y = summaryCards(doc, { totalOriginal, totalFinal, cuotaMensual, ahorro, descuentoMedio, numCuotas }, y + 8);
  y = tableDeudas(doc, deudas, y + 15);
  termsAndFooter(doc, y + 10);

  const filename = generateFilename(planData);
  doc.save(filename);

  showNotification(`✅ PDF generado: ${filename}`, 'success');
  return { success: true, filename };
}
