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

    // Si hay parámetros de búsqueda, filtrar
    const { search, limit = 50 } = event.queryStringParameters || {};
    let planes = indexContent.planes || [];

    if (search) {
      planes = planes.filter(plan => 
        plan.cliente.toLowerCase().includes(search.toLowerCase()) ||
        plan.dni.toLowerCase().includes(search.toLowerCase()) ||
        plan.referencia.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Limitar resultados
    planes = planes.slice(0, parseInt(limit));

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