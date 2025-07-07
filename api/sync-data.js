const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
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

    // Obtener todos los archivos de configuración
    const configFiles = await Promise.all([
      octokit.repos.getContent({ owner, repo, path: 'config/entidades.json' }),
      octokit.repos.getContent({ owner, repo, path: 'config/productos.json' }),
      octokit.repos.getContent({ owner, repo, path: 'config/configuracion.json' })
    ]);

    // Decodificar y parsear
    const configs = configFiles.map(file => JSON.parse(
      Buffer.from(file.data.content, 'base64').toString('utf-8')
    ));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          entidades: configs[0],
          productos: configs[1],
          configuracion: configs[2]
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error sincronizando:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error al sincronizar',
        details: error.message
      })
    };
  }
};
