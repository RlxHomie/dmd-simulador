const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parsear el plan del body
    const plan = JSON.parse(event.body);
    
    // Validar datos requeridos
    if (!plan.referencia || !plan.cliente || !plan.deudas) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Datos incompletos' })
      };
    }

    // Inicializar Octokit con el token
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const path = `data/planes/${plan.referencia}.json`;
    
    // Convertir el plan a base64
    const content = Buffer.from(JSON.stringify(plan, null, 2)).toString('base64');
    
    // Crear el archivo en GitHub
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Nuevo plan: ${plan.cliente.nombre} - ${plan.referencia}`,
      content,
      branch: 'main'
    });

    // Actualizar el índice
    await updateIndex(octokit, owner, repo, plan);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        path: path,
        sha: response.data.content.sha
      })
    };

  } catch (error) {
    console.error('Error guardando plan:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error al guardar el plan',
        details: error.message
      })
    };
  }
};

async function updateIndex(octokit, owner, repo, newPlan) {
  try {
    // Obtener el índice actual
    const { data: indexFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'data/index.json'
    });

    // Decodificar y parsear
    const indexContent = JSON.parse(
      Buffer.from(indexFile.content, 'base64').toString('utf-8')
    );

    // Agregar el nuevo plan al índice
    indexContent.planes.unshift({
      referencia: newPlan.referencia,
      cliente: newPlan.cliente.nombre,
      dni: newPlan.cliente.dni,
      fecha: newPlan.fecha,
      totalImporte: newPlan.totalImporte,
      descuentoMedio: newPlan.descuentoMedio
    });

    // Limitar a los últimos 100 planes
    if (indexContent.planes.length > 100) {
      indexContent.planes = indexContent.planes.slice(0, 100);
    }

    // Actualizar metadatos
    indexContent.totalPlanes = indexContent.planes.length;
    indexContent.ultimaActualizacion = new Date().toISOString();

    // Guardar el índice actualizado
    const updatedContent = Buffer.from(
      JSON.stringify(indexContent, null, 2)
    ).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'data/index.json',
      message: `Actualizar índice: ${newPlan.referencia}`,
      content: updatedContent,
      sha: indexFile.sha,
      branch: 'main'
    });

  } catch (error) {
    console.error('Error actualizando índice:', error);
  }
}