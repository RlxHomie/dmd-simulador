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

// ===== DIBUJO =====
const PAGE = { w: 210, h: 297, lm: 15, rm: 15, tm: 15, bm: 15 }; // A4 mm
const COLORS = {
  primary: '#0071e3',
  primaryDark: '#005bb5',
  gray: '#444',
  light: '#8a8a8a',
  border: '#E2E6EA',
  danger: '#dc3545',
  warn: '#fd7e14',
  success: '#28a745',
};

function header(doc, plan, logoDataURL) {
  // Banner superior
  doc.setFillColor(COLORS.primary);
  doc.rect(0, 0, PAGE.w, 30, 'F');

  // Logo o texto
  if (logoDataURL) {
    doc.addImage(logoDataURL, 'PNG', PAGE.lm, 7, 40, 16);
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor('#ffffff');
    doc.text('DMD ASESORES', PAGE.lm, 17);
  }

  // Título + referencia
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#ffffff');
  doc.text('Plan de Reestructuración de Deuda', PAGE.w - PAGE.rm, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const ref = plan?.referencia || 'N/A';
  doc.text(`Ref: ${ref}`, PAGE.w - PAGE.rm, 21, { align: 'right' });
}

function clientAndPlanBlock(doc, plan, y) {
  // Caja
  doc.setDrawColor(COLORS.border); doc.setFillColor('#F7FAFF');
  doc.roundedRect(PAGE.lm, y, PAGE.w - PAGE.lm - PAGE.rm, 32, 3, 3, 'FD');

  // Titulares
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(COLORS.primary);
  doc.text('DATOS DEL CLIENTE', PAGE.lm + 5, y + 7);
  doc.text('DATOS DEL PLAN', PAGE.w / 2 + 5, y + 7);

  // Datos cliente
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(COLORS.gray);
  const nombre = plan?.cliente || 'N/A';
  const dni = plan?.dni || 'N/A';
  const email = plan?.email || 'No especificado';
  doc.text(`Nombre: ${nombre}`, PAGE.lm + 5, y + 14);
  doc.text(`DNI/NIE: ${dni}`, PAGE.lm + 5, y + 20);
  doc.text(`Email: ${email}`, PAGE.lm + 5, y + 26);

  // Datos plan
  const fecha = new Date(plan?.fecha || Date.now()).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const estado = String(plan?.estado || 'SIMULADO').replace('_', ' ').toUpperCase();
  doc.text(`Fecha: ${fecha}`, PAGE.w / 2 + 5, y + 14);
  doc.text(`Estado: ${estado}`, PAGE.w / 2 + 5, y + 20);
  return y + 32 + 6;
}

function summaryCards(doc, totals, y) {
  // 2 columnas x 2 tarjetas
  const colW = (PAGE.w - PAGE.lm - PAGE.rm - 10) / 2;
  const h = 18;

  function card(x, title, value, color) {
    doc.setFillColor('#ffffff'); doc.setDrawColor(COLORS.border);
    doc.roundedRect(x, y, colW, h, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#666');
    doc.text(title, x + 4, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(color);
    doc.text(value, x + 4, y + 13.5);
  }

  card(PAGE.lm, 'Deuda Total Original', fmtEUR(totals.totalOriginal), COLORS.danger);
  card(PAGE.lm + colW + 10, 'Total a Pagar', fmtEUR(totals.totalFinal), COLORS.warn);

  y += h + 6;
  card(PAGE.lm, 'Cuota Mensual', fmtEUR(totals.cuotaMensual), COLORS.primary);
  card(PAGE.lm + colW + 10, 'Ahorro Total', fmtEUR(totals.ahorro), COLORS.success);

  // línea con descuento promedio y plazo
  y += h + 10;
  doc.setDrawColor(COLORS.border); doc.line(PAGE.lm, y, PAGE.w - PAGE.rm, y);
  y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#666');
  doc.text('Descuento Promedio:', PAGE.lm, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(COLORS.primary);
  doc.text(`${totals.descuentoMedio.toFixed(1)}%`, PAGE.lm + 44, y);

  doc.setFont('helvetica', 'normal'); doc.setTextColor('#666');
  doc.text('Plazo:', PAGE.lm + 80, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(COLORS.primary);
  doc.text(`${totals.numCuotas} meses`, PAGE.lm + 98, y);
  return y + 8;
}

function tableDeudas(doc, rows, startY) {
  const x = PAGE.lm, w = PAGE.w - PAGE.lm - PAGE.rm;
  const rowH = 7, headH = 8;
  const cols = [
    { key: 'contrato', title: 'Contrato', w: w * 0.18 },
    { key: 'producto', title: 'Producto', w: w * 0.18 },
    { key: 'entidad',  title: 'Entidad',  w: w * 0.20 },
    { key: 'importeOriginal', title: 'Original', w: w * 0.18, align: 'right', fmt: v => fmtEUR(v) },
    { key: 'descuento', title: 'Desc.', w: w * 0.10, align: 'center', fmt: v => `${toNumber(v).toFixed(1)}%` },
    { key: 'importeFinal', title: 'Final', w: w * 0.16, align: 'right', fmt: v => fmtEUR(v) },
  ];

  function header(y) {
    doc.setFillColor(COLORS.primary); doc.setTextColor('#ffffff');
    doc.rect(x, y, w, headH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    let cx = x + 2;
    cols.forEach(c => { doc.text(c.title, cx, y + 5.5); cx += c.w; });
  }

  function maybePageBreak(y) {
    if (y + rowH + PAGE.bm > PAGE.h) {
      doc.addPage();
      header(PAGE.tm);
      return PAGE.tm + headH;
    }
    return y;
  }

  // título
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(COLORS.primary);
  doc.text('DETALLE DE DEUDAS', x, startY);
  let y = startY + 4;

  header(y);
  y += headH;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  rows.forEach((r, i) => {
    y = maybePageBreak(y);
    if (i % 2 === 1) { doc.setFillColor('#FAFBFC'); doc.rect(x, y, w, rowH, 'F'); }
    let cx = x + 2;
    cols.forEach(c => {
      const raw = r[c.key];
      const text = c.fmt ? c.fmt(raw) : String(raw ?? '—');
      const ty = y + 4.8;
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

  // totales
  const totalOriginal = rows.reduce((s, r) => s + toNumber(r.importeOriginal), 0);
  const totalFinal = rows.reduce((s, r) => s + toNumber(r.importeFinal), 0);
  const ds = rows.map(r => toNumber(r.descuento)).filter(n => !Number.isNaN(n));
  const descuentoMedio = ds.length ? (ds.reduce((a,b)=>a+b,0) / ds.length) : 0;

  y = maybePageBreak(y + 2);
  doc.setFillColor('#F1F3F5'); doc.rect(x, y, w, rowH + 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setTextColor('#1B1B1B');
  doc.text('TOTALES:', x + w - (cols[3].w + cols[4].w + cols[5].w) - 2, y + 5, { align: 'right' });
  // Original
  let cx = x + cols[0].w + cols[1].w + cols[2].w;
  doc.setTextColor(COLORS.danger);
  doc.text(fmtEUR(totalOriginal), cx + cols[3].w - 2, y + 5, { align: 'right' });
  // Desc.
  doc.setTextColor('#1B1B1B');
  doc.text(`${descuentoMedio.toFixed(1)}%`, cx + cols[3].w + cols[4].w / 2, y + 5, { align: 'center' });
  // Final
  doc.setTextColor(COLORS.success);
  doc.text(fmtEUR(totalFinal), cx + cols[3].w + cols[4].w + cols[5].w - 2, y + 5, { align: 'right' });

  return y + rowH + 4;
}

function termsAndFooter(doc, y) {
  const text =
    '• Este plan está sujeto a la aprobación final de las entidades acreedoras.\n' +
    '• Las condiciones pueden variar según la respuesta de cada acreedor.\n' +
    '• El cliente se compromete a mantener al día los pagos acordados.\n' +
    '• DMD Asesores proporcionará seguimiento y gestión integral del plan.';
  const w = PAGE.w - PAGE.lm - PAGE.rm;

  doc.setDrawColor('#FFEAA7'); doc.setFillColor('#FFF3CD');
  const boxH = 32;
  doc.roundedRect(PAGE.lm, y, w, boxH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor('#856404');
  doc.text('TÉRMINOS Y CONDICIONES', PAGE.lm + 4, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, w - 8);
  doc.text(lines, PAGE.lm + 4, y + 12);
  y += boxH + 6;

  doc.setDrawColor(COLORS.border); doc.line(PAGE.lm, y, PAGE.w - PAGE.rm, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#6c757d');
  y += 6;
  const genDate = new Date();
  doc.text('📄 Documento confidencial - Uso exclusivo del cliente', PAGE.lm, y);
  doc.text(
    `🕒 Generado: ${genDate.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} ${genDate.toLocaleTimeString('es-ES')}`,
    PAGE.lm, y + 5
  );
  doc.setFont('helvetica', 'bold'); doc.setTextColor(COLORS.primary);
  doc.text(`🏢 DMD Asesores © ${genDate.getFullYear()}`, PAGE.lm, y + 10);
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

  // Dibujo
  header(doc, planData, logoDataURL);
  let y = clientAndPlanBlock(doc, planData, 36);
  y = summaryCards(doc, { totalOriginal, totalFinal, cuotaMensual, ahorro, descuentoMedio, numCuotas }, y + 2);
  y = tableDeudas(doc, deudas, y + 6);
  termsAndFooter(doc, Math.min(y + 6, PAGE.h - 50));

  const filename = generateFilename(planData);
  doc.save(filename);

  showNotification(`✅ PDF generado: ${filename}`, 'success');
  return { success: true, filename };
}
