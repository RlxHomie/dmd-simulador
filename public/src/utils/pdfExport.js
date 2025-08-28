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

// ===== DISEÑO FUTURISTA PREMIUM =====
const PAGE = { w: 210, h: 297, lm: 15, rm: 15, tm: 20, bm: 20 };

const COLORS = {
  // Paleta Oscura Premium
  deepBlack: '#0a0a0a',
  richBlack: '#121214',
  charcoal: '#1e1e20',
  slate: '#2a2a2e',
  
  // Grises refinados
  steel: '#71717a',
  silver: '#a1a1aa',
  pearl: '#e4e4e7',
  smoke: '#f4f4f5',
  cloud: '#fafafa',
  
  // Colores vibrantes neón
  neonBlue: '#3b82f6',
  electricBlue: '#0ea5e9',
  neonPurple: '#8b5cf6',
  hotPink: '#ec4899',
  neonGreen: '#10b981',
  gold: '#eab308',
  coral: '#f97316',
  
  // Gradientes
  gradientStart: '#3b82f6',
  gradientMid: '#8b5cf6',
  gradientEnd: '#ec4899',
};

// Helpers para efectos visuales
function drawGlowEffect(doc, x, y, w, h, color, intensity = 3) {
  const steps = 5;
  for (let i = steps; i > 0; i--) {
    const alpha = (0.15 / steps) * (steps - i + 1);
    doc.setGlobalAlpha(alpha);
    doc.setFillColor(color);
    const offset = (i * intensity);
    doc.roundedRect(x - offset/2, y - offset/2, w + offset, h + offset, 12, 12, 'F');
  }
  doc.setGlobalAlpha(1);
}

function drawDiagonalPattern(doc, x, y, w, h, color, opacity = 0.03) {
  doc.setGlobalAlpha(opacity);
  doc.setDrawColor(color);
  doc.setLineWidth(0.1);
  const step = 4;
  for (let i = -h; i < w + h; i += step) {
    doc.line(x + i, y, x + i - h, y + h);
  }
  doc.setGlobalAlpha(1);
}

function drawCircuitPattern(doc, startX, startY, width, height, color, opacity = 0.1) {
  doc.setGlobalAlpha(opacity);
  doc.setDrawColor(color);
  doc.setLineWidth(0.3);
  
  // Líneas horizontales aleatorias
  for (let i = 0; i < 8; i++) {
    const y = startY + Math.random() * height;
    const x1 = startX + Math.random() * width * 0.3;
    const x2 = startX + width * 0.7 + Math.random() * width * 0.3;
    doc.line(x1, y, x2, y);
    
    // Nodos
    if (Math.random() > 0.5) {
      doc.circle(x1, y, 0.8, 'F');
      doc.circle(x2, y, 0.8, 'F');
    }
  }
  
  // Líneas verticales
  for (let i = 0; i < 6; i++) {
    const x = startX + Math.random() * width;
    const y1 = startY + Math.random() * height * 0.3;
    const y2 = startY + height * 0.7 + Math.random() * height * 0.3;
    doc.line(x, y1, x, y2);
  }
  
  doc.setGlobalAlpha(1);
}

function header(doc, plan, logoDataURL) {
  // Fondo oscuro dramático con gradiente
  doc.setFillColor(COLORS.deepBlack);
  doc.rect(0, 0, PAGE.w, 60, 'F');
  
  // Patrón decorativo futurista
  drawCircuitPattern(doc, 0, 0, PAGE.w, 60, COLORS.neonBlue, 0.15);
  
  // Gradiente superior (simulado con rectángulos)
  for (let i = 0; i < 20; i++) {
    const opacity = 0.3 * (1 - i/20);
    doc.setGlobalAlpha(opacity);
    doc.setFillColor(COLORS.neonPurple);
    doc.rect(0, i * 3, PAGE.w, 3, 'F');
  }
  doc.setGlobalAlpha(1);
  
  // Badge de empresa (glassmorphism effect)
  doc.setFillColor(255, 255, 255);
  doc.setGlobalAlpha(0.1);
  doc.roundedRect(PAGE.lm, 12, 50, 20, 6, 6, 'F');
  doc.setGlobalAlpha(1);
  
  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', PAGE.lm + 10, 16, 30, 12);
  } else {
    // Logo texto moderno
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('DMD', PAGE.lm + 8, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.silver);
    doc.text('ASESORES', PAGE.lm + 8, 28);
  }
  
  // Título principal con efecto
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  
  // Sombra del texto
  doc.setTextColor(COLORS.neonPurple);
  doc.setGlobalAlpha(0.5);
  doc.text('PLAN DE', PAGE.w - PAGE.rm - 1, 24, { align: 'right' });
  doc.text('REESTRUCTURACIÓN', PAGE.w - PAGE.rm - 1, 34, { align: 'right' });
  
  // Texto principal
  doc.setGlobalAlpha(1);
  doc.setTextColor(255, 255, 255);
  doc.text('PLAN DE', PAGE.w - PAGE.rm, 23, { align: 'right' });
  doc.text('REESTRUCTURACIÓN', PAGE.w - PAGE.rm, 33, { align: 'right' });
  
  // Referencia en badge flotante
  const ref = plan?.referencia || 'REF-000000';
  doc.setFillColor(COLORS.neonBlue);
  doc.setGlobalAlpha(0.15);
  doc.roundedRect(PAGE.w - PAGE.rm - 55, 38, 55, 8, 4, 4, 'F');
  doc.setGlobalAlpha(1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLORS.neonBlue);
  doc.text(ref, PAGE.w - PAGE.rm - 27.5, 43, { align: 'center' });
  
  // Línea de neón inferior
  doc.setDrawColor(COLORS.electricBlue);
  doc.setLineWidth(0.5);
  doc.line(0, 60, PAGE.w, 60);
  doc.setGlobalAlpha(0.3);
  doc.setLineWidth(2);
  doc.line(PAGE.w * 0.2, 60, PAGE.w * 0.8, 60);
  doc.setGlobalAlpha(1);
}

function clientAndPlanBlock(doc, plan, y) {
  // Diseño asimétrico moderno
  const leftCol = PAGE.w * 0.55;
  const rightCol = PAGE.w * 0.45;
  
  // Panel izquierdo - Cliente (con efecto glassmorphism)
  doc.setFillColor(COLORS.cloud);
  doc.setGlobalAlpha(0.95);
  doc.roundedRect(PAGE.lm, y, leftCol - PAGE.lm - 5, 35, 12, 12, 'F');
  
  // Decoración gradiente
  doc.setGlobalAlpha(0.08);
  doc.setFillColor(COLORS.neonBlue);
  doc.roundedRect(PAGE.lm, y, leftCol - PAGE.lm - 5, 35, 12, 12, 'F');
  doc.setGlobalAlpha(1);
  
  // Icono de usuario
  doc.setFillColor(COLORS.neonBlue);
  doc.circle(PAGE.lm + 12, y + 17.5, 8, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(PAGE.lm + 12, y + 14, 3, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  doc.arc(PAGE.lm + 12, y + 24, 5, 0, Math.PI, false, 'S');
  
  // Info del cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COLORS.charcoal);
  const nombre = plan?.cliente || 'Sin especificar';
  doc.text(nombre.toUpperCase(), PAGE.lm + 25, y + 14);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(COLORS.steel);
  const dni = plan?.dni || 'N/A';
  doc.text(`DNI/NIE: ${dni}`, PAGE.lm + 25, y + 21);
  
  const email = plan?.email || 'No especificado';
  doc.setTextColor(COLORS.neonBlue);
  doc.text(email.toLowerCase(), PAGE.lm + 25, y + 28);
  
  // Panel derecho - Estado del Plan (diseño vertical)
  const rightX = leftCol + 5;
  
  // Card de estado
  doc.setFillColor(COLORS.charcoal);
  doc.roundedRect(rightX, y, PAGE.w - rightX - PAGE.rm, 35, 12, 12, 'F');
  
  // Patrón decorativo
  drawDiagonalPattern(doc, rightX, y, PAGE.w - rightX - PAGE.rm, 35, COLORS.neonPurple, 0.1);
  
  // Fecha
  const fecha = new Date(plan?.fecha || Date.now());
  const dia = fecha.getDate();
  const mes = fecha.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
  const año = fecha.getFullYear();
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(String(dia).padStart(2, '0'), rightX + 10, y + 15);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLORS.silver);
  doc.text(`${mes} ${año}`, rightX + 10, y + 21);
  
  // Estado con indicador luminoso
  const estado = String(plan?.estado || 'SIMULADO').replace('_', ' ').toUpperCase();
  const estadoColor = estado === 'ACTIVO' ? COLORS.neonGreen : 
                     estado === 'SIMULADO' ? COLORS.gold : COLORS.coral;
  
  // Glow effect para el estado
  drawGlowEffect(doc, rightX + 10, y + 24, 45, 7, estadoColor, 2);
  
  doc.setFillColor(estadoColor);
  doc.roundedRect(rightX + 10, y + 24, 45, 7, 3.5, 3.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255);
  doc.text(estado, rightX + 32.5, y + 28.5, { align: 'center' });
  
  return y + 45;
}

function summaryCards(doc, totals, y) {
  // Grid futurista 2x2
  const cardSize = (PAGE.w - PAGE.lm - PAGE.rm - 10) / 2;
  const cardHeight = 55;
  
  // Helper para crear cards con efectos
  function createMetricCard(x, y, title, value, subtitle, color, icon) {
    // Sombra y glow
    drawGlowEffect(doc, x, y, cardSize, cardHeight, color, 2);
    
    // Card principal
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardSize, cardHeight, 10, 10, 'F');
    
    // Borde gradiente
    doc.setDrawColor(color);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardSize, cardHeight, 10, 10, 'S');
    
    // Header con gradiente
    doc.setFillColor(color);
    doc.setGlobalAlpha(0.1);
    doc.roundedRect(x, y, cardSize, 20, 10, 10, 'F');
    doc.rect(x, y + 10, cardSize, 10, 'F');
    doc.setGlobalAlpha(1);
    
    // Icono decorativo
    doc.setFillColor(color);
    doc.setGlobalAlpha(0.15);
    doc.circle(x + cardSize - 15, y + 35, 15, 'F');
    doc.setGlobalAlpha(0.1);
    doc.circle(x + cardSize - 15, y + 35, 20, 'F');
    doc.setGlobalAlpha(1);
    
    // Título
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.steel);
    doc.text(title.toUpperCase(), x + 10, y + 12);
    
    // Valor principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(COLORS.charcoal);
    doc.text(value, x + 10, y + 28);
    
    // Subtítulo o indicador
    if (subtitle) {
      doc.setFillColor(color);
      doc.setGlobalAlpha(0.1);
      doc.roundedRect(x + 10, y + 35, 50, 12, 6, 6, 'F');
      doc.setGlobalAlpha(1);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(color);
      doc.text(subtitle, x + 35, y + 42.5, { align: 'center' });
    }
  }
  
  // Card 1: Deuda Original
  createMetricCard(
    PAGE.lm, y,
    'Deuda Original',
    fmtEUR(totals.totalOriginal),
    'INICIAL',
    COLORS.coral
  );
  
  // Card 2: Total a Pagar
  const ahorroPercent = ((totals.ahorro / totals.totalOriginal) * 100).toFixed(0);
  createMetricCard(
    PAGE.lm + cardSize + 10, y,
    'Total a Pagar',
    fmtEUR(totals.totalFinal),
    `-${ahorroPercent}%`,
    COLORS.neonBlue
  );
  
  // Cards segunda fila
  y += cardHeight + 10;
  
  // Card 3: Cuota Mensual
  createMetricCard(
    PAGE.lm, y,
    'Cuota Mensual',
    fmtEUR(totals.cuotaMensual),
    `${totals.numCuotas} MESES`,
    COLORS.neonPurple
  );
  
  // Card 4: Ahorro Total
  createMetricCard(
    PAGE.lm + cardSize + 10, y,
    'Ahorro Total',
    fmtEUR(totals.ahorro),
    'BENEFICIO',
    COLORS.neonGreen
  );
  
  // Indicador visual de progreso
  y += cardHeight + 15;
  
  // Barra de progreso estilizada
  const progressWidth = PAGE.w - PAGE.lm - PAGE.rm;
  const progressHeight = 8;
  
  // Fondo
  doc.setFillColor(COLORS.smoke);
  doc.roundedRect(PAGE.lm, y, progressWidth, progressHeight, 4, 4, 'F');
  
  // Progreso con gradiente
  const progress = (totals.totalFinal / totals.totalOriginal);
  const progressFill = progressWidth * progress;
  
  // Efecto glow
  doc.setGlobalAlpha(0.3);
  doc.setFillColor(COLORS.neonGreen);
  doc.roundedRect(PAGE.lm - 1, y - 1, progressFill + 2, progressHeight + 2, 4, 4, 'F');
  doc.setGlobalAlpha(1);
  
  doc.setFillColor(COLORS.neonGreen);
  doc.roundedRect(PAGE.lm, y, progressFill, progressHeight, 4, 4, 'F');
  
  // Texto del progreso
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COLORS.charcoal);
  doc.text(`${(progress * 100).toFixed(0)}% DEL TOTAL ORIGINAL`, PAGE.lm, y - 2);
  
  doc.setTextColor(COLORS.neonGreen);
  doc.text(`${ahorroPercent}% AHORRO`, PAGE.w - PAGE.rm, y - 2, { align: 'right' });
  
  return y + 20;
}

function tableDeudas(doc, rows, startY) {
  const x = PAGE.lm;
  const w = PAGE.w - PAGE.lm - PAGE.rm;
  const rowH = 11;
  const headH = 35;
  
  const cols = [
    { key: 'contrato', title: 'CONTRATO', w: w * 0.15 },
    { key: 'producto', title: 'PRODUCTO', w: w * 0.15 },
    { key: 'entidad',  title: 'ENTIDAD',  w: w * 0.24 },
    { key: 'importeOriginal', title: 'ORIGINAL', w: w * 0.16, align: 'right', fmt: v => fmtEUR(v) },
    { key: 'descuento', title: 'DESC', w: w * 0.12, align: 'center', fmt: v => `${toNumber(v).toFixed(0)}%` },
    { key: 'importeFinal', title: 'FINAL', w: w * 0.18, align: 'right', fmt: v => fmtEUR(v) },
  ];
  
  // Título de sección con estilo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(COLORS.charcoal);
  doc.text('DETALLE', x, startY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(COLORS.steel);
  doc.text(' DE DEUDAS', x + 35, startY);
  
  // Línea decorativa
  doc.setDrawColor(COLORS.neonBlue);
  doc.setLineWidth(2);
  doc.line(x, startY + 3, x + 30, startY + 3);
  
  let y = startY + 15;
  
  // Header de tabla futurista
  doc.setFillColor(COLORS.charcoal);
  doc.roundedRect(x, y, w, headH, 8, 8, 'F');
  
  // Patrón en el header
  drawCircuitPattern(doc, x, y, w, headH, COLORS.neonBlue, 0.2);
  
  // Títulos de columnas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  
  let cx = x + 8;
  cols.forEach((c, i) => {
    // Mini indicador de columna
    if (i < 3) {
      doc.setFillColor(COLORS.silver);
    } else if (c.key === 'descuento') {
      doc.setFillColor(COLORS.gold);
    } else {
      doc.setFillColor(COLORS.neonBlue);
    }
    doc.circle(cx - 3, y + 8, 1, 'F');
    
    doc.setTextColor(255, 255, 255);
    if (c.align === 'right') {
      doc.text(c.title, cx + c.w - 8, y + 9, { align: 'right' });
    } else if (c.align === 'center') {
      doc.text(c.title, cx + c.w / 2, y + 9, { align: 'center' });
    } else {
      doc.text(c.title, cx + 2, y + 9);
    }
    cx += c.w;
  });
  
  // Subtítulos informativos
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(COLORS.silver);
  let subtitleCx = x + 8;
  const subtitles = ['Identificador', 'Tipo', 'Acreedor', 'Importe inicial', 'Reducción', 'Importe negociado'];
  cols.forEach((c, i) => {
    if (c.align === 'right') {
      doc.text(subtitles[i], subtitleCx + c.w - 8, y + 15, { align: 'right' });
    } else if (c.align === 'center') {
      doc.text(subtitles[i], subtitleCx + c.w / 2, y + 15, { align: 'center' });
    } else {
      doc.text(subtitles[i], subtitleCx + 2, y + 15);
    }
    subtitleCx += c.w;
  });
  
  // Indicadores visuales de métricas
  doc.setFillColor(COLORS.neonGreen);
  doc.setGlobalAlpha(0.15);
  doc.roundedRect(x + 5, y + 20, 40, 10, 5, 5, 'F');
  doc.setGlobalAlpha(1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(COLORS.neonGreen);
  doc.text(`${rows.length} DEUDAS`, x + 25, y + 26, { align: 'center' });
  
  y += headH + 5;
  
  // Filas de datos con diseño alternado
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  rows.forEach((r, i) => {
    // Fondo alternado sutil
    if (i % 2 === 0) {
      doc.setFillColor(COLORS.cloud);
      doc.roundedRect(x, y - 3, w, rowH, 4, 4, 'F');
    }
    
    // Indicador de fila
    const desc = toNumber(r.descuento);
    const indicatorColor = desc >= 50 ? COLORS.neonGreen : 
                          desc >= 30 ? COLORS.gold : 
                          COLORS.coral;
    
    doc.setFillColor(indicatorColor);
    doc.setGlobalAlpha(0.5);
    doc.rect(x, y - 3, 2, rowH, 'F');
    doc.setGlobalAlpha(1);
    
    let rowCx = x + 8;
    cols.forEach(c => {
      const raw = r[c.key];
      const text = c.fmt ? c.fmt(raw) : String(raw ?? '—');
      const ty = y + 3;
      
      // Colores según tipo de dato
      if (c.key === 'importeFinal') {
        doc.setTextColor(COLORS.neonBlue);
        doc.setFont('helvetica', 'bold');
      } else if (c.key === 'descuento') {
        doc.setTextColor(indicatorColor);
        doc.setFont('helvetica', 'bold');
      } else if (c.key === 'importeOriginal') {
        doc.setTextColor(COLORS.coral);
        doc.setFont('helvetica', 'normal');
      } else {
        doc.setTextColor(COLORS.charcoal);
        doc.setFont('helvetica', 'normal');
      }
      
      if (c.align === 'right') {
        doc.text(text, rowCx + c.w - 8, ty, { align: 'right' });
      } else if (c.align === 'center') {
        doc.text(text, rowCx + c.w / 2, ty, { align: 'center' });
      } else {
        doc.text(text, rowCx + 2, ty);
      }
      rowCx += c.w;
    });
    
    y += rowH;
  });
  
  // Totales con diseño impactante
  const totalOriginal = rows.reduce((s, r) => s + toNumber(r.importeOriginal), 0);
  const totalFinal = rows.reduce((s, r) => s + toNumber(r.importeFinal), 0);
  const ds = rows.map(r => toNumber(r.descuento)).filter(n => !Number.isNaN(n));
  const descuentoMedio = ds.length ? (ds.reduce((a,b)=>a+b,0) / ds.length) : 0;
  
  y += 8;
  
  // Card de totales
  doc.setFillColor(COLORS.deepBlack);
  doc.roundedRect(x, y, w, 25, 8, 8, 'F');
  
  // Efecto de brillo
  doc.setGlobalAlpha(0.1);
  doc.setFillColor(COLORS.neonPurple);
  doc.roundedRect(x, y, w, 12, 8, 8, 'F');
  doc.rect(x, y + 6, w, 6, 'F');
  doc.setGlobalAlpha(1);
  
  // Labels
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLORS.silver);
  doc.text('TOTALES', x + 10, y + 7);
  
  // Valores totales con diseño espectacular
  const totalCx = x + cols[0].w + cols[1].w + cols[2].w;
  
  // Total Original
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(COLORS.coral);
  doc.text(fmtEUR(totalOriginal), totalCx + cols[3].w - 8, y + 15, { align: 'right' });
  
  // Descuento Medio con badge
  doc.setFillColor(COLORS.gold);
  doc.roundedRect(totalCx + cols[3].w + 15, y + 10, 30, 10, 5, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`-${descuentoMedio.toFixed(0)}%`, totalCx + cols[3].w + cols[4].w / 2, y + 16.5, { align: 'center' });
  
  // Total Final con efecto
  drawGlowEffect(doc, totalCx + cols[3].w + cols[4].w + 10, y + 9, cols[5].w - 18, 12, COLORS.neonBlue, 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(COLORS.neonBlue);
  doc.text(fmtEUR(totalFinal), totalCx + cols[3].w + cols[4].w + cols[5].w - 8, y + 16, { align: 'right' });
  
  return y + 35;
}
