// utils/pdfExport.js — Generación directa con jsPDF (sin html2pdf/html2canvas)
// ✔️ Export nombrado: exportPlanToPDF
// ✔️ Import coherente con tu estructura (utils/ → raíz): ../notifications.js
// ✔️ Sin setGlobalAlpha (usa withAlpha/GState si está disponible)
// ✔️ Salto de página en tabla y redibujo de cabecera
// ✔️ Cálculos seguros (evitan divisiones por 0)

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

// --- Constantes de layout / colores ---
const PAGE = { w: 210, h: 297, lm: 15, rm: 15, tm: 20, bm: 20 }; // mm

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

  // Vibrantes
  neonBlue: '#3b82f6',
  electricBlue: '#0ea5e9',
  neonPurple: '#8b5cf6',
  hotPink: '#ec4899',
  neonGreen: '#10b981',
  gold: '#eab308',
  coral: '#f97316',
};

// --- Helpers de dibujo seguros ---
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

// Glow rectangular
function drawGlowEffect(doc, x, y, w, h, hexColor, intensity = 3) {
  for (let i = 5; i > 0; i--) {
    const alpha = (0.15 / 5) * (5 - i + 1);
    const offset = i * intensity;
    withAlpha(doc, alpha, () => {
      setFillHex(doc, hexColor);
      doc.roundedRect(x - offset / 2, y - offset / 2, w + offset, h + offset, 12, 12, 'F');
    });
  }
}

// Patrón diagonal sutil
function drawDiagonalPattern(doc, x, y, w, h, hexColor, opacity = 0.03) {
  withAlpha(doc, opacity, () => {
    setDrawHex(doc, hexColor);
    doc.setLineWidth(0.1);
    const step = 4;
    for (let i = -h; i < w + h; i += step) {
      doc.line(x + i, y, x + i - h, y + h);
    }
  });
}

// Patrón “circuito” decorativo
function drawCircuitPattern(doc, startX, startY, width, height, hexColor, opacity = 0.1) {
  withAlpha(doc, opacity, () => {
    setDrawHex(doc, hexColor);
    doc.setLineWidth(0.3);

    for (let i = 0; i < 8; i++) {
      const yy = startY + Math.random() * height;
      const x1 = startX + Math.random() * width * 0.3;
      const x2 = startX + width * 0.7 + Math.random() * width * 0.3;
      doc.line(x1, yy, x2, yy);
      if (Math.random() > 0.5) {
        doc.circle(x1, yy, 0.8, 'F');
        doc.circle(x2, yy, 0.8, 'F');
      }
    }
    for (let i = 0; i < 6; i++) {
      const xx = startX + Math.random() * width;
      const y1 = startY + Math.random() * height * 0.3;
      const y2 = startY + height * 0.7 + Math.random() * height * 0.3;
      doc.line(xx, y1, xx, y2);
    }
  });
}

// --- Secciones del PDF ---
function header(doc, plan, logoDataURL) {
  // Fondo superior
  setFillHex(doc, COLORS.deepBlack);
  doc.rect(0, 0, PAGE.w, 60, 'F');

  // Patrón decorativo + pseudo gradiente
  drawCircuitPattern(doc, 0, 0, PAGE.w, 60, COLORS.neonBlue, 0.15);
  for (let i = 0; i < 20; i++) {
    const opacity = 0.3 * (1 - i / 20);
    withAlpha(doc, opacity, () => {
      setFillHex(doc, COLORS.neonPurple);
      doc.rect(0, i * 3, PAGE.w, 3, 'F');
    });
  }

  // Badge de empresa
  withAlpha(doc, 0.1, () => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(PAGE.lm, 12, 50, 20, 6, 6, 'F');
  });

  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', PAGE.lm + 10, 16, 30, 12);
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
    doc.text('DMD', PAGE.lm + 8, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.silver);
    doc.text('ASESORES', PAGE.lm + 8, 28);
  }

  // Título (con sombra)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  setTextHex(doc, COLORS.neonPurple);
  withAlpha(doc, 0.5, () => {
    doc.text('PLAN DE', PAGE.w - PAGE.rm - 1, 24, { align: 'right' });
    doc.text('REESTRUCTURACIÓN', PAGE.w - PAGE.rm - 1, 34, { align: 'right' });
  });
  doc.setTextColor(255, 255, 255);
  doc.text('PLAN DE', PAGE.w - PAGE.rm, 23, { align: 'right' });
  doc.text('REESTRUCTURACIÓN', PAGE.w - PAGE.rm, 33, { align: 'right' });

  // Referencia
  const ref = plan?.referencia || 'REF-000000';
  withAlpha(doc, 0.15, () => {
    setFillHex(doc, COLORS.neonBlue);
    doc.roundedRect(PAGE.w - PAGE.rm - 55, 38, 55, 8, 4, 4, 'F');
  });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setTextHex(doc, COLORS.neonBlue);
  doc.text(ref, PAGE.w - PAGE.rm - 27.5, 43, { align: 'center' });

  // Línea inferior
  setDrawHex(doc, COLORS.electricBlue);
  doc.setLineWidth(0.5); doc.line(0, 60, PAGE.w, 60);
  withAlpha(doc, 0.3, () => {
    doc.setLineWidth(2);
    doc.line(PAGE.w * 0.2, 60, PAGE.w * 0.8, 60);
  });
}

function clientAndPlanBlock(doc, plan, y) {
  const leftCol = PAGE.w * 0.55;
  const rightColW = PAGE.w - leftCol - PAGE.rm;

  // Panel cliente (glass)
  setFillHex(doc, COLORS.cloud);
  withAlpha(doc, 0.95, () => {
    doc.roundedRect(PAGE.lm, y, leftCol - PAGE.lm - 5, 35, 12, 12, 'F');
  });
  withAlpha(doc, 0.08, () => {
    setFillHex(doc, COLORS.neonBlue);
    doc.roundedRect(PAGE.lm, y, leftCol - PAGE.lm - 5, 35, 12, 12, 'F');
  });

  // Avatar
  setFillHex(doc, COLORS.neonBlue);
  doc.circle(PAGE.lm + 12, y + 17.5, 8, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(PAGE.lm + 12, y + 14, 3, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  // Simulación de “sonrisa”
  doc.roundedRect(PAGE.lm + 7, y + 23, 10, 2, 1, 1, 'S');

  // Info cliente
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setTextHex(doc, COLORS.charcoal);
  const nombre = plan?.cliente || 'Sin especificar';
  doc.text(nombre.toUpperCase(), PAGE.lm + 25, y + 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setTextHex(doc, COLORS.steel);
  doc.text(`DNI/NIE: ${plan?.dni || 'N/A'}`, PAGE.lm + 25, y + 21);
  setTextHex(doc, COLORS.neonBlue); doc.text((plan?.email || 'No especificado').toLowerCase(), PAGE.lm + 25, y + 28);

  // Panel estado
  const rightX = leftCol + 5;
  setFillHex(doc, COLORS.charcoal);
  doc.roundedRect(rightX, y, rightColW, 35, 12, 12, 'F');
  drawDiagonalPattern(doc, rightX, y, rightColW, 35, COLORS.neonPurple, 0.1);

  const fecha = new Date(plan?.fecha || Date.now());
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = fecha.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
  const año = fecha.getFullYear();

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text(dia, rightX + 10, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.silver);
  doc.text(`${mes} ${año}`, rightX + 10, y + 21);

  const estado = String(plan?.estado || 'SIMULADO').replace('_', ' ').toUpperCase();
  const estadoColor = estado === 'ACTIVO' ? COLORS.neonGreen : estado === 'SIMULADO' ? COLORS.gold : COLORS.coral;

  drawGlowEffect(doc, rightX + 10, y + 24, 45, 7, estadoColor, 2);
  setFillHex(doc, estadoColor); doc.roundedRect(rightX + 10, y + 24, 45, 7, 3.5, 3.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(255, 255, 255);
  doc.text(estado, rightX + 32.5, y + 28.5, { align: 'center' });

  return y + 45;
}

function summaryCards(doc, totals, y) {
  const cardSize = (PAGE.w - PAGE.lm - PAGE.rm - 10) / 2;
  const cardHeight = 55;

  function createMetricCard(x, y, title, value, subtitle, colorHex) {
    drawGlowEffect(doc, x, y, cardSize, cardHeight, colorHex, 2);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardSize, cardHeight, 10, 10, 'F');
    setDrawHex(doc, colorHex); doc.setLineWidth(0.5); doc.roundedRect(x, y, cardSize, cardHeight, 10, 10, 'S');

    withAlpha(doc, 0.1, () => {
      setFillHex(doc, colorHex);
      doc.roundedRect(x, y, cardSize, 20, 10, 10, 'F');
      doc.rect(x, y + 10, cardSize, 10, 'F');
    });

    withAlpha(doc, 0.15, () => {
      setFillHex(doc, colorHex);
      doc.circle(x + cardSize - 15, y + 35, 15, 'F');
      doc.circle(x + cardSize - 15, y + 35, 20, 'F');
    });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.steel);
    doc.text(title.toUpperCase(), x + 10, y + 12);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); setTextHex(doc, COLORS.charcoal);
    doc.text(value, x + 10, y + 28);

    if (subtitle) {
      withAlpha(doc, 0.1, () => {
        setFillHex(doc, colorHex);
        doc.roundedRect(x + 10, y + 35, 50, 12, 6, 6, 'F');
      });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, colorHex);
      doc.text(subtitle, x + 35, y + 42.5, { align: 'center' });
    }
  }

  // Cards
  createMetricCard(PAGE.lm, y, 'Deuda Original', fmtEUR(totals.totalOriginal), 'INICIAL', COLORS.coral);

  const base = totals.totalOriginal || 1;
  const ahorroPercent = ((totals.ahorro / base) * 100).toFixed(0);
  createMetricCard(PAGE.lm + cardSize + 10, y, 'Total a Pagar', fmtEUR(totals.totalFinal), `-${ahorroPercent}%`, COLORS.neonBlue);

  y += cardHeight + 10;

  createMetricCard(PAGE.lm, y, 'Cuota Mensual', fmtEUR(totals.cuotaMensual), `${totals.numCuotas} MESES`, COLORS.neonPurple);
  createMetricCard(PAGE.lm + cardSize + 10, y, 'Ahorro Total', fmtEUR(totals.ahorro), 'BENEFICIO', COLORS.neonGreen);

  // Barra de progreso
  y += cardHeight + 15;
  const progressWidth = PAGE.w - PAGE.lm - PAGE.rm;
  const progressHeight = 8;
  setFillHex(doc, COLORS.smoke); doc.roundedRect(PAGE.lm, y, progressWidth, progressHeight, 4, 4, 'F');

  const progress = (totals.totalFinal / base);
  const fill = progressWidth * Math.max(0, Math.min(1, progress));
  withAlpha(doc, 0.3, () => {
    setFillHex(doc, COLORS.neonGreen);
    doc.roundedRect(PAGE.lm - 1, y - 1, fill + 2, progressHeight + 2, 4, 4, 'F');
  });
  setFillHex(doc, COLORS.neonGreen); doc.roundedRect(PAGE.lm, y, fill, progressHeight, 4, 4, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setTextHex(doc, COLORS.charcoal);
  doc.text(`${(progress * 100).toFixed(0)}% DEL TOTAL ORIGINAL`, PAGE.lm, y - 2);
  setTextHex(doc, COLORS.neonGreen); doc.text(`${ahorroPercent}% AHORRO`, PAGE.w - PAGE.rm, y - 2, { align: 'right' });

  return y + 20;
}

// --- Tabla de deudas con salto de página ---
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

  function drawDebtHeader(y) {
    // Título
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); setTextHex(doc, COLORS.charcoal);
    doc.text('DETALLE', x, y - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(18); setTextHex(doc, COLORS.steel);
    doc.text(' DE DEUDAS', x + 35, y - 12);
    setDrawHex(doc, COLORS.neonBlue); doc.setLineWidth(2); doc.line(x, y - 9, x + 30, y - 9);

    // Header
    setFillHex(doc, COLORS.charcoal); doc.roundedRect(x, y, w, headH, 8, 8, 'F');
    drawCircuitPattern(doc, x, y, w, headH, COLORS.neonBlue, 0.2);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    let cx = x + 8;
    cols.forEach((c, i) => {
      if (i < 3) setFillHex(doc, COLORS.silver);
      else if (c.key === 'descuento') setFillHex(doc, COLORS.gold);
      else setFillHex(doc, COLORS.neonBlue);
      doc.circle(cx - 3, y + 8, 1, 'F');

      if (c.align === 'right') doc.text(c.title, cx + c.w - 8, y + 9, { align: 'right' });
      else if (c.align === 'center') doc.text(c.title, cx + c.w / 2, y + 9, { align: 'center' });
      else doc.text(c.title, cx + 2, y + 9);
      cx += c.w;
    });

    // Subtítulos
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); setTextHex(doc, COLORS.silver);
    let subtitleCx = x + 8;
    const subtitles = ['Identificador', 'Tipo', 'Acreedor', 'Importe inicial', 'Reducción', 'Importe negociado'];
    cols.forEach((c, i) => {
      if (c.align === 'right') doc.text(subtitles[i], subtitleCx + c.w - 8, y + 15, { align: 'right' });
      else if (c.align === 'center') doc.text(subtitles[i], subtitleCx + c.w / 2, y + 15, { align: 'center' });
      else doc.text(subtitles[i], subtitleCx + 2, y + 15);
      subtitleCx += c.w;
    });

    // Badge # de deudas
    withAlpha(doc, 0.15, () => {
      setFillHex(doc, COLORS.neonGreen);
      doc.roundedRect(x + 5, y + 20, 40, 10, 5, 5, 'F');
    });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); setTextHex(doc, COLORS.neonGreen);
    doc.text(`${rows.length} DEUDAS`, x + 25, y + 26, { align: 'center' });
  }

  function maybePageBreak(y) {
    if (y + rowH + PAGE.bm > PAGE.h) {
      doc.addPage();
      const ny = PAGE.tm + 15; // margen superior para nuevo header
      drawDebtHeader(ny);
      return ny + headH + 5;
    }
    return y;
  }

  let y = startY + 15;
  drawDebtHeader(y);
  y += headH + 5;

  // Filas
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  rows.forEach((r, i) => {
    y = maybePageBreak(y);
    if (i % 2 === 0) { setFillHex(doc, COLORS.cloud); doc.roundedRect(x, y - 3, w, rowH, 4, 4, 'F'); }

    const desc = toNumber(r.descuento);
    const indicatorColor = desc >= 50 ? COLORS.neonGreen : desc >= 30 ? COLORS.gold : COLORS.coral;
    setFillHex(doc, indicatorColor); withAlpha(doc, 0.5, () => { doc.rect(x, y - 3, 2, rowH, 'F'); });

    let rowCx = x + 8;
    cols.forEach(c => {
      const raw = r[c.key];
      const text = c.fmt ? c.fmt(raw) : String(raw ?? '—');
      const ty = y + 3;

      if (c.key === 'importeFinal') { setTextHex(doc, COLORS.neonBlue); doc.setFont('helvetica', 'bold'); }
      else if (c.key === 'descuento') { setTextHex(doc, indicatorColor); doc.setFont('helvetica', 'bold'); }
      else if (c.key === 'importeOriginal') { setTextHex(doc, COLORS.coral); doc.setFont('helvetica', 'normal'); }
      else { setTextHex(doc, COLORS.charcoal); doc.setFont('helvetica', 'normal'); }

      if (c.align === 'right') doc.text(text, rowCx + c.w - 8, ty, { align: 'right' });
      else if (c.align === 'center') doc.text(text, rowCx + c.w / 2, ty, { align: 'center' });
      else doc.text(text, rowCx + 2, ty);

      rowCx += c.w;
    });

    y += rowH;
  });

  // Totales
  const totalOriginal = rows.reduce((s, r) => s + toNumber(r.importeOriginal), 0);
  const totalFinal = rows.reduce((s, r) => s + toNumber(r.importeFinal), 0);
  const ds = rows.map(r => toNumber(r.descuento)).filter(n => !Number.isNaN(n));
  const descuentoMedio = ds.length ? (ds.reduce((a, b) => a + b, 0) / ds.length) : 0;

  y = maybePageBreak(y + 8);

  setFillHex(doc, COLORS.deepBlack); doc.roundedRect(x, y, w, 25, 8, 8, 'F');
  withAlpha(doc, 0.1, () => { setFillHex(doc, COLORS.neonPurple); doc.roundedRect(x, y, w, 12, 8, 8, 'F'); doc.rect(x, y + 6, w, 6, 'F'); });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setTextHex(doc, COLORS.silver);
  doc.text('TOTALES', x + 10, y + 7);

  const totalCx = x + cols[0].w + cols[1].w + cols[2].w;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setTextHex(doc, COLORS.coral);
  doc.text(fmtEUR(totalOriginal), totalCx + cols[3].w - 8, y + 15, { align: 'right' });

  setFillHex(doc, COLORS.gold);
  doc.roundedRect(totalCx + cols[3].w + 15, y + 10, 30, 10, 5, 5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(`-${descuentoMedio.toFixed(0)}%`, totalCx + cols[3].w + cols[4].w / 2, y + 16.5, { align: 'center' });

  drawGlowEffect(doc, totalCx + cols[3].w + cols[4].w + 10, y + 9, cols[5].w - 18, 12, COLORS.neonBlue, 1);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setTextHex(doc, COLORS.neonBlue);
  doc.text(fmtEUR(totalFinal), totalCx + cols[3].w + cols[4].w + cols[5].w - 8, y + 16, { align: 'right' });

  return y + 35;
}

function termsAndFooter(doc, y) {
  // Página nueva si no cabe
  if (y + 50 > PAGE.h - PAGE.bm) { doc.addPage(); y = PAGE.tm; }

  // Sección términos minimalista
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setTextHex(doc, COLORS.steel);
  doc.text('INFORMACIÓN IMPORTANTE', PAGE.lm, y);
  y += 6;

  const terms = [
    'Plan sujeto a aprobación de las entidades acreedoras',
    'Las condiciones pueden variar según la respuesta de cada acreedor',
    'Compromiso de mantener los pagos acordados al día',
    'Seguimiento y gestión integral por DMD Asesores'
  ];

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setTextHex(doc, COLORS.charcoal);
  terms.forEach((t, i) => { doc.text(`• ${t}`, PAGE.lm + 2, y + (i * 5)); });

  // Footer
  const footY = PAGE.h - 25;
  setDrawHex(doc, COLORS.pearl); doc.setLineWidth(0.5); doc.line(PAGE.lm, footY, PAGE.w - PAGE.rm, footY);

  const genDate = new Date();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.steel);
  doc.text('Documento confidencial', PAGE.lm, footY + 6);
  const fechaGen = genDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(fechaGen, PAGE.w / 2, footY + 6, { align: 'center' });
  doc.text(`© ${genDate.getFullYear()} DMD Asesores`, PAGE.w - PAGE.rm, footY + 6, { align: 'right' });
}

// ====== API compatible con tu simulador ======
export async function exportPlanToPDF(planData) {
  showNotification('Generando PDF...', 'info');

  const jsPDF = await ensureJsPDFLoaded();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  // Logo opcional (si existe /logo.png en tu public)
  const logoDataURL = await imgToDataURL('logo.png');

  // Normalizar deudas
  const deudas = Array.isArray(planData?.deudas) ? planData.deudas.map(d => {
    const original = toNumber(d?.importeOriginal ?? d?.deuda ?? d?.debes ?? 0);
    const final = toNumber(d?.importeFinal ?? d?.pagar ?? d?.pagarias ?? 0);
    const desc = d?.descuento != null ? toNumber(d?.descuento) : (original ? (1 - (final / original)) * 100 : 0);
    return {
      contrato: d?.contrato || '—',
      producto: d?.producto || '—',
      entidad:  d?.entidad  || d?.acreedor || '—',
      importeOriginal: original,
      descuento: desc,
      importeFinal: final,
    };
  }) : [];

  // Totales
  const totalOriginal = deudas.reduce((s, r) => s + toNumber(r.importeOriginal), 0);
  const totalFinal = deudas.reduce((s, r) => s + toNumber(r.importeFinal), 0);
  const cuotaMensual = toNumber(planData?.cuotaMensual ?? 0);
  const numCuotas = Number(planData?.numCuotas ?? 0);
  const ahorro = Math.max(0, totalOriginal - totalFinal);
  const ds = deudas.map(r => toNumber(r.descuento)).filter(n => !Number.isNaN(n));
  const descuentoMedio = ds.length ? (ds.reduce((a, b) => a + b, 0) / ds.length) : 0;

  // Dibujo
  header(doc, planData, logoDataURL);
  let y = clientAndPlanBlock(doc, planData, 65);
  y = summaryCards(doc, { totalOriginal, totalFinal, cuotaMensual, ahorro, descuentoMedio, numCuotas }, y + 6);
  y = tableDeudas(doc, deudas, y + 12);
  termsAndFooter(doc, y + 8);

  const filename = generateFilename(planData);
  doc.save(filename);

  showNotification(`✅ PDF generado: ${filename}`, 'success');
  return { success: true, filename };
}
