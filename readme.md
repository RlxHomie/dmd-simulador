# DMD Asesores – Sistema de Reestructuración de Deuda

![Logo DMD Asesores](public/logo.png)

> **SPA** colaborativa para simular, contratar y hacer seguimiento de planes de reestructuración de deuda, con sincronización en la nube mediante **Azure** y autenticación corporativa Microsoft.

---

## ✨ Características principales

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | KPI s en tiempo real (planes creados, conversión, ahorros, comisiones) y gráfica con Chart.js. |
| **Simulador** | Alta de cliente, carga de deudas, cálculo de descuentos, comisiones y cuotas mensuales. Guarda borradores localmente y planes definitivos en el almacén síncrono. |
| **Seguimiento** | Filtros avanzados, badges de estado, timeline de eventos y modal de detalle con historia completa del plan. |
| **Notificaciones** | Toasts accesibles y modales de confirmación reutilizables. |
| **Estado Offline** | Sincronización diferida con Azure Storage y contador de pendientes. |
| **Accesibilidad (a11y)** | Focus‑visible, atajos de teclado (Enter / Space) y etiquetas ARIA. |

## 📂 Estructura del proyecto

```
src/
 ├─ app.js             # Punto de entrada principal
 ├─ components/        # UI desacoplados (Dashboard, Simulador, Seguimiento…)
 ├─ utils/             # auth.js, storage.js, notifications.js, excelApi.js, config.js
 ├─ assets/            # icons.js, imágenes y logos
 └─ styles/            # main.css (versión dev + prod minificada)
public/
 └─ logo.png
package.json
.gitignore
README.md (este archivo)
```

## 🚀 Puesta en marcha

```bash
# Instala las dependencias
npm install

# Servidor en vivo (puerto por defecto 5000)
npm start

# Modo desarrollo en el puerto 3000
npm run dev
```

El proyecto usa **serve** como servidor estático (no requiere build). Si migra a Vite/Rollup, los directorios `dist/` o `build/` ya están ignorados en `.gitignore`.

### Variables de entorno

```
AZURE_STORAGE_KEY=*****
AZURE_STORAGE_CONTAINER=dmd-planes
MSAL_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MSAL_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> **Importante:** Estos valores **no** deben versionarse. `.gitignore` ya excluye los archivos `.env*`.

## 🔧 Scripts disponibles

| Comando | Acción |
|---------|--------|
| `npm start` | Lanza la SPA en modo producción. |
| `npm run dev` | Lanza la SPA en modo dev en `localhost:3000`. |

## 🗄️ Servicios auxiliares

- **Azure Blob Storage** – Persistencia y sincronización de planes (`storageService`).  
- **MSAL Browser** – Login corporativo Microsoft (`authService`).  
- **Chart.js 4** – Gráficos del Dashboard.

## 🖌️ Guía de estilo

- **Design Tokens** y variables CSS centralizados en `:root`.  
- Sistema de componentes puro CSS ⇒ sin frameworks pesados.  
- Animaciones keyframes (`fadeIn`, `modalSlideUp`, `spin`).

## ♿ Accesibilidad

- Controles con `role`, `aria‑label` y `tabindex`.  
- Visibilidad de foco (`:focus-visible`).  
- Operación completa vía teclado.

## 🧪 Tests

Actualmente no se incluyen tests automatizados. Se recomienda integrar **Vitest/Jest** y añadir la carpeta `coverage/` al `.gitignore`.

## 🤝 Contribución

1. *Fork* y crea tu rama: `git checkout -b feature/mi-mejora`  
2. Realiza *commit* de tus cambios: `git commit -m "feat: añade …"`  
3. Empuja la rama: `git push origin feature/mi-mejora`  
4. Abre un *Pull Request*.

> Sigue las convenciones **Conventional Commits**.

## 📝 Licencia

Proyecto publicado bajo licencia **MIT**. Consulta `LICENSE` para más información.

---

<div align="center">Hecho con ❤ por el equipo de **DMD Asesores**</div>

