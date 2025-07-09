const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
  // Solo aceptar GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    
    // Obtener parámetros de consulta
    const { periodo = '6m' } = event.queryStringParameters || {};
    
    // Calcular rango de fechas
    const ahora = new Date();
    let mesesAtras = 6;
    
    switch(periodo) {
      case '1m': mesesAtras = 1; break;
      case '3m': mesesAtras = 3; break;
      case '6m': mesesAtras = 6; break;
      case '12m': mesesAtras = 12; break;
      case 'ytd': mesesAtras = ahora.getMonth() + 1; break;
    }
    
    const analytics = {
      periodo,
      meses: [],
      totales: {
        planesCreados: 0,
        planesContratados: 0,
        ahorroTotal: 0,
        comisionesTotal: 0,
        clientesUnicos: new Set(),
        tasaConversion: 0
      },
      porTipoProducto: {},
      porEntidad: {},
      porEstado: {
        simulado: 0,
        contratado: 0,
        en_negociacion: 0,
        aprobado: 0,
        en_pago: 0,
        completado: 0,
        cancelado: 0
      }
    };
    
    // Recopilar datos de cada mes
    for (let i = 0; i < mesesAtras; i++) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const año = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;
      const analyticsPath = `data/analytics/${año}-${String(mes).padStart(2, '0')}.json`;
      
      try {
        const { data: monthFile } = await octokit.repos.getContent({
          owner,
          repo,
          path: analyticsPath
        });
        
        const monthData = JSON.parse(
          Buffer.from(monthFile.content, 'base64').toString('utf-8')
        );
        
        // Agregar a los meses
        analytics.meses.unshift({
          año,
          mes,
          label: fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
          ...monthData
        });
        
        // Sumar a totales
        analytics.totales.planesCreados += monthData.planesCreados || 0;
        analytics.totales.planesContratados += monthData.planesContratados || 0;
        analytics.totales.ahorroTotal += monthData.ahorroTotal || 0;
        analytics.totales.comisionesTotal += monthData.comisionesTotal || 0;
        
        // Agregar clientes únicos
        if (monthData.clientesUnicos) {
          monthData.clientesUnicos.forEach(dni => analytics.totales.clientesUnicos.add(dni));
        }
        
        // Sumar por tipo de producto
        Object.entries(monthData.porTipoProducto || {}).forEach(([tipo, count]) => {
          analytics.porTipoProducto[tipo] = (analytics.porTipoProducto[tipo] || 0) + count;
        });
        
        // Sumar por entidad
        Object.entries(monthData.porEntidad || {}).forEach(([entidad, count]) => {
          analytics.porEntidad[entidad] = (analytics.porEntidad[entidad] || 0) + count;
        });
        
        // Sumar por estado
        Object.entries(monthData.porEstado || {}).forEach(([estado, count]) => {
          analytics.porEstado[estado] = (analytics.porEstado[estado] || 0) + count;
        });
        
      } catch (error) {
        // No hay datos para este mes, continuar
        analytics.meses.unshift({
          año,
          mes,
          label: fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
          planesCreados: 0,
          planesContratados: 0,
          ahorroTotal: 0,
          comisionesTotal: 0,
          clientesUnicos: []
        });
      }
    }
    
    // Calcular tasa de conversión
    if (analytics.totales.planesCreados > 0) {
      analytics.totales.tasaConversion = (analytics.totales.planesContratados / analytics.totales.planesCreados) * 100;
    }
    
    // Convertir Set a número para clientes únicos
    analytics.totales.clientesUnicos = analytics.totales.clientesUnicos.size;
    
    // Calcular cambios vs mes anterior
    if (analytics.meses.length >= 2) {
      const mesActual = analytics.meses[analytics.meses.length - 1];
      const mesAnterior = analytics.meses[analytics.meses.length - 2];
      
      analytics.cambios = {
        planesCreados: calcularCambio(mesActual.planesCreados, mesAnterior.planesCreados),
        planesContratados: calcularCambio(mesActual.planesContratados, mesAnterior.planesContratados),
        ahorroTotal: calcularCambio(mesActual.ahorroTotal, mesAnterior.ahorroTotal),
        comisionesTotal: calcularCambio(mesActual.comisionesTotal, mesAnterior.comisionesTotal)
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // Cache por 5 minutos
      },
      body: JSON.stringify({
        success: true,
        analytics,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error cargando analytics:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error al cargar analytics',
        details: error.message
      })
    };
  }
};

function calcularCambio(valorActual, valorAnterior) {
  if (!valorAnterior || valorAnterior === 0) return 0;
  return ((valorActual - valorAnterior) / valorAnterior) * 100;
}