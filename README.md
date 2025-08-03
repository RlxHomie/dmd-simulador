\# DMD Simulador v3.0



Simulador de Reestructuración de Deuda con integración OneDrive/Excel mediante Microsoft Graph.



\## 🚀 Nuevas Características v3.0



\- \*\*Integración OneDrive\*\*: Sincronización automática con archivos Excel en OneDrive

\- \*\*Estados Simplificados\*\*: Solo 3 estados (Plan Creado, Plan Contratado, Primer Pago)

\- \*\*Nueva columna\*\*: Antigüedad del Contrato en la tabla de deudas

\- \*\*TypeScript + Vite\*\*: Arquitectura moderna con tipado fuerte

\- \*\*Offline First\*\*: Funciona sin conexión con sincronización automática



\## 📋 Requisitos Previos



\- Node.js 18+

\- Cuenta de Microsoft/Azure AD

\- Cuenta de GitHub (para almacenamiento de respaldo)



\## 🔧 Configuración Azure AD



1\. \*\*Registrar aplicación en Azure Portal\*\*:

&nbsp;  - Ir a \[Azure Portal](https://portal.azure.com)

&nbsp;  - Azure Active Directory → App registrations → New registration

&nbsp;  - Nombre: `DMD Simulador`

&nbsp;  - Supported account types: `Accounts in any organizational directory and personal Microsoft accounts`

&nbsp;  - Redirect URI: 

&nbsp;    - Type: `Single-page application (SPA)`

&nbsp;    - URI: `http://localhost:5173` (desarrollo)

&nbsp;    - Agregar también tu dominio de producción



2\. \*\*Configurar permisos API\*\*:

&nbsp;  - API permissions → Add a permission → Microsoft Graph

&nbsp;  - Delegated permissions:

&nbsp;    - `Files.ReadWrite`

&nbsp;    - `offline\_access` 

&nbsp;    - `User.Read`

&nbsp;  - Grant admin consent (si es necesario)



3\. \*\*Copiar Application (client) ID\*\*:

&nbsp;  - Overview → Application (client) ID

&nbsp;  - Guardar este valor para `.env`



\## 🛠️ Instalación



```bash

\# Clonar repositorio

git clone https://github.com/RlxHomie/dmd-simulador.git

cd dmd-simulador



\# Instalar dependencias

npm install



\# Configurar variables de entorno

cp .env.example .env

\# Editar .env con tus valores

```



\## 🔑 Variables de Entorno



```env

\# Azure AD

VITE\_AZURE\_CLIENT\_ID=tu-client-id-aqui

VITE\_AZURE\_REDIRECT\_URI=http://localhost:5173



\# GitHub (para funciones Netlify)

GITHUB\_TOKEN=tu-github-token

GITHUB\_OWNER=tu-usuario-github

GITHUB\_REPO=nombre-del-repo

```



\## 🚀 Desarrollo



```bash

\# Iniciar servidor de desarrollo

npm run dev



\# Ejecutar tests

npm test



\# Verificar tipos

npm run typecheck



\# Build para producción

npm run build

```



\## 📁 Estructura del Proyecto



```

src/

├── services/

│   ├── graphService.ts      # Integración Microsoft Graph

│   ├── storageService.ts    # Gestión de almacenamiento local

│   └── uiService.ts         # Servicios de UI

├── components/

│   └── SimuladorTable.ts    # Componente de tabla mejorado

├── constants/

│   └── estados.ts           # Estados simplificados

├── app.ts                   # Aplicación principal

└── DMDApp.ts               # Lógica de negocio

```



\## 📊 Estructura Excel en OneDrive



El archivo Excel se almacena en: `/Simulador/plans.xlsx`



\### Hoja "Planes"

| Columna | Descripción |

|---------|-------------|

| A | Referencia |

| B | Cliente |

| C | DNI |

| D | Email |

| E | Fecha |

| F | Estado |

| G | Total Importe |

| H | Descuento Medio |

| I | Cuota Mensual |

| J | Ahorro |

| K | Última Actualización |



\## 🔄 Sincronización



\- \*\*Automática\*\*: Al conectarse/reconectarse

\- \*\*Manual\*\*: Botón "Sincronizar" en la barra de estado

\- \*\*Conflictos\*\*: Modal de resolución con comparación visual

\- \*\*Offline\*\*: Cambios guardados localmente y sincronizados al reconectar



\## 🏗️ Despliegue en Netlify



1\. Conectar repositorio GitHub a Netlify

2\. Configurar variables de entorno en Netlify

3\. Build settings:

&nbsp;  - Build command: `npm run build`

&nbsp;  - Publish directory: `dist`

4\. Agregar redirect URI de producción en Azure AD



\## 📝 Estados del Plan



Los nuevos estados simplificados son:



1\. \*\*PLAN\_CREADO\*\*: Estado inicial cuando se crea el plan

2\. \*\*PLAN\_CONTRATADO\*\*: Cliente ha aceptado y firmado

3\. \*\*PRIMER\_PAGO\*\*: Se ha realizado el primer pago



\## 🧪 Testing



```bash

\# Ejecutar todos los tests

npm test



\# Tests con UI

npm run test:ui



\# Tests en modo watch

npm test -- --watch

```



\## 🔐 Seguridad



\- Tokens almacenados de forma segura en localStorage

\- Autenticación mediante MSAL.js v2

\- Permisos mínimos necesarios en Graph API

\- Sin almacenamiento de credenciales



\## 🤝 Contribuir



1\. Fork el proyecto

2\. Crear rama feature (`git checkout -b feature/AmazingFeature`)

3\. Commit cambios (`git commit -m 'Add AmazingFeature'`)

4\. Push a la rama (`git push origin feature/AmazingFeature`)

5\. Abrir Pull Request



\## 📄 Licencia



Este proyecto está bajo licencia MIT. Ver `LICENSE` para más detalles.

