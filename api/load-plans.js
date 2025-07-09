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

    // Obtener el índice
    const { data: indexFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'data/index.json'
    });

    const indexContent = JSON.parse(
      Buffer.from(indexFile.content, 'base64').toString('utf-8')
    );

    // Obtener parámetros de búsqueda
    const { 
      search, 
      estado,
      limit = 50,
      detailed = 'false' 
    } = event.queryStringParameters || {};
    
    let planes = indexContent.planes || [];

    // Filtrar por búsqueda
    if (search) {
      planes = planes.filter(plan => 
        plan.cliente.toLowerCase().includes(search.toLowerCase()) ||
        plan.dni.toLowerCase().includes(search.toLowerCase()) ||
        plan.referencia.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Filtrar por estado
    if (estado && estado !== 'todos') {
      planes = planes.filter(plan => (plan.estado || 'simulado') === estado);
    }

    // Limitar resultados
    planes = planes.slice(0, parseInt(limit));

    // Si se solicita información detallada, cargar los archivos completos
    if (detailed === 'true' && planes.length <= 10) {
      const planesDetallados = await Promise.all(
        planes.map(async (plan) => {
          try {
            const { data: planFile } = await octokit.repos.getContent({
              owner,
              repo,
              path: `data/planes/${plan.referencia}.json`
            });
            
            return JSON.parse(
              Buffer.from(planFile.content, 'base64').toString('utf-8')
            );
          } catch (error) {
            // Si no se puede cargar el archivo, devolver la info del índice
            return plan;
          }
        })
      );
      
      planes = planesDetallados;
    }

    // Calcular estadísticas
    const estadisticas = {
      total: indexContent.totalPlanes || 0,
      porEstado: {}
    };

    // Contar planes por estado
    const estados = ['simulado', 'contratado', 'en_negociacion', 'aprobado', 'en_pago', 'completado', 'cancelado'];
    estados.forEach(est => {
      estadisticas.porEstado[est] = (indexContent.planes || []).filter(
        p => (p.estado || 'simulado') === est
      ).length;
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify({
        success: true,
        total: indexContent.totalPlanes,
        planes: planes,
        estadisticas,
        ultimaActualizacion: indexContent.ultimaActualizacion
      })
    };

  } catch (error) {
    console.error('Error cargando planes:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error al cargar planes',
        details: error.message
      })
    };
  }
};
