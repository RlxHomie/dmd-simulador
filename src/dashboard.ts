/**
 * Dashboard-related functionality for rendering KPIs and charts.
 * Separated from app.js to improve modularity and maintainability.
 * @module dashboard
 */

/**
 * Utility function to format currency values.
 * @param {number} value - The value to format.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(value) {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '€';
}

/**
 * Filters plans by month and year.
 * @param {Array} plans - Array of plans.
 * @param {number} month - Month to filter (0-11).
 * @param {number} year - Year to filter.
 * @returns {Array} Filtered plans.
 */
function filterPlansByMonth(plans, month, year) {
  return plans.filter(plan => {
    const fechaPlan = new Date(plan.fecha);
    return fechaPlan.getMonth() === month && fechaPlan.getFullYear() === year;
  });
}

/**
 * Updates the dashboard with KPIs and charts.
 * @param {Object} storage - StorageManager instance for data access.
 */
function actualizarDashboard(storage) {
  const planesConfirmados = storage.getPlans('planesConfirmados');
  const fechaActual = new Date();
  const mesActual = fechaActual.getMonth();
  const añoActual = fechaActual.getFullYear();
  const fechaMesAnterior = new Date(fechaActual);
  fechaMesAnterior.setMonth(mesActual - 1);

  // Filter plans for current and previous month
  const planesMesActual = filterPlansByMonth(planesConfirmados, mesActual, añoActual);
  const planesMesAnterior = filterPlansByMonth(planesConfirmados, fechaMesAnterior.getMonth(), fechaMesAnterior.getFullYear());

  // KPI: Planes Creados
  const totalPlanes = planesMesActual.length;
  const cambioPlanes = planesMesAnterior.length > 0
    ? ((totalPlanes - planesMesAnterior.length) / planesMesAnterior.length * 100).toFixed(1)
    : totalPlanes > 0 ? 100 : 0;

  document.getElementById('kpiPlanesCreados').textContent = totalPlanes;
  const kpiPlanesCambioContainer = document.getElementById('kpiPlanesCambioContainer');
  kpiPlanesCambioContainer.className = `kpi-change ${cambioPlanes >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('kpiPlanesCambio').textContent = `${cambioPlanes >= 0 ? '+' : ''}${cambioPlanes}% este mes`;

  // KPI: Tasa de Conversión
  const planesContratados = planesMesActual.filter(p => p.estado === 'plan_contratado' || p.estado === 'primer_pago').length;
  const tasaConversion = totalPlanes > 0 ? (planesContratados / totalPlanes * 100).toFixed(1) : 0;
  const planesContratadosMesAnterior = planesMesAnterior.filter(p => p.estado === 'plan_contratado' || p.estado === 'primer_pago').length;
  const tasaConversionAnterior = planesMesAnterior.length > 0 ? (planesContratadosMesAnterior / planesMesAnterior.length * 100) : 0;
  const cambioConversion = tasaConversionAnterior > 0
    ? ((tasaConversion - tasaConversionAnterior) / tasaConversionAnterior * 100).toFixed(1)
    : tasaConversion > 0 ? 100 : 0;

  document.getElementById('kpiConversion').textContent = `${tasaConversion}%`;
  const kpiConversionCambioContainer = document.getElementById('kpiConversionCambioContainer');
  kpiConversionCambioContainer.className = `kpi-change ${cambioConversion >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('kpiConversionCambio').textContent = `${cambioConversion >= 0 ? '+' : ''}${cambioConversion}% vs mes anterior`;

  // KPI: Ahorro Total Generado
  const ahorroTotal = planesMesActual.reduce((total, plan) => total + (plan.ahorro || 0), 0);
  const ahorroMesAnterior = planesMesAnterior.reduce((total, plan) => total + (plan.ahorro || 0), 0);
  const cambioAhorro = ahorroMesAnterior > 0
    ? ((ahorroTotal - ahorroMesAnterior) / ahorroMesAnterior * 100).toFixed(1)
    : ahorroTotal > 0 ? 100 : 0;

  document.getElementById('kpiAhorro').textContent = formatCurrency(ahorroTotal);
  const kpiAhorroCambioContainer = document.getElementById('kpiAhorroCambioContainer');
  kpiAhorroCambioContainer.className = `kpi-change ${cambioAhorro >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('kpiAhorroCambio').textContent = `${cambioAhorro >= 0 ? '+' : ''}${cambioAhorro}% este mes`;

  // KPI: Comisiones Acumuladas
  const comisionesTotales = planesMesActual.reduce((total, plan) => {
    if (plan.deudaFinal && plan.ahorro) {
      const comisionBase = plan.deudaFinal * 0.15;
      const comisionExito = plan.ahorro * 0.25;
      return total + comisionBase + comisionExito;
    }
    return total;
  }, 0);
  const comisionesMesAnterior = planesMesAnterior.reduce((total, plan) => {
    if (plan.deudaFinal && plan.ahorro) {
      const comisionBase = plan.deudaFinal * 0.15;
      const comisionExito = plan.ahorro * 0.25;
      return total + comisionBase + comisionExito;
    }
    return total;
  }, 0);
  const cambioComisiones = comisionesMesAnterior > 0
    ? ((comisionesTotales - comisionesMesAnterior) / comisionesMesAnterior * 100).toFixed(1)
    : comisionesTotales > 0 ? 100 : 0;

  document.getElementById('kpiComisiones').textContent = formatCurrency(comisionesTotales);
  const kpiComisionesCambioContainer = document.getElementById('kpiComisionesCambioContainer');
  kpiComisionesCambioContainer.className = `kpi-change ${cambioComisiones >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('kpiComisionesCambio').textContent = `${cambioComisiones >= 0 ? '+' : ''}${cambioComisiones}% este mes`;

  // Update charts
  actualizarGraficos(planesConfirmados);
}

/**
 * Updates all dashboard charts.
 * @param {Array} planes - Array of plans.
 */
function actualizarGraficos(planes) {
  actualizarGraficoEvolucion(planes);
  actualizarGraficoDistribucion(planes);
  actualizarGraficoFunnel(planes);
}

/**
 * Updates the monthly evolution chart.
 * @param {Array} planes - Array of plans.
 */
function actualizarGraficoEvolucion(planes) {
  const canvas = document.getElementById('chartEvolucion');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (window.chartEvolucion) {
    window.chartEvolucion.destroy();
  }

  const fechaActual = new Date();
  const meses = [];
  const datos = [];

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(fechaActual);
    fecha.setMonth(fecha.getMonth() - i);
    const mes = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    meses.push(mes);

    const planesDelMes = filterPlansByMonth(planes, fecha.getMonth(), fecha.getFullYear()).length;
    datos.push(planesDelMes);
  }

  try {
    window.chartEvolucion = new Chart(ctx, {
      type: 'line',
      data: {
        labels: meses,
        datasets: [{
          label: 'Planes Creados',
          data: datos,
          borderColor: '#0071e3',
          backgroundColor: 'rgba(0, 113, 227, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  } catch (error) {
    console.error('Error rendering evolution chart:', error);
  }
}

/**
 * Updates the debt type distribution chart.
 * @param {Array} planes - Array of plans.
 */
function actualizarGraficoDistribucion(planes) {
  const canvas = document.getElementById('chartDistribucion');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (window.chartDistribucion) {
    window.chartDistribucion.destroy();
  }

  const tiposDeuda = {};
  planes.forEach(plan => {
    if (plan.deudas) {
      plan.deudas.forEach(deuda => {
        const tipo = deuda.producto || 'Sin especificar';
        tiposDeuda[tipo] = (tiposDeuda[tipo] || 0) + 1;
      });
    }
  });

  const labels = Object.keys(tiposDeuda);
  const datos = Object.values(tiposDeuda);
  const colores = ['#0071e3', '#34c759', '#ffcc00', '#ff3b30', '#af52de', '#ff9f0a'];

  try {
    window.chartDistribucion = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: datos,
          backgroundColor: colores.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  } catch (error) {
    console.error('Error rendering distribution chart:', error);
  }
}

/**
 * Updates the conversion funnel chart.
 * @param {Array} planes - Array of plans.
 */
function actualizarGraficoFunnel(planes) {
  const canvas = document.getElementById('chartFunnel');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (window.chartFunnel) {
    window.chartFunnel.destroy();
  }

  const planesCreados = planes.filter(p => p.estado === 'plan_creado').length;
  const planesContratados = planes.filter(p => p.estado === 'plan_contratado').length;
  const planesPagados = planes.filter(p => p.estado === 'primer_pago').length;

  try {
    window.chartFunnel = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Simulados', 'Contratados', 'Primer Pago'],
        datasets: [{
          label: 'Cantidad',
          data: [planesCreados, planesContratados, planesPagados],
          backgroundColor: ['#ffcc00', '#0071e3', '#34c759'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  } catch (error) {
    console.error('Error rendering funnel chart:', error);
  }
}

export { actualizarDashboard, actualizarGraficos };