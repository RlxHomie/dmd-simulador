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
  // Paleta Ejecutiva Profesional
  navyBlue: '#001f3f',
  deepNavy: '#0a192f',
  slateGray: '#2d3748',
  lightGray: '#e2e8f0',

  // Tonos neutros
  charcoal: '#4a5568',
  silver: '#a0aec0',
  pearl: '#edf2f7',
  white: '#ffffff',

  // Acentos sutiles
  teal: '#319795',
  forestGreen: '#2f855a',
  gold: '#d69e2e',
  crimson: '#e53e3e',
  indigo: '#4c51bf',
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

// Sombra suave rectangular
function drawShadowEffect(doc, x, y, w, h, hexColor, intensity = 2) {
  for (let i = 4; i > 0; i--) {
    const alpha = (0.1 / 4) * (4 - i + 1);
    const offset = i * intensity;
    withAlpha(doc, alpha, () => {
      setFillHex(doc, hexColor);
      doc.roundedRect(x - offset / 2 + offset / 4, y - offset / 2 + offset / 2, w + offset, h + offset, 8, 8, 'F');
    });
  }
}

// Patrón de rayas sutiles
function drawStripePattern(doc, x, y, w, h, hexColor, opacity = 0.05) {
  withAlpha(doc, opacity, () => {
    setDrawHex(doc, hexColor);
    doc.setLineWidth(0.2);
    const step = 3;
    for (let i = 0; i < h; i += step) {
      doc.line(x, y + i, x + w, y + i);
    }
  });
}

// Patrón de grid sutil
function drawGridPattern(doc, startX, startY, width, height, hexColor, opacity = 0.08) {
  withAlpha(doc, opacity, () => {
    setDrawHex(doc, hexColor);
    doc.setLineWidth(0.1);
    const gridSize = 5;
    for (let i = 0; i <= width; i += gridSize) {
      doc.line(startX + i, startY, startX + i, startY + height);
    }
    for (let j = 0; j <= height; j += gridSize) {
      doc.line(startX, startY + j, startX + width, startY + j);
    }
  });
}

// --- Secciones del PDF ---
function header(doc, plan, logoDataURL) {
  // Fondo superior limpio
  setFillHex(doc, COLORS.navyBlue);
  doc.rect(0, 0, PAGE.w, 50, 'F');

  // Patrón sutil
  drawGridPattern(doc, 0, 0, PAGE.w, 50, COLORS.teal, 0.1);

  // Logo
  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', PAGE.lm, 10, 40, 16);
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
    doc.text('DMD ASESORES', PAGE.lm, 22);
  }

  // Título elegante
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text('PLAN DE REESTRUCTURACIÓN', PAGE.w - PAGE.rm, 22, { align: 'right' });

  // Referencia sutil
  const ref = plan?.referencia || 'REF-000000';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.lightGray);
  doc.text(ref, PAGE.w - PAGE.rm, 32, { align: 'right' });

  // Línea divisoria limpia
  setDrawHex(doc, COLORS.teal);
  doc.setLineWidth(0.3);
  doc.line(PAGE.lm, 50, PAGE.w - PAGE.rm, 50);
}

function clientAndPlanBlock(doc, plan, y) {
  const blockHeight = 40;

  // Fondo panel cliente
  setFillHex(doc, COLORS.white);
  doc.roundedRect(PAGE.lm, y, PAGE.w - PAGE.lm - PAGE.rm, blockHeight, 6, 6, 'F');
  drawShadowEffect(doc, PAGE.lm, y, PAGE.w - PAGE.lm - PAGE.rm, blockHeight, COLORS.slateGray, 2);

  // Info cliente
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); setTextHex(doc, COLORS.navyBlue);
  const nombre = plan?.cliente || 'Sin especificar';
  doc.text(nombre.toUpperCase(), PAGE.lm + 10, y + 12);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setTextHex(doc, COLORS.charcoal);
  doc.text(`DNI/NIE: ${plan?.dni || 'N/A'}   |   Email: ${plan?.email || 'No especificado'}`, PAGE.lm + 10, y + 22);

  // Estado y fecha
  const fecha = new Date(plan?.fecha || Date.now());
  const fechaStr = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Fecha: ${fechaStr}`, PAGE.lm + 10, y + 32);

  const estado = String(plan?.estado || 'SIMULADO').replace('_', ' ').toUpperCase();
  const estadoColor = estado === 'ACTIVO' ? COLORS.forestGreen : estado === 'SIMULADO' ? COLORS.gold : COLORS.crimson;
  setFillHex(doc, estadoColor);
  doc.roundedRect(PAGE.w - PAGE.rm - 60, y + 10, 50, 20, 4, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text(estado, PAGE.w - PAGE.rm - 35, y + 22, { align: 'center' });

  return y + blockHeight + 15;
}

function summaryCards(doc, totals, y) {
  const cardW = (PAGE.w - PAGE.lm - PAGE.rm - 15) / 2;
  const cardH = 45;

  function createMetricCard(x, yPos, title, value, subtitle, colorHex) {
    setFillHex(doc, COLORS.white);
    doc.roundedRect(x, yPos, cardW, cardH, 6, 6, 'F');
    drawShadowEffect(doc, x, yPos, cardW, cardH, COLORS.slateGray, 1.5);

    setDrawHex(doc, COLORS.lightGray);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, yPos, cardW, cardH, 6, 6, 'S');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setTextHex(doc, COLORS.charcoal);
    doc.text(title.toUpperCase(), x + 10, yPos + 12);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); setTextHex(doc, colorHex);
    doc.text(value, x + 10, yPos + 28);

    if (subtitle) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.silver);
      doc.text(subtitle, x + 10, yPos + 38);
    }
  }

  // Cards en dos filas
  createMetricCard(PAGE.lm, y, 'Deuda Original', fmtEUR(totals.totalOriginal), 'Importe inicial total', COLORS.crimson);
  createMetricCard(PAGE.lm + cardW + 15, y, 'Ahorro Total', fmtEUR(totals.ahorro), `-${((totals.ahorro / (totals.totalOriginal || 1)) * 100).toFixed(0)}%`, COLORS.forestGreen);

  y += cardH + 10;

  createMetricCard(PAGE.lm, y, 'Total a Pagar', fmtEUR(totals.totalFinal), 'Importe final negociado', COLORS.teal);
  createMetricCard(PAGE.lm + cardW + 15, y, 'Cuota Mensual', fmtEUR(totals.cuotaMensual), `${totals.numCuotas} meses`, COLORS.indigo);

  // Barra de progreso limpia
  y += cardH + 15;
  const progW = PAGE.w - PAGE.lm - PAGE.rm;
  const progH = 6;
  setFillHex(doc, COLORS.lightGray);
  doc.roundedRect(PAGE.lm, y, progW, progH, 3, 3, 'F');

  const prog = totals.totalFinal / (totals.totalOriginal || 1);
  const fillW = progW * Math.max(0, Math.min(1, prog));
  setFillHex(doc, COLORS.teal);
  doc.roundedRect(PAGE.lm, y, fillW, progH, 3, 3, 'F');

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.charcoal);
  doc.text(`Progreso: ${(prog * 100).toFixed(0)}% del total original (${((1 - prog) * 100).toFixed(0)}% ahorro)`, PAGE.lm, y + progH + 8);

  return y + progH + 20;
}

// --- Tabla de deudas con salto de página ---
function tableDeudas(doc, rows, startY) {
  const x = PAGE.lm;
  const w = PAGE.w - PAGE.lm - PAGE.rm;
  const rowH = 12;
  const headH = 20;

  const cols = [
    { key: 'contrato', title: 'Contrato', w: w * 0.15 },
    { key: 'producto', title: 'Producto', w: w * 0.15 },
    { key: 'entidad',  title: 'Entidad',  w: w * 0.24 },
    { key: 'importeOriginal', title: 'Original', w: w * 0.16, align: 'right', fmt: v => fmtEUR(v) },
    { key: 'descuento', title: 'Desc.', w: w * 0.12, align: 'center', fmt: v => `${toNumber(v).toFixed(0)}%` },
    { key: 'importeFinal', title: 'Final', w: w * 0.18, align: 'right', fmt: v => fmtEUR(v) },
  ];

  function drawDebtHeader(y) {
    // Título sección
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); setTextHex(doc, COLORS.navyBlue);
    doc.text('DETALLE DE DEUDAS', x, y - 8);

    // Header tabla
    setFillHex(doc, COLORS.deepNavy);
    doc.roundedRect(x, y, w, headH, 4, 4, 'F');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    let cx = x;
    cols.forEach(c => {
      const tx = c.align === 'right' ? cx + c.w - 8 : c.align === 'center' ? cx + c.w / 2 : cx + 8;
      const alignOpt = c.align ? { align: c.align } : {};
      doc.text(c.title.toUpperCase(), tx, y + 12, alignOpt);
      cx += c.w;
    });
  }

  function maybePageBreak(y) {
    if (y + rowH + PAGE.bm > PAGE.h) {
      doc.addPage();
      const ny = PAGE.tm + 10;
      drawDebtHeader(ny);
      return ny + headH + 5;
    }
    return y;
  }

  let y = startY + 15;
  drawDebtHeader(y);
  y += headH + 5;

  // Filas con alternancia sutil
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  setDrawHex(doc, COLORS.lightGray);
  doc.setLineWidth(0.1);
  rows.forEach((r, i) => {
    y = maybePageBreak(y);
    if (i % 2 === 0) {
      setFillHex(doc, COLORS.pearl);
      doc.rect(x, y - rowH + 3, w, rowH, 'F');
    }

    let rowCx = x;
    cols.forEach(c => {
      const raw = r[c.key];
      const text = c.fmt ? c.fmt(raw) : String(raw ?? '—');
      const ty = y + 3;
      const color = c.key === 'importeFinal' ? COLORS.teal : c.key === 'descuento' ? COLORS.gold : c.key === 'importeOriginal' ? COLORS.crimson : COLORS.charcoal;
      setTextHex(doc, color);

      const tx = c.align === 'right' ? rowCx + c.w - 8 : c.align === 'center' ? rowCx + c.w / 2 : rowCx + 8;
      const alignOpt = c.align ? { align: c.align } : {};
      doc.text(text, tx, ty, alignOpt);

      rowCx += c.w;
    });

    doc.line(x, y + 3, x + w, y + 3);
    y += rowH;
  });

  // Línea final
  doc.line(x, y + 3 - rowH, x + w, y + 3 - rowH);

  // Totales
  const totalOriginal = rows.reduce((s, r) => s + toNumber(r.importeOriginal), 0);
  const totalFinal = rows.reduce((s, r) => s + toNumber(r.importeFinal), 0);
  const ds = rows.map(r => toNumber(r.descuento)).filter(n => !Number.isNaN(n));
  const descuentoMedio = ds.length ? (ds.reduce((a, b) => a + b, 0) / ds.length) : 0;

  y = maybePageBreak(y + 10);

  setFillHex(doc, COLORS.lightGray);
  doc.rect(x, y, w, 20, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setTextHex(doc, COLORS.navyBlue);
  doc.text('TOTALES', x + 8, y + 12);

  const totalCx = x + cols[0].w + cols[1].w + cols[2].w;
  setTextHex(doc, COLORS.crimson);
  doc.text(fmtEUR(totalOriginal), totalCx + cols[3].w - 8, y + 12, { align: 'right' });

  setTextHex(doc, COLORS.gold);
  doc.text(`-${descuentoMedio.toFixed(0)}%`, totalCx + cols[3].w + cols[4].w / 2, y + 12, { align: 'center' });

  setTextHex(doc, COLORS.teal);
  doc.text(fmtEUR(totalFinal), totalCx + cols[3].w + cols[4].w + cols[5].w - 8, y + 12, { align: 'right' });

  return y + 30;
}

function termsAndFooter(doc, y) {
  // Página nueva si no cabe
  if (y + 60 > PAGE.h - PAGE.bm) { doc.addPage(); y = PAGE.tm; }

  // Sección términos
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setTextHex(doc, COLORS.navyBlue);
  doc.text('INFORMACIÓN IMPORTANTE', PAGE.lm, y);
  y += 8;

  const terms = [
    'Este plan está sujeto a la aprobación final de las entidades acreedoras.',
    'Las condiciones pueden ajustarse basado en las negociaciones individuales.',
    'Es esencial mantener los pagos acordados para el éxito del plan.',
    'DMD Asesores proporcionará seguimiento y gestión continua.'
  ];

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setTextHex(doc, COLORS.charcoal);
  terms.forEach((t, i) => {
    doc.text(`- ${t}`, PAGE.lm + 2, y + (i * 6));
  });
  y += terms.length * 6 + 10;

  // Footer
  const footY = PAGE.h - 20;
  setDrawHex(doc, COLORS.silver);
  doc.setLineWidth(0.2);
  doc.line(PAGE.lm, footY, PAGE.w - PAGE.rm, footY);

  const genDate = new Date();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setTextHex(doc, COLORS.silver);
  doc.text('Documento confidencial - Solo para uso interno del cliente', PAGE.lm, footY + 10);
  const fechaGen = genDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Generado el: ${fechaGen}`, PAGE.w - PAGE.rm, footY + 10, { align: 'right' });
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
  let y = clientAndPlanBlock(doc, planData, 60);
  y = summaryCards(doc, { totalOriginal, totalFinal, cuotaMensual, ahorro, descuentoMedio, numCuotas }, y + 10);
  y = tableDeudas(doc, deudas, y + 15);
  termsAndFooter(doc, y + 10);

  const filename = generateFilename(planData);
  doc.save(filename);

  showNotification(`✅ PDF generado: ${filename}`, 'success');
  return { success: true, filename };
}
