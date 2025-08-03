import { CONFIG } from '../config';
import { uiService } from '../services/uiService';

/**
 * Registro de una deuda introducida en la tabla.
 */
export interface DeudaRow {
  contrato: string;
  producto: string;
  entidad: string;
  antiguedad: string;          // Fecha en formato ISO (yyyy-mm-dd)
  importe: number;             // Importe original
  descuento: number;           // Descuento aplicado [%]
  importeConDescuento: number; // Importe resultante
}

/**
 * Gestiona la tabla interactiva de deudas / descuentos.
 */
export class SimuladorTable {
  private readonly tbody: HTMLTableSectionElement;
  private onUpdateCallback?: () => void;

  constructor(tbodyId: string) {
    const element = document.getElementById(tbodyId);
    if (!element || !(element instanceof HTMLTableSectionElement)) {
      throw new Error(`Table body with id "${tbodyId}" not found`);
    }
    this.tbody = element;
  }

  /**
   * Registra un callback que se ejecutará cada vez que se recalculen totales.
   */
  onUpdate(callback: () => void): void {
    this.onUpdateCallback = callback;
  }

  /**
   * Añade una fila nueva (o precargada) a la tabla de deudas.
   */
  agregarFilaDeuda(datos: Partial<DeudaRow> = {}): void {
    const fila = document.createElement('tr');

    fila.innerHTML = `
      <td>
        <input type="text" class="contrato" value="${datos.contrato ?? ''}"
               placeholder="Opcional">
      </td>
      <td>
        <select class="producto" required>
          ${CONFIG.TIPOS_PRODUCTO.map(
            p =>
              `<option value="${p.tipo}" ${
                datos.producto === p.tipo ? 'selected' : ''
              }>${p.tipo}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <select class="entidad" required>
          ${CONFIG.ENTIDADES.map(
            e =>
              `<option value="${e}" ${
                datos.entidad === e ? 'selected' : ''
              }>${e}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <input type="date" class="antiguedad"
               value="${datos.antiguedad ?? ''}" placeholder="dd/mm/aaaa">
      </td>
      <td>
        <input type="number" class="importe" min="0" step="0.01"
               value="${datos.importe ?? ''}" placeholder="0,00" required>
      </td>
      <td>
        <input type="number" class="descuento" min="0" max="100"
               value="${datos.descuento ?? ''}" placeholder="0" required>
      </td>
      <td class="importe-descuento text-right">0,00 €</td>
      <td>
        <button type="button" class="btn btn-icon btn-danger" title="Eliminar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;

    // Eventos de entrada para recalcular la fila
    fila.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(input => {
      input.addEventListener('input', () => this.actualizarFila(fila));
      input.addEventListener('change', () => this.actualizarFila(fila));
    });

    // Botón de borrado
    fila.querySelector<HTMLButtonElement>('.btn-danger')?.addEventListener('click', () => {
      if (this.tbody.children.length > 1) {
        fila.remove();
        this.actualizarTotales();
      } else {
        uiService.mostrarNotificacion('Debe mantener al menos una deuda', 'warning');
      }
    });

    this.tbody.appendChild(fila);
    this.actualizarFila(fila); // Calcula importe descuento inicial
  }

  /**
   * Recalcula los importes de una fila y actualiza los totales globales.
   */
  private actualizarFila(fila: HTMLTableRowElement): void {
    const productoElement   = fila.querySelector<HTMLSelectElement>('.producto');
    const importeElement    = fila.querySelector<HTMLInputElement>('.importe');
    const descuentoElement  = fila.querySelector<HTMLInputElement>('.descuento');
    const importeDescTd     = fila.querySelector<HTMLElement>('.importe-descuento');

    if (!productoElement || !importeElement || !descuentoElement || !importeDescTd) return;

    const producto  = productoElement.value;
    const importe   = parseFloat(importeElement.value) || 0;
    let  descuento  = parseFloat(descuentoElement.value) || 0;

    // Valida descuento máximo por tipo de producto
    const tipoProd       = CONFIG.TIPOS_PRODUCTO.find(t => t.tipo === producto);
    const maxDescuento   = tipoProd ? tipoProd.maxDescuento : 100;

    if (descuento > maxDescuento) {
      descuento = maxDescuento;
      descuentoElement.value = maxDescuento.toString();
      uiService.mostrarNotificacion(
        `Descuento máximo para ${producto}: ${maxDescuento}%`,
        'warning'
      );
    }

    const importeConDescuento = importe * (1 - descuento / 100);
    importeDescTd.textContent = this.formatearMoneda(importeConDescuento);

    this.actualizarTotales();
  }

  /**
   * Recorre todas las filas para calcular importes totales y descuento medio.
   */
  actualizarTotales(): void {
    const filas = Array.from(this.tbody.querySelectorAll<HTMLTableRowElement>('tr'));

    let totalImporte = 0;
    let totalFinal   = 0;

    filas.forEach(fila => {
      const importe   = parseFloat((fila.querySelector<HTMLInputElement>('.importe')?.value ?? '0')) || 0;
      const descuento = parseFloat((fila.querySelector<HTMLInputElement>('.descuento')?.value ?? '0')) || 0;

      totalImporte += importe;
      totalFinal   += importe * (1 - descuento / 100);
    });

    const descuentoMedio = totalImporte > 0
      ? ((totalImporte - totalFinal) / totalImporte) * 100
      : 0;

    this.updateElement('totalImporte',        this.formatearMoneda(totalImporte));
    this.updateElement('totalImporteFinal',   this.formatearMoneda(totalFinal));
    this.updateElement('totalDescuentoMedio', `${descuentoMedio.toFixed(1)}%`);
    this.updateElement('totalDeudasCount',    `${filas.length} deuda${filas.length !== 1 ? 's' : ''}`);

    this.onUpdateCallback?.();
  }

  /**
   * Devuelve las deudas en un array validado o `null` si hay errores de entrada.
   */
  obtenerDeudas(): DeudaRow[] | null {
    const filas     = Array.from(this.tbody.querySelectorAll<HTMLTableRowElement>('tr'));
    const deudas: DeudaRow[] = [];
    let   hayErrores = false;

    filas.forEach((fila, idx) => {
      const contrato    = (fila.querySelector<HTMLInputElement>('.contrato')?.value ?? '').trim();
      const productoSel = fila.querySelector<HTMLSelectElement>('.producto');
      const entidadSel  = fila.querySelector<HTMLSelectElement>('.entidad');
      const antiguedad  = fila.querySelector<HTMLInputElement>('.antiguedad')?.value ?? '';
      const importeStr  = fila.querySelector<HTMLInputElement>('.importe')?.value ?? '';
      const descStr     = fila.querySelector<HTMLInputElement>('.descuento')?.value ?? '';

      if (!productoSel || !entidadSel) return; // Fila incompleta

      const producto  = productoSel.value;
      const entidad   = entidadSel.value;
      const importe   = parseFloat(importeStr) || 0;
      const descuento = parseFloat(descStr)   || 0;

      if (importe <= 0) {
        uiService.mostrarNotificacion(
          `El importe debe ser mayor que 0 en la fila ${idx + 1}`,
          'error'
        );
        hayErrores = true;
        return;
      }

      deudas.push({
        contrato,
        producto,
        entidad,
        antiguedad,
        importe,
        descuento,
        importeConDescuento: importe * (1 - descuento / 100)
      });
    });

    return hayErrores ? null : deudas;
  }

  /**
   * Elimina todas las filas existentes en la tabla.
   */
  limpiar(): void {
    this.tbody.innerHTML = '';
    this.actualizarTotales();
  }

  // ───────────────────────── helpers ────────────────────────────

  /** Formatea un número como moneda según la configuración global. */
  private formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-ES', CONFIG.FORMATO_MONEDA).format(valor);
  }

  /** Escribe el texto `value` en el elemento con `id` dado, si existe. */
  private updateElement(id: string, value: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
} // ← LLAVE QUE CERRABA LA CLASE
