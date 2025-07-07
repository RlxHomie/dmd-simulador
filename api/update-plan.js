const { Octokit } = require("@octokit/rest");

exports.handler = async (event, context) => {
  // Solo aceptar PUT
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parsear el plan actualizado
    const plan = JSON.parse(event.body);
    
    // Validar datos requeridos
    if (!plan.referencia) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Referencia del plan requerida' })
      };
    }

    // Inicializar Octokit
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const path = `data/planes/${plan.referencia}.json`;
    
    // Obtener el archivo actual para conseguir el SHA
    let sha;
    try {
      const { data: currentFile } = await octokit.repos.getContent({
        owner,
        repo,
        path
      });
      sha = currentFile.sha;
    } catch (error) {
      // Si el archivo no existe, lo creamos
      console.log('Archivo no encontrado, creando nuevo...');
    }

    // Actualizar el archivo
    const content = Buffer.from(JSON.stringify(plan, null, 2)).toString('base64');
    
    const updateParams = {
      owner,
      repo,
      path,
      message: `Actualizar plan ${plan.referencia}: ${plan.estado || 'modificado'}`,
      content,
      branch: 'main'
    };

    // Solo incluir SHA si estamos actualizando
    if (sha) {
      updateParams.sha = sha;
    }

    const response = await octokit.repos.createOrUpdateFileContents(updateParams);

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
    console.error('Error actualizando plan:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Error al actualizar el plan',
        details: error.message
      })
    };
  }
};

async function updateIndex(octokit, owner, repo, updatedPlan) {
  try {
    // Obtener el índice actual
    const { data: indexFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'data/index.json'
    });

    const indexContent = JSON.parse(
      Buffer.from(indexFile.content, 'base64').toString('utf-8')
    );

    // Buscar y actualizar el plan en el índice
    const planIndex = indexContent.planes.findIndex(p => p.referencia === updatedPlan.referencia);
    
    if (planIndex >= 0) {
      // Actualizar plan existente
      indexContent.planes[planIndex] = {
        referencia: updatedPlan.referencia,
        cliente: {
          nombre: updatedPlan.cliente.nombre,
          dni: updatedPlan.cliente.dni
        },
        fecha: updatedPlan.fecha,
        totalImporte: updatedPlan.totalImporte,
        descuentoMedio: updatedPlan.descuentoMedio,
        numCuotas: updatedPlan.numCuotas,
        cuotaMensual: updatedPlan.cuotaMensual,
        estado: updatedPlan.estado,
        ultimaActualizacion: new Date().toISOString()
      };
    } else {
      // Si no existe, agregarlo
      indexContent.planes.unshift({
        referencia: updatedPlan.referencia,
        cliente: {
          nombre: updatedPlan.cliente.nombre,
          dni: updatedPlan.cliente.dni
        },
        fecha: updatedPlan.fecha,
        totalImporte: updatedPlan.totalImporte,
        descuentoMedio: updatedPlan.descuentoMedio,
        numCuotas: updatedPlan.numCuotas,
        cuotaMensual: updatedPlan.cuotaMensual,
        estado: updatedPlan.estado,
        ultimaActualizacion: new Date().toISOString()
      });
    }

    // Actualizar metadatos
    indexContent.ultimaActualizacion = new Date().toISOString();

    // Guardar el índice actualizado
    const updatedContent = Buffer.from(
      JSON.stringify(indexContent, null, 2)
    ).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'data/index.json',
      message: `Actualizar índice: ${updatedPlan.referencia} - ${updatedPlan.estado}`,
      content: updatedContent,
      sha: indexFile.sha,
      branch: 'main'
    });

    console.log('Índice actualizado correctamente');

  } catch (error) {
    console.error('Error actualizando índice:', error);
    // No fallar si no se puede actualizar el índice
  }
}
