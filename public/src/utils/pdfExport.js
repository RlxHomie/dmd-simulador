// pdfExport.js
// Alineado al proyecto. Entrada principal: pdfExport.generateFromSimulation(sim).
// Requiere jsPDF v2.x en window.jspdf.jsPDF.

export const pdfExport = (() => {
  const PAGE = { w: 210, h: 297, lm: 15, rm: 15, tm: 15, bm: 15 };
  const COLORS = {
    primary: '#2B6CB0',
    primaryLight: '#E6EFFA',
    kpiBlue: '#2F7FEC',
    kpiBg: '#F5F9FF',
    grayText: '#444',
    lightGray: '#8A8A8A',
    border: '#DADDE2',
    blueDark: '#0B3A75',
    greenBar: '#46C36B',
  };
  const LOGO_PATH_DEFAULT = 'logo.png';

  // ---------- Utils ----------
  const toNumber = (v) => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    // soporta "31.507,50" o "31,507.50"
    const s = String(v).replace(/[^\d,.-]/g, '');
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      // decidir separador decimal por el último símbolo
      const last = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
      const dec = s[last];
      const norm = s
        .replace(/[.,](?=.*[.,])/g, (m, i) => (i === last ? 'DEC' : ''))
        .replace(/[.,]/g, '')
        .replace('DEC', '.');
      return Number(norm);
    }
    if (hasComma && !hasDot) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s.replace(/,/g, ''));
  };
  const fmtEUR = (n) =>
    Number(n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  const fmtPct = (n) => `${Number(n ?? 0).toFixed(2)}%`;

  function getJsPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF no está disponible. Inclúyelo antes de pdfExport.js');
    }
    return window.jspdf.jsPDF;
  }

  async function fetchAsDataURL(path) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ---------- MAPEO DESDE SIMULADOR ----------
  // Acepta estructuras comunes: { cliente:{nombre}, folio, fecha, vigenciaDiasHabiles, totales:{deuda,pagar,ahorroMensual,meses}, detalle/deudas:[{acreedor,deuda/pagar/meses}] }
  function mapFromSimulation(sim = {}) {
    const nombre =
      sim?.cliente?.nombre || sim?.clienteNombre || sim?.nombreCliente || sim?.nombre || 'Cliente';

    const numeroFolio = sim?.folio || sim?.numeroFolio || '—';
    const fecha = sim?.fecha || new Date().toLocaleDateString('es-ES');
    const vigenciaDiasHabiles = sim?.vigenciaDiasHabiles ?? 3;

    // Totales
    const deudaTotal =
      toNumber(sim?.totales?.deuda ?? sim?.totalDeuda ?? sim?.deudaTotal ?? 0);
    const totalAPagar =
      toNumber(sim?.totales?.pagar ?? sim?.totalPagar ?? sim?.totalAPagar ?? sim?.pagarias ?? 0);
    const ahorroMensual =
      toNumber(sim?.totales?.ahorroMensual ?? sim?.ahorroMensual ?? 0);
    const meses =
      toNumber(sim?.totales?.meses ?? sim?.meses ?? sim?.duracionMeses ?? 0);

    const ahorroTotal = deudaTotal - totalAPagar;
    const descuentoTotalPct = deudaTotal ? (ahorroTotal / deudaTotal) * 100 : 0;

    const detalle = Array.isArray(sim?.detalle) ? sim.detalle
                   : Array.isArray(sim?.deudas) ? sim.deudas
                   : Array.isArray(sim?.items) ? sim.items
                   : [];

    const deudas = detalle.map(d => ({
      acreedor: d?.acreedor || d?.entidad || d?.banco || '—',
      debes: toNumber(d?.debes ?? d?.deuda ?? d?.monto ?? 0),
      pagarias: toNumber(d?.pagarias ?? d?.pagar ?? d?.oferta ?? 0),
      meses: d?.meses ?? d?.plazo ?? '',
    }));

    const numeroDeudas = sim?.numeroDeudas ?? deudas.length;

    const asesor = {
      nombre: sim?.asesor?.nombre || sim?.asesorNombre || sim?.asesor || '—',
      email: sim?.asesor?.email || sim?.asesorEmail || '—',
      direccion: sim?.asesor?.direccion || sim?.asesorDireccion || '—',
    };

    return {
      header: { nombre, numeroFolio, numeroDeudas, fecha, vigenciaDiasHabiles },
      resumen: {
        deudaTotal,
        pagarias: totalAPagar,
        ahorroTotal,
        descuentoTotalPct,
        ahorroMensual,
        meses,
        barras: { debes: deudaTotal, pagarias: totalAPagar },
      },
      deudas,
      asesor,
    };
  }

  // ---------- Dibujo ----------
  async function drawHeader(doc, data, logoPath) {
    const { nombre, numeroFolio, numeroDeudas, fecha, vigenciaDiasHabiles } = data.header;
    const dataURL = await fetchAsDataURL(logoPath || LOGO_PATH_DEFAULT);
    if (dataURL) doc.addImage(dataURL, 'PNG', PAGE.w - PAGE.rm - 48, PAGE.tm - 2, 48, 16);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor('#1B1B1B');
    doc.text('Nombre:', PAGE.lm, 25);              doc.text('Número de folio:', PAGE.w / 2, 25);
    doc.text('Número de deudas:', PAGE.lm, 31);    doc.text('Fecha:', PAGE.w / 2, 31);
    doc.text('Deuda total:', PAGE.lm, 37);         doc.text('Fecha de vigencia:', PAGE.w / 2, 37);

    doc.setFont('helvetica', 'normal');
    doc.text(String(nombre), PAGE.lm + 20, 25);
    doc.text(String(numeroFolio), PAGE.w / 2 + 33, 25);
    doc.text(String(numeroDeudas), PAGE.lm + 30, 31);
    doc.text(String(fecha), PAGE.w / 2 + 15, 31);
    doc.text(fmtEUR(data.resumen.deudaTotal), PAGE.lm + 22, 37);
    doc.text(`${vigenciaDiasHabiles} días hábiles`, PAGE.w / 2 + 33, 37);

    doc.setFontSize(8); doc.setTextColor(COLORS.lightGray);
    doc.text('Página 1 de 1', PAGE.lm, PAGE.tm - 5);
  }

  function drawDashedArrow(doc, x1, y1, x2, y2) {
    doc.setDrawColor('#2D9CDB'); doc.setLineWidth(0.6);
    doc.setLineDash([1.8], 0); doc.line(x1, y1, x2, y2); doc.setLineDash();
    const ang = Math.atan2(y2 - y1, x2 - x1), s = 3;
    doc.line(x2, y2, x2 - s * Math.cos(ang - Math.PI / 6), y2 - s * Math.sin(ang - Math.PI / 6));
    doc.line(x2, y2, x2 - s * Math.cos(ang + Math.PI / 6), y2 - s * Math.sin(ang + Math.PI / 6));
  }

  function drawKpiCard(doc, { x, y, w, h, title, value, icon }) {
    doc.setFillColor(COLORS.kpiBg); doc.setDrawColor(COLORS.border);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');

    const iconSize = 10, ix = x + 6, iy = y + 6;
    doc.setFillColor(COLORS.kpiBlue); doc.roundedRect(ix, iy, iconSize, iconSize, 2, 2, 'F');
    doc.setTextColor('#FFFFFF'); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    const symbol = icon === 'calendar' ? '📅' : icon === 'camera' ? '📷' : '％';
    doc.text(symbol, ix + iconSize / 2, iy + iconSize / 2 + 3.1, { align: 'center' });

    doc.setTextColor(COLORS.grayText); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(String(title), x + 22, y + 12);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor('#1B1B1B');
    doc.text(String(value), x + 22, y + 22);
  }

  function drawBarsPanel(doc, { x, y, w, h, resumen }) {
    doc.setDrawColor(COLORS.border); doc.roundedRect(x, y, w, h, 3, 3, 'D');

    const gx = x + 15, gy = y + 16, gh = h - 30, baseY = gy + gh, barW = 28;
    const maxV = Math.max(resumen.barras.debes, resumen.barras.pagarias) * 1.1 || 1;
    const hDebes = (resumen.barras.debes / maxV) * (gh - 10);
    const hPaga  = (resumen.barras.pagarias / maxV) * (gh - 10);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor('#1B1B1B');
    doc.text('Lo que debes', gx + 10, gy - 4); doc.text('Lo que pagarías', gx + 10 + barW + 40, gy - 4);

    doc.setFont('helvetica', 'normal'); doc.setTextColor(COLORS.grayText);
    doc.text(fmtEUR(resumen.barras.debes), gx + 10, gy + 2);
    doc.text(fmtEUR(resumen.barras.pagarias), gx + 10 + barW + 40, gy + 2);

    doc.setFillColor(COLORS.blueDark); doc.roundedRect(gx + 10, baseY - hDebes, barW, hDebes, 3, 3, 'F');
    doc.setFillColor(COLORS.greenBar); doc.roundedRect(gx + 10 + barW + 40, baseY - hPaga, barW, hPaga, 3, 3, 'F');

    drawDashedArrow(doc, gx + 10 + barW, baseY - hDebes - 4, gx + 10 + barW + 40 + barW, baseY - hPaga - 4);

    const bannerH = 12;
    doc.setFillColor(COLORS.primary);
    doc.rect(x + 5, y + h - bannerH - 4, w - 10, bannerH, 'F');
    doc.setTextColor('#FFFFFF'); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`Te ahorrarás  ${fmtEUR(resumen.ahorroTotal)}`, x + w / 2, y + h - 4 - bannerH / 2 + 3.2, { align: 'center' });
  }

  function drawDebtsTitle(doc, y) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor('#1B6DB0');
    doc.text('Detalle de deudas', PAGE.lm, y);
  }

  function drawDebtTable(doc, startY, rows) {
    const x = PAGE.lm, w = PAGE.w - PAGE.lm - PAGE.rm, rowH = 7;

    doc.setFillColor(COLORS.primaryLight); doc.setDrawColor(COLORS.border);
    doc.rect(x, startY, w, rowH, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor('#1B1B1B');

    const headers = ['A quién le debes', 'Lo que debes', 'Lo que pagarías', 'Mes de liquidación'];
    const widths = [w * 0.40, w * 0.18, w * 0.22, w * 0.20];
    let cx = x + 2;
    headers.forEach((h, i) => { doc.text(h, cx, startY + 4.8); cx += widths[i]; });

    doc.setFont('helvetica', 'normal'); doc.setTextColor(COLORS.grayText);
    let y = startY + rowH;
    rows.forEach((r, i) => {
      if (i % 2 === 1) { doc.setFillColor('#FAFBFC'); doc.rect(x, y, w, rowH, 'F'); }
      let cx2 = x + 2;
      const cells = [r.acreedor || '—', fmtEUR(r.debes ?? 0), fmtEUR(r.pagarias ?? 0), String(r.meses ?? '')];
      cells.forEach((c, j) => { doc.text(String(c), cx2, y + 4.8); cx2 += widths[j]; });
      y += rowH;
    });
    return y;
  }

  function drawNotes(doc, y) {
    const notes =
      'Resuelve tu Deuda promueve la cultura de pago, por lo que para poder ser parte del programa el cliente deberá comprobar que tiene atraso en sus pagos.\n\n' +
      'El presente documento denominado Plan de Liquidación solamente ilustra una alternativa de pago. Los datos presentados en este documento son informativos y muestran un escenario estimado el cual puede cambiar. IVA incluido.\n\n' +
      '1. Incluye la comisión mensual de Resuelve Tu Deuda por €190,62 EUR durante los 12 primeros meses. Para los siguientes 6 meses por €133,44 EUR otros 6 meses más por €114,37 EUR y, por último, hasta concluir el programa por €30,25 EUR. Dentro de tu primera cuota ya está incluida la inscripción al programa equivalente a un mes de tu ahorro.\n\n' +
      '2. Incluye nuestra cuota de éxito (18.15% de la reducción obtenida en cada liquidación).';
    doc.setFont('helvetica', 'normal'); doc.setTextColor(COLORS.grayText); doc.setFontSize(9);
    const textWidth = PAGE.w - PAGE.lm - PAGE.rm;
    const lines = doc.splitTextToSize(notes, textWidth);
    doc.text(lines, PAGE.lm, y);
    return y + lines.length * 4.2;
  }

  function drawAdvisor(doc, y, asesor) {
    doc.setDrawColor(COLORS.border); doc.line(PAGE.lm, y, PAGE.w - PAGE.rm, y);
    const boxY = y + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor('#1B1B1B');
    doc.text('Asesor:', PAGE.lm, boxY); doc.text('E-mail:', PAGE.lm, boxY + 6);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(COLORS.grayText);
    doc.text(String(asesor?.nombre ?? '—'), PAGE.lm + 15, boxY);
    doc.text(String(asesor?.email ?? '—'), PAGE.lm + 15, boxY + 6);
    doc.text(String(asesor?.direccion ?? '—'), PAGE.w - PAGE.rm, boxY + 6, { align: 'right' });
  }

  // ---------- API ----------
  async function generate(plan, opts = {}) {
    const jsPDF = getJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const logoPath = opts.logoPath || LOGO_PATH_DEFAULT;

    await drawHeader(doc, plan, logoPath);

    const sectionY = 50, sectionH = 90;
    // marco de sección
    doc.setDrawColor(COLORS.border);
    doc.roundedRect(PAGE.lm, sectionY, PAGE.w - PAGE.lm - PAGE.rm, sectionH, 3, 3, 'D');

    // panel barras
    const panelX = PAGE.lm + 5, panelY = sectionY + 8;
    const panelW = (PAGE.w - PAGE.lm - PAGE.rm) * 0.55, panelH = sectionH - 16;
    drawBarsPanel(doc, { x: panelX, y: panelY, w: panelW, h: panelH, resumen: plan.resumen });

    // KPIs derecha
    const kx = panelX + panelW + 7, ky = panelY, kw = (PAGE.w - PAGE.rm - kx - 5), kh = 22;
    drawKpiCard(doc, { x: kx, y: ky, w: kw, h: kh, title: 'Descuento total', value: fmtPct(plan.resumen.descuentoTotalPct), icon: 'percent' });
    drawKpiCard(doc, { x: kx, y: ky + kh + 6, w: kw, h: kh, title: 'Ahorro mensual', value: fmtEUR(plan.resumen.ahorroMensual), icon: 'camera' });
    drawKpiCard(doc, { x: kx, y: ky + 2 * (kh + 6), w: kw, h: kh, title: 'Durante', value: `${plan.resumen.meses} meses`, icon: 'calendar' });

    // Tabla
    const debtsTitleY = sectionY + sectionH + 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor('#1B6DB0');
    doc.text('Detalle de deudas', PAGE.lm, debtsTitleY);
    const afterTableY = drawDebtTable(doc, debtsTitleY + 5, plan.deudas) + 5;

    // Notas + asesor
    const afterNotesY = drawNotes(doc, afterTableY + 2);
    drawAdvisor(doc, afterNotesY + 6, plan.asesor);

    const filename = opts?.filename || `Plan_de_Liquidacion_${(plan.header.nombre || 'cliente').toString().trim().replace(/\s+/g, '_')}.pdf`;
    if (opts?.returnBlob) return doc.output('blob');
    if (opts?.returnDataUri) return doc.output('datauristring');
    doc.save(filename);
    return true;
  }

  // Entrada alineada con el Simulador:
  async function generateFromSimulation(sim, opts = {}) {
    const plan = mapFromSimulation(sim);
    return generate(plan, opts);
  }

  return { generate, generateFromSimulation };
})();
