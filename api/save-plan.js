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
    
    // Verificar si el archivo ya existe para obtener el SHA
    let sha;
    try {
      const { data: existingFile } = await octokit.repos.getContent({
        owner,
        repo,
        path
      });
      sha = existingFile.sha;
    } catch (error) {
      // El archivo no existe, lo cual está bien para crear uno nuevo
      sha = undefined;
    }
    
    // Convertir el plan a base64
    const content = Buffer.from(JSON.stringify(plan, null, 2)).toString('base64');
    
    // Crear o actualizar el archivo en GitHub
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `${sha ? 'Actualizar' : 'Nuevo'} plan: ${plan.cliente.nombre} - ${plan.referencia}`,
      content,
      sha, // Incluir SHA si existe para actualización
      branch: 'main'
    });

    // Actualizar el índice
    await updateIndex(octokit, owner, repo, plan, !sha);

    // Actualizar analytics
    await updateAnalytics(octokit, owner, repo, plan);

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

async function updateIndex(octokit, owner, repo, newPlan, isNew) {
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

    if (isNew) {
      // Agregar el nuevo plan al índice
      indexContent.planes.unshift({
        referencia: newPlan.referencia,
        cliente: newPlan.cliente.nombre,
        dni: newPlan.cliente.dni,
        fecha: newPlan.fecha,
        estado: newPlan.estado || 'simulado',
        totalImporte: newPlan.totalImporte,
        descuentoMedio: newPlan.descuentoMedio,
        cuotaMensual: newPlan.cuotaMensual,
        ahorro: newPlan.ahorro
      });

      // Limitar a los últimos 100 planes
      if (indexContent.planes.length > 100) {
        indexContent.planes = indexContent.planes.slice(0, 100);
      }
    } else {
      // Actualizar plan existente
      const planIndex = indexContent.planes.findIndex(p => p.referencia === newPlan.referencia);
      if (planIndex >= 0) {
        indexContent.planes[planIndex] = {
          ...indexContent.planes[planIndex],
          estado: newPlan.estado || 'simulado',
          ultimaActualizacion: new Date().toISOString()
        };
      }
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

async function updateAnalytics(octokit, owner, repo, plan) {
  try {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const analyticsPath = `data/analytics/${año}-${String(mes).padStart(2, '0')}.json`;
    
    let analytics;
    let sha;
    
    try {
      // Intentar obtener analytics del mes actual
      const { data: analyticsFile } = await octokit.repos.getContent({
        owner,
        repo,
        path: analyticsPath
      });
      
      analytics = JSON.parse(
        Buffer.from(analyticsFile.content, 'base64').toString('utf-8')
      );
      sha = analyticsFile.sha;
    } catch (error) {
      // No existe, crear nuevo
      analytics = {
        año,
        mes,
        planesCreados: 0,
        planesContratados: 0,
        ahorroTotal: 0,
        comisionesTotal: 0,
        clientesUnicos: new Set(),
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
    }
    
    // Actualizar métricas
    analytics.planesCreados++;
    
    if (plan.estado === 'contratado' || plan.estado === 'en_pago' || plan.estado === 'completado') {
      analytics.planesContratados++;
      analytics.ahorroTotal = (analytics.ahorroTotal || 0) + (plan.ahorro || 0);
      if (plan.comisiones) {
        analytics.comisionesTotal = (analytics.comisionesTotal || 0) + (plan.comisiones.total || 0);
      }
    }
    
    // Actualizar conteo por estado
    const estado = plan.estado || 'simulado';
    analytics.porEstado[estado] = (analytics.porEstado[estado] || 0) + 1;
    
    // Convertir Set a Array para JSON
    if (analytics.clientesUnicos instanceof Set) {
      analytics.clientesUnicos = Array.from(analytics.clientesUnicos);
    }
    if (!analytics.clientesUnicos.includes(plan.cliente.dni)) {
      analytics.clientesUnicos.push(plan.cliente.dni);
    }
    
    // Actualizar por tipo de producto
    plan.deudas.forEach(deuda => {
      analytics.porTipoProducto[deuda.producto] = (analytics.porTipoProducto[deuda.producto] || 0) + 1;
      analytics.porEntidad[deuda.entidad] = (analytics.porEntidad[deuda.entidad] || 0) + 1;
    });
    
    // Guardar analytics
    const analyticsContent = Buffer.from(
      JSON.stringify(analytics, null, 2)
    ).toString('base64');
    
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: analyticsPath,
      message: `Actualizar analytics ${año}-${String(mes).padStart(2, '0')}`,
      content: analyticsContent,
      sha,
      branch: 'main'
    });
    
  } catch (error) {
    console.error('Error actualizando analytics:', error);
  }
}
