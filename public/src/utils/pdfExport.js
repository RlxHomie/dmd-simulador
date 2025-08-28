// utils/pdfExport.js — Generación directa con jsPDF (sin html2pdf/html2canvas)
// ✔️ Export nombrado: exportPlanToPDF
// ✔️ Import coherente con tu estructura (utils/ → raíz): ../notifications.js
// ✔️ Sin setGlobalAlpha (usa withAlpha/GState si está disponible)
// ✔️ Salto de página en tabla y redibujo de cabecera
// ✔️ Cálculos seguros (evitan divisiones por 0)
// ✨ VERSIÓN MEJORADA PARA REPORTE EJECUTIVO

import { showNotification } from './notifications.js';

// --- Carga jsPDF si no existe ---
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

// --- Utils básicos ---
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

// --- Constantes de layout / colores MEJORADOS ---
const PAGE = { w: 210, h: 297, lm: 20, rm: 20, tm: 25, bm: 25 }; // mm - márgenes más amplios

const COLORS = {
  // Paleta Ejecutiva Profesional
  primaryDark: '#1a202c',      // Azul marino profundo
  primaryBlue: '#2563eb',      // Azul corporativo
  primaryLight: '#3b82f6',     // Azul claro
  
  // Grises elegantes
  charcoal: '#374151',         // Gris oscuro para texto
  slate: '#64748b',            // Gris medio
  lightGray: '#e2e8f0',        // Gris claro para fondos
  pearl: '#f8fafc',            // Casi blanco
  
  // Acentos profesionales
  success: '#059669',          // Verde éxito
  warning: '#d97706',          // Naranja advertencia
  accent: '#7c3aed',           // Púrpura elegante
  gold: '#b45309',             // Dorado corporativo
  
  // Neutros
  white: '#ffffff',
  black: '#000000',
};

// --- Helpers de dibujo mejorados ---
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

// Opacidad compatible (usa GState si está disponible)
function withAlpha(doc, alpha, draw) {
  const supported = !!(doc.GState && doc.setGState);
  if (supported) {
    const g = new doc.GState({ opacity: alpha });
    doc.setGState(g);
    draw();
    doc.setGState(new doc.GState({ opacity: 1 }));
  } else {
    draw(); // sin alpha si no hay soporte
  }
}

function setFillHex(doc, hex) {
  const { r, g, b } = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}
function setDrawHex(doc, hex) {
  const { r, g, b } = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}
function setTextHex(doc, hex) {
  const { r, g, b } = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

// Sombra sutil profesional
function drawSoftShadow(doc, x, y, w, h, radius = 8) {
  for (let i = 3; i > 0; i--) {
    const alpha = 0.08 / i;
    const offset = i * 0.5;
    withAlpha(doc, alpha, () => {
      setFillHex(doc, COLORS.charcoal);
      doc.roundedRect(x + offset, y + offset, w, h, radius, radius, 'F');
    });
  }
}

// Gradiente vertical simulado
function drawVerticalGradient(doc, x, y, w, h, colorTop, colorBottom, steps = 20) {
  const topRgb = hexToRgb(colorTop);
  const bottomRgb = hexToRgb(colorBottom);
  const stepH = h / steps;
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    const r = Math.round(topRgb.r + (bottomRgb.r - topRgb.r) * ratio);
    const g = Math.round(topRgb.g + (bottomRgb.g - topRgb.g) * ratio);
    const b = Math.round(topRgb.b + (bottomRgb.b - topRgb.b) * ratio);
    
    doc.setFillColor(r, g, b);
    doc.rect(x, y + i * stepH, w, stepH + 0.5, 'F');
  }
}

// Líneas decorativas elegantes
function drawDecorativeLine(doc, x1, y1, x2, y2, color, thickness = 0.5) {
  setDrawHex(doc, color);
  doc.setLineWidth(thickness);
  doc.line(x1, y1, x2, y2);
  
  // Puntos decorativos en los extremos
  setFillHex(doc, color);
  doc.circle(x1, y1, thickness, 'F');
  doc.circle(x2, y2, thickness, 'F');
}

// --- Secciones del PDF MEJORADAS ---
function header(doc, plan, logoDataURL) {
  // Fondo principal con gradiente
  drawVerticalGradient(doc, 0, 0, PAGE.w, 70, COLORS.primaryDark, COLORS.primaryBlue);
  
  // Overlay sutil
  withAlpha(doc, 0.1, () => {
    setFillHex(doc, COLORS.white);
    doc.rect(0, 0, PAGE.w, 70, 'F');
  });

  // Logo/Marca de empresa
  withAlpha(doc, 0.95, () => {
    setFillHex(doc, COLORS.white);
    doc.roundedRect(PAGE.lm, 15, 60, 25, 8, 8, 'F');
  });
  
  drawSoftShadow(doc, PAGE.lm, 15, 60, 25, 8);

  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', PAGE.lm + 15, 20, 30, 15);
  } else {
    doc.setFont('helvetica', 'bold'); 
    doc.setFontSize(16); 
    setTextHex(doc, COLORS.primaryBlue);
    doc.text('DMD', PAGE.lm + 15, 28);
    doc.setFont('helvetica', 'normal'); 
    doc.setFontSize(10); 
    setTextHex(doc, COLORS.slate);
    doc.text('ASESORES', PAGE.lm + 15, 35);
  }

  // Título principal elegante
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(24); 
  doc.setTextColor(255, 255, 255);
  doc.text('PLAN DE REESTRUCTURACIÓN', PAGE.w - PAGE.rm, 30, { align: 'right' });
  
  doc.setFont('helvetica', 'normal'); 
  doc.setFontSize(12); 
  withAlpha(doc, 0.8, () => {
    doc.setTextColor(255, 255, 255);
    doc.text('FINANCIERA', PAGE.w - PAGE.rm, 40, { align: 'right' });
  });

  // Referencia con estilo ejecutivo
  const ref = plan?.referencia || 'REF-000000';
  setFillHex(doc, COLORS.white);
  withAlpha(doc, 0.9, () => {
    doc.roundedRect(PAGE.w - PAGE.rm - 65, 45, 65, 12, 6, 6, 'F');
  });
  
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(8); 
  setTextHex(doc, COLORS.primaryBlue);
  doc.text('REFERENCIA:', PAGE.w - PAGE.rm - 60, 50);
  doc.setFont('helvetica', 'normal');
  setTextHex(doc, COLORS.charcoal);
  doc.text(ref, PAGE.w - PAGE.rm - 60, 54);

  // Línea inferior elegante
  drawDecorativeLine(doc, PAGE.lm, 70, PAGE.w - PAGE.rm, 70, COLORS.primaryLight, 1);
}

function clientAndPlanBlock(doc, plan, y) {
  const leftCol = PAGE.w * 0.58;
  const rightColW = PAGE.w - leftCol - PAGE.rm;

  // Panel cliente con diseño ejecutivo
  setFillHex(doc, COLORS.white);
  doc.roundedRect(PAGE.lm, y, leftCol - PAGE.lm - 8, 45, 12, 12, 'F');
  drawSoftShadow(doc, PAGE.lm, y, leftCol - PAGE.lm - 8, 45, 12);
  
  // Borde sutil
  setDrawHex(doc, COLORS.lightGray);
  doc.setLineWidth(0.5);
  doc.roundedRect(PAGE.lm, y, leftCol - PAGE.lm - 8, 45, 12, 12, 'S');

  // Icono de cliente profesional
  setFillHex(doc, COLORS.primaryBlue);
  doc.roundedRect(PAGE.lm + 10, y + 8, 25, 25, 12.5, 12.5, 'F');
  
  // Iniciales del cliente
  const nombre = plan?.cliente || 'Sin especificar';
  const iniciales = nombre.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(14); 
  doc.setTextColor(255, 255, 255);
  doc.text(iniciales, PAGE.lm + 22.5, y + 23, { align: 'center' });

  // Información del cliente
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(14); 
  setTextHex(doc, COLORS.charcoal);
  doc.text(nombre.toUpperCase(), PAGE.lm + 40, y + 18);
  
  doc.setFont('helvetica', 'normal'); 
  doc.setFontSize(10); 
  setTextHex(doc, COLORS.slate);
  doc.text(`DNI/NIE: ${plan?.dni || 'N/A'}`, PAGE.lm + 40, y + 26);
  
  setTextHex(doc, COLORS.primaryBlue); 
  doc.text((plan?.email || 'No especificado').toLowerCase(), PAGE.lm + 40, y + 34);

  // Panel de estado ejecutivo
  const rightX = leftCol + 5;
  setFillHex(doc, COLORS.primaryDark);
  doc.roundedRect(rightX, y, rightColW, 45, 12, 12, 'F');
  
  // Overlay decorativo
  withAlpha(doc, 0.1, () => {
    setFillHex(doc, COLORS.primaryLight);
    doc.roundedRect(rightX, y, rightColW, 20, 12, 12, 'F');
    doc.rect(rightX, y + 10, rightColW, 10, 'F');
  });

  // Fecha elegante
  const fecha = new Date(plan?.fecha || Date.now());
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = fecha.toLocaleDateString('es-ES', { month: 'long' }).toUpperCase();
  const año = fecha.getFullYear();

  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(22); 
  doc.setTextColor(255, 255, 255);
  doc.text(dia, rightX + 12, y + 20);
  
  doc.setFont('helvetica', 'normal'); 
  doc.setFontSize(9); 
  withAlpha(doc, 0.8, () => {
    doc.setTextColor(255, 255, 255);
    doc.text(`${mes} ${año}`, rightX + 12, y + 28);
  });

  // Estado con diseño profesional
  const estado = String(plan?.estado || 'SIMULADO').replace('_', ' ').toUpperCase();
  const estadoColor = estado === 'ACTIVO' ? COLORS.success : 
                     estado === 'SIMULADO' ? COLORS.warning : COLORS.accent;

  setFillHex(doc, estadoColor);
  doc.roundedRect(rightX + 12, y + 32, 50, 8, 4, 4, 'F');
  
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(7); 
  doc.setTextColor(255, 255, 255);
  doc.text(estado, rightX + 37, y + 37, { align: 'center' });

  return y + 55;
}

function summaryCards(doc, totals, y) {
  const cardSize = (PAGE.w - PAGE.lm - PAGE.rm - 15) / 2;
  const cardHeight = 60;

  function createExecutiveCard(x, y, title, value, subtitle, colorHex, icon = null) {
    // Sombra profesional
    drawSoftShadow(doc, x, y, cardSize, cardHeight, 12);
    
    // Fondo de la tarjeta
    setFillHex(doc, COLORS.white);
    doc.roundedRect(x, y, cardSize, cardHeight, 12, 12, 'F');
    
    // Borde elegante
    setDrawHex(doc, COLORS.lightGray);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardSize, cardHeight, 12, 12, 'S');

    // Barra superior de color
    setFillHex(doc, colorHex);
    doc.roundedRect(x, y, cardSize, 8, 12, 12, 'F');
    doc.rect(x, y + 4, cardSize, 4, 'F');

    // Título
    doc.setFont('helvetica', 'normal'); 
    doc.setFontSize(9); 
    setTextHex(doc, COLORS.slate);
    doc.text(title.toUpperCase(), x + 12, y + 20);

    // Valor principal
    doc.setFont('helvetica', 'bold'); 
    doc.setFontSize(18); 
    setTextHex(doc, COLORS.charcoal);
    doc.text(value, x + 12, y + 35);

    // Subtítulo/indicador
    if (subtitle) {
      withAlpha(doc, 0.1, () => {
        setFillHex(doc, colorHex);
        doc.roundedRect(x + 12, y + 42, 60, 12, 6, 6, 'F');
      });
      
      doc.setFont('helvetica', 'bold'); 
      doc.setFontSize(8); 
      setTextHex(doc, colorHex);
      doc.text(subtitle, x + 42, y + 49, { align: 'center' });
    }

    // Icono decorativo
    withAlpha(doc, 0.1, () => {
      setFillHex(doc, colorHex);
      doc.circle(x + cardSize - 20, y + 30, 12, 'F');
    });
  }

  // Tarjetas principales
  createExecutiveCard(PAGE.lm, y, 'Deuda Original', fmtEUR(totals.totalOriginal), 'IMPORTE INICIAL', COLORS.warning);

  const base = totals.totalOriginal || 1;
  const ahorroPercent = ((totals.ahorro / base) * 100).toFixed(0);
  createExecutiveCard(PAGE.lm + cardSize + 15, y, 'Total Negociado', fmtEUR(totals.totalFinal), `AHORRO ${ahorroPercent}%`, COLORS.primaryBlue);

  y += cardHeight + 15;

  createExecutiveCard(PAGE.lm, y, 'Cuota Mensual', fmtEUR(totals.cuotaMensual), `${totals.numCuotas} CUOTAS`, COLORS.accent);
  createExecutiveCard(PAGE.lm + cardSize + 15, y, 'Beneficio Total', fmtEUR(totals.ahorro), 'AHORRO NETO', COLORS.success);

  // Indicador de progreso elegante
  y += cardHeight + 20;
  
  // Título del indicador
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(12); 
  setTextHex(doc, COLORS.charcoal);
  doc.text('RESUMEN FINANCIERO', PAGE.lm, y - 5);

  const progressWidth = PAGE.w - PAGE.lm - PAGE.rm;
  const progressHeight = 12;
  
  // Fondo del progreso
  setFillHex(doc, COLORS.pearl);
  doc.roundedRect(PAGE.lm, y, progressWidth, progressHeight, 6, 6, 'F');
  
  // Borde
  setDrawHex(doc, COLORS.lightGray);
  doc.setLineWidth(0.5);
  doc.roundedRect(PAGE.lm, y, progressWidth, progressHeight, 6, 6, 'S');

  // Progreso
  const progress = Math.min(1, totals.totalFinal / base);
  const fill = progressWidth * progress;
  
  setFillHex(doc, COLORS.success);
  doc.roundedRect(PAGE.lm, y, fill, progressHeight, 6, 6, 'F');

  // Etiquetas del progreso
  doc.setFont('helvetica', 'bold'); 
  doc.setFontSize(8); 
  setTextHex(doc, COLORS.charcoal);
  doc.text(`REDUCCIÓN: ${ahorroPercent}%`, PAGE.lm, y - 2);
  
  setTextHex(doc, COLORS.success);
  doc.text(`BENEFICIO: ${fmtEUR(totals.ahorro)}`, PAGE.w - PAGE.rm, y - 2, { align: 'right' });

  return y + 25;
}

// --- Tabla de deudas con diseño ejecutivo ---
function tableDeudas(doc, rows, startY) {
  const x = PAGE.lm;
  const w = PAGE.w - PAGE.lm - PAGE.rm;
  const rowH = 12;
  const headH = 40;

  const cols = [
    { key: 'contrato', title: 'CONTRATO', w: w * 0.15 },
    { key: 'producto', title: 'PRODUCTO', w: w * 0.15 },
    { key: 'entidad',  title: 'ENTIDAD',  w: w * 0.24 },
    { key: 'importeOriginal', title: 'ORIGINAL', w: w * 0.16, align: 'right', fmt: v => fmtEUR(v) },
    { key: 'descuento', title: 'DESCUENTO', w: w * 0.12, align: 'center', fmt: v => `${toNumber(v).toFixed(0)}%` },
    { key: 'importeFinal', title: 'NEGOCIADO', w: w * 0.18, align: 'right', fmt: v => fmtEUR(v) },
  ];

  function drawExecutiveHeader(y) {
    // Título de sección
    doc.setFont('helvetica', 'bold'); 
    doc.setFontSize(16); 
    setTextHex(doc, COLORS.charcoal);
    doc.text('DETALLE DE DEUDAS', x, y - 15);
    
    drawDecorativeLine(doc, x, y - 10, x + 80, y - 10, COLORS.primaryBlue, 1);

    // Header de tabla con gradiente
    drawVerticalGradient(doc, x, y, w, headH, COLORS.primaryDark, COLORS.primaryBlue);
    
    // Borde del header
    setDrawHex(doc, COLORS.primaryLight);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, w, headH, 8, 8, 'S');

    // Títulos de columnas
    doc.setFont('helvetica', 'bold'); 
    doc.setFontSize(9); 
    doc.setTextColor(255, 255, 255);
    let cx = x + 10;
    
    cols.forEach((c, i) => {
      if (c.align === 'right') {
        doc.text(c.title, cx + c.w - 10, y + 15, { align: 'right' });
      } else if (c.align === 'center') {
        doc.text(c.title, cx + c.w / 2, y + 15, { align: 'center' });
      } else {
        doc.text(c.title, cx + 5, y + 15);
      }
      cx += c.w;
    });

    // Subtítulos
    doc.setFont('helvetica', 'normal'); 
    doc.setFontSize(7); 
    withAlpha(doc, 0.8, () => {
      doc.setTextColor(255, 255, 255);
      let subtitleCx = x + 10;
      const subtitles = ['Identificador', 'Tipo de deuda', 'Entidad acreedora', 'Importe inicial', 'Reducción aplicada', 'Importe final'];
      
      cols.forEach((c, i) => {
        if (c.align === 'right') {
          doc.text(subtitles[i], subtitleCx + c.w - 10, y + 25, { align: 'right' });
        } else if (c.align === 'center') {
          doc.text(subtitles[i], subtitleCx + c.w / 2, y + 25, { align: 'center' });
        } else {
          doc.text(subtitles[i], subtitleCx + 5, y + 25);
        }
        subtitleCx += c.w;
      });
    });

    // Badge
(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)
