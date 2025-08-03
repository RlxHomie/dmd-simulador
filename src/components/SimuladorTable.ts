import { CONFIG } from '../config';
import { uiService } from '../services/uiService';

export interface DeudaRow {
  contrato: string;
  producto: string;
  entidad: string;
  antiguedad: string; // Nueva columna
  importe: number;
  descuento: number;
  importeConDescuento: number;
}

export class SimuladorTable {
  private tbody: HTMLTableSectionElement;
  private onUpdateCallback?: () => void;

  constructor(tbodyId: string) {
    const element = document.getElementById(tbodyId);
    if (!element || !(element instanceof HTMLTableSectionElement)) {
      throw new Error(`Table body with id ${tbodyId} not found`);
    }
    this.tbody = element;
  }

  onUpdate(callback: () => void): void {
    this.onUpdateCallback = callback;
  }

  agregarFilaDeuda(datos: Partial<DeudaRow> = {}): void {
    const fila = document.createElement('tr');
    
    fila.innerHTML = `
      <td>
        <input type="text" class="contrato" value="${datos.contrato || ''}" 
               placeholder="Opcional">
      </td>
      <td>
        <select class="producto" required>
          ${CONFIG.TIPOS_PRODUCTO.map(p => 
            `<option value="${p.tipo}" ${datos.producto === p.tipo ? 'selected' : ''}>${p.tipo}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <select class="entidad" required>
          ${CONFIG.ENTIDADES.map(e => 
            `<option value="${e}" ${datos.entidad === e ? 'selected' : ''}>${e}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <input type="date" class="antiguedad" value="${datos.antiguedad || ''}" 
               placeholder="dd/mm/aaaa">
      </td>
      <td>
        <input type="number" class="importe" min="0" step="0.01" 
               value="${datos.importe || ''}" placeholder="0,00" required>
      </td>
      <td>
        <input type="number" class="descuento" min="0" max="100" 
               value="${datos.descuento || ''}" placeholder="0" required>
      </td>
      <td class="importe-descuento text-right">0,00 €</td>
      <td>
        <button type="button" class="btn btn-icon btn-danger" title="Eliminar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;

    // Event listeners
    const inputs = fila.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.actualizarFila(fila));
      input.addEventListener('change', () => this.actualizarFila(fila));
    });

    const deleteBtn = fila.querySelector('.btn-danger');
    deleteBtn?.addEventListener('click', () => {
      if (this.tbody.children.length > 1) {
        fila.remove();
        this.actualizarTotales();
      } else {
        uiService.mostrarNotificacion('Debe mantener al menos una deuda', 'warning');
      }
    });

    this.tbody.appendChild(fila);
    this.actualizarFila(fila);
  }

  private actualizarFila(fila: HTMLTableRowElement): void {
    const productoElement = fila.querySelector('.producto') as HTMLSelectElement;
    const importeElement = fila.querySelector('.importe') as HTMLInputElement;
    const descuentoElement = fila.querySelector('.descuento') as HTMLInputElement;
    const importeDescuentoElement = fila.querySelector('.importe-descuento');
    
    if (!productoElement || !importeElement || !descuentoElement || !importeDescuentoElement) return;
    
    const producto = productoElement.value;
    const importe = parseFloat(importeElement.value) || 0;
    let descuento = parseFloat(descuentoElement.value) || 0;
    
    // Validar descuento máximo
    const tipoProducto = CONFIG.TIPOS_PRODUCTO.find(tp => tp.tipo === producto);
    const maxDescuento = tipoProducto ? tipoProducto.maxDescuento : 100;
    
    if (descuento > maxDescuento) {
      descuento = maxDescuento;
      descuentoElement.value = maxDescuento.toString();
      uiService.mostrarNotificacion(
        `Descuento máximo para ${producto}: ${maxDescuento}%`, 
        'warning'
      );
    }
    
    const importeConDescuento = importe * (1 - descuento / 100);
    importeDescuentoElement.textContent = this.formatearMoneda(importeConDescuento);
    
    this.actualizarTotales();
  }

  actualizarTotales(): void {
    const filas = this.tbody.querySelectorAll('tr');
    let totalImporte = 0;
    let totalImporteFinal = 0;
    
    filas.forEach(fila => {
      const importeElement = fila.querySelector('.importe') as HTMLInputElement;
      const descuentoElement = fila.querySelector('.descuento') as HTMLInputElement;
      
      if (importeElement && descuentoElement) {
        const importe = parseFloat(importeElement.value) || 0;
        const descuento = parseFloat(descuentoElement.value) || 0;
        const importeFinal = importe * (1 - descuento / 100);
        
        totalImporte += importe;
        totalImporteFinal += importeFinal;
      }
    });
    
    const descuentoMedio = totalImporte > 0 
      ? ((totalImporte - totalImporteFinal) / totalImporte) * 100 
      : 0;
    
    // Update totals in UI
    this.updateElement('totalImporte', this.formatearMoneda(totalImporte));
    this.updateElement('totalImporteFinal', this.formatearMoneda(totalImporteFinal));
    this.updateElement('totalDescuentoMedio', `${descuentoMedio.toFixed(1)}%`);
    this.updateElement('totalDeudasCount', `${filas.length} deuda${filas.length !== 1 ? 's' : ''}`);
    
    // Call update callback
    this.onUpdateCallback?.();
  }

  obtenerDeudas(): DeudaRow[] | null {
    const filas = this.tbody.querySelectorAll('tr');
    const deudas: DeudaRow[] = [];
    let hayErrores = false;

    filas.forEach((fila, index) => {
      const contratoElement = fila.querySelector('.contrato') as HTMLInputElement;
      const productoElement = fila.querySelector('.producto') as HTMLSelectElement;
      const entidadElement = fila.querySelector('.entidad') as HTMLSelectElement;
      const antiguedadElement = fila.querySelector('.antiguedad') as HTMLInputElement;
      const importeElement = fila.querySelector('.importe') as HTMLInputElement;
      const descuentoElement = fila.querySelector('.descuento') as HTMLInputElement;
      
      if (!productoElement || !entidadElement || !importeElement || !descuentoElement) {
        return; // Skip incomplete rows
      }
      
      const contrato = contratoElement?.value.trim() || '';
      const producto = productoElement.value;
      const entidad = entidadElement.value;
      const antiguedad = antiguedadElement?.value || '';
      const importe = parseFloat(importeElement.value) || 0;
      const descuento = parseFloat(descuentoElement.value) || 0;

      // No se requiere contrato obligatorio
      if (importe <= 0) {
        uiService.mostrarNotificacion(`El importe debe ser mayor que 0 en la fila ${index + 1}`, 'error');
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

  limpiar(): void {
    this.tbody.innerHTML = '';
  }

  private formatearMoneda(valor: number): string {
    return new Intl.NumberFormat("es-ES", CONFIG.FORMATO_MONEDA).format(valor);
  }

  private updateElement(id: string, value: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }