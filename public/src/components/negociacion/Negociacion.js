// /src/components/negociacion/Negociacion.js
import { excelApi } from '../../utils/excelApi.js';
import { showNotification } from '../../utils/notifications.js';

// Exportamos nombrado y por defecto para evitar problemas con el import dinámico
export class Negociacion {
  constructor(container) {
    this.container = container;
    this.clientes = []; // [{ nombre, apellidos, dni }]
    this.deudas = [];   // [{ entidad, producto, numeroCredito, importeDeuda, estado }]
    this._listenersBound = false;
    this._stylesInjected = false;
  }

  // ============ PUBLIC ============
  async render() {
    this._injectStyles();

    this.container.innerHTML = `
      <div class="neg-wrap">
        <div class="neg-header">
          <h2>Módulo de Negociación</h2>
          <div class="neg-actions">
            <button id="btnNegRecargar" class="btn btn-light">Recargar datos</button>
          </div>
        </div>

        <div class="neg-grid">
          <!-- CLIENTES -->
          <section class="neg-card">
            <div class="neg-card-head">
              <h3>Clientes (Entradas)</h3>
              <div class="neg-right">
                <input id="filtroClientes" class="neg-input" type="text" placeholder="Filtrar por nombre, apellidos o DNI" />
                <span class="neg-pill" id="countClientes">0</span>
              </div>
            </div>
            <div class="neg-table-wrap">
              <table id="tablaClientes" class="neg-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Apellidos</th>
                    <th>DNI</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </section>

          <!-- DEUDAS -->
          <section class="neg-card">
            <div class="neg-card-head">
              <h3>Deudas (Planes)</h3>
              <div class="neg-right">
                <input id="filtroDeudas" class="neg-input" type="text" placeholder="Filtrar por entidad, producto o Nº crédito" />
                <span class="neg-pill" id="countDeudas">0</span>
              </div>
            </div>
            <div class="neg-table-wrap">
              <table id="tablaDeudas" class="neg-table">
                <thead>
                  <tr>
                    <th>Entidad</th>
                    <th>Producto</th>
                    <th>Nº Crédito</th>
                    <th class="neg-right">Importe Deuda</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    `;

    try {
      await this._cargarDatos();
      this._pintarClientes(this.clientes);
      this._pintarDeudas(this.deudas);
      this._bindEvents();
      showNotification('Datos de negociación cargados', 'success');
    } catch (err) {
      console.error('[Negociacion] Error al cargar:', err);
      showNotification('No se pudieron cargar los datos de negociación', 'error');
    }

    // Exponer la instancia para handlers inline (si los usas)
    window.negociacion = this;
  }

  // Llamado desde app.js en la sincronización
  async refresh() {
    try {
      await this._cargarDatos();
      this._pintarClientes(this.clientes);
      this._pintarDeudas(this.deudas);
    } catch (e) {
      console.error('[Negociacion] refresh error:', e);
      showNotification('No se pudo refrescar Negociación', 'error');
    }
  }

  destroy() {
    this.container.innerHTML = '';
    // (Si necesitas, podrías desregistrar eventos aquí)
  }

  // ============ DATA ============
  async _cargarDatos() {
    // 1) CLIENTES desde ENTRADAS
    const entradas = await excelApi.getEntradas();
    // entradas: [{fecha, cliente, dni, deudaOriginal, deudaFinal, estado}]

    const porDni = new Map();
    for (const e of entradas) {
      const dni = this._norm(e?.dni);
      if (!dni) continue;

      const { nombre, apellidos } = this._splitNombreApellidos(e?.cliente);
      const prev = porDni.get(dni) || { nombre: '', apellidos: '' };

      porDni.set(dni, {
        dni,
        nombre: nombre || prev.nombre,
        apellidos: apellidos || prev.apellidos
      });
    }

    this.clientes = Array.from(porDni.values())
      .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es') || a.nombre.localeCompare(b.nombre, 'es'));

    // 2) DEUDAS desde PLANES
    // planes: [{ referencia, fecha, estado, deudas:[{ contrato, producto, entidad, antiguedad, importeOriginal, descuento, importeFinal }] }]
    const planes = await excelApi.getPlanes();
    const tmp = [];

    for (const p of planes) {
      const estadoPlan = this._norm(p?.estado);
      for (const d of (p?.deudas || [])) {
        tmp.push({
          entidad: this._norm(d?.entidad),
          producto: this._norm(d?.producto),
          numeroCredito: this._norm(d?.contrato),              // Nº Crédito ← Contrato
          importeDeuda: Number(d?.importeOriginal || 0),       // Importe Deuda ← ImporteOriginal
          estado: estadoPlan
        });
      }
    }

    // Opcional: colapsar duplicados por Nº Crédito + Entidad + Producto
    const seen = new Map();
    for (const r of tmp) {
      const key = `${r.numeroCredito}||${r.entidad}||${r.producto}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    this.deudas = Array.from(seen.values());
  }

  // ============ RENDER HELPERS ============
  _pintarClientes(rows) {
    const tbody = this.container.querySelector('#tablaClientes tbody');
    const count = this.container.querySelector('#countClientes');
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${this._esc(r.nombre)}</td>
        <td>${this._esc(r.apellidos)}</td>
        <td>${this._esc(r.dni)}</td>
      </tr>
    `).join('');
    if (count) count.textContent = String(rows.length);
  }

  _pintarDeudas(rows) {
    const tbody = this.container.querySelector('#tablaDeudas tbody');
    const count = this.container.querySelector('#countDeudas');
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${this._esc(r.entidad)}</td>
        <td>${this._esc(r.producto)}</td>
        <td>${this._esc(r.numeroCredito)}</td>
        <td class="neg-right">${this._formatEUR(r.importeDeuda)}</td>
        <td>${this._esc(r.estado)}</td>
      </tr>
    `).join('');
    if (count) count.textContent = String(rows.length);
  }

  // ============ EVENTS / FILTROS ============
  _bindEvents() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    const iCli = this.container.querySelector('#filtroClientes');
    const iDeu = this.container.querySelector('#filtroDeudas');
    const btnReload = this.container.querySelector('#btnNegRecargar');

    iCli?.addEventListener('input', () => {
      const q = this._norm(iCli.value).toLowerCase();
      const filtered = !q ? this.clientes : this.clientes.filter(c =>
        (c.nombre + ' ' + c.apellidos + ' ' + c.dni).toLowerCase().includes(q)
      );
      this._pintarClientes(filtered);
    });

    iDeu?.addEventListener('input', () => {
      const q = this._norm(iDeu.value).toLowerCase();
      const filtered = !q ? this.deudas : this.deudas.filter(d =>
        (d.entidad + ' ' + d.producto + ' ' + d.numeroCredito).toLowerCase().includes(q)
      );
      this._pintarDeudas(filtered);
    });

    btnReload?.addEventListener('click', async () => {
      try {
        btnReload.disabled = true;
        await this._cargarDatos();
        // Resetea filtros
        if (iCli) iCli.value = '';
        if (iDeu) iDeu.value = '';
        this._pintarClientes(this.clientes);
        this._pintarDeudas(this.deudas);
        showNotification('Datos recargados', 'success');
      } catch (e) {
        console.error('[Negociacion] Recargar error:', e);
        showNotification('Error al recargar datos', 'error');
      } finally {
        btnReload.disabled = false;
      }
    });
  }

  // ============ UTILS ============
  _norm(s) {
    return String(s ?? '').trim();
  }

  _esc(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  _formatEUR(n) {
    const val = Number(n ?? 0);
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  _titleCase(s) {
    return this._norm(s)
      .toLowerCase()
      .replace(/\b([\p{L}\p{M}]+)/gu, m => m.charAt(0).toUpperCase() + m.slice(1));
  }

  _splitNombreApellidos(cliente) {
    const txt = this._norm(cliente);
    if (!txt) return { nombre: '', apellidos: '' };
    const parts = txt.split(/\s+/);
    if (parts.length === 1) return { nombre: this._titleCase(parts[0]), apellidos: '' };
    // Heurística simple: primer token → nombre; resto → apellidos.
    const nombre = this._titleCase(parts[0]);
    const apellidos = this._titleCase(parts.slice(1).join(' '));
    return { nombre, apellidos };
  }

  _injectStyles() {
    if (this._stylesInjected) return;
    this._stylesInjected = true;
    const css = `
      .neg-wrap { padding: 16px; }
      .neg-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
      .neg-actions .btn { padding:8px 12px; border-radius:10px; border:1px solid var(--border, #333); background:var(--btn-bg, #1f1f1f); color: var(--fg, #eaeaea); cursor:pointer; }
      .neg-actions .btn:hover { filter: brightness(1.08); }
      .neg-grid { display:grid; grid-template-columns: 1fr 1.4fr; gap:16px; }
      .neg-card { background: var(--card-bg, rgba(255,255,255,0.04)); border:1px solid var(--border, #2a2a2a); border-radius: 14px; padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
      .neg-card-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
      .neg-right { display:flex; align-items:center; gap:10px; }
      .neg-pill { background: rgba(255,255,255,0.08); padding: 4px 10px; border-radius: 999px; font-weight:600; border: 1px solid var(--border, #2a2a2a); }
      .neg-table-wrap { max-height: 58vh; overflow:auto; border:1px solid var(--border, #2a2a2a); border-radius: 10px; }
      .neg-table { width:100%; border-collapse: collapse; font-size: 14px; }
      .neg-table thead th { position: sticky; top:0; background: var(--thead-bg, #111); text-align:left; padding: 10px; border-bottom:1px solid var(--border, #2a2a2a); z-index:1; }
      .neg-table tbody td { padding: 10px; border-bottom:1px solid var(--border, #2a2a2a); }
      .neg-table tbody tr:hover { background: rgba(255,255,255,0.04); }
      .neg-input { padding: 7px 10px; border: 1px solid var(--border, #2a2a2a); border-radius: 10px; background: var(--input-bg, #0f0f0f); color: var(--fg, #eaeaea); width: 52%; }
      .neg-right { text-align: right; }
      @media (max-width: 1100px) {
        .neg-grid { grid-template-columns: 1fr; }
        .neg-input { width: 60%; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'negociacion-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
}

// Export por defecto también
export default Negociacion;
