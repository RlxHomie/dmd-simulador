import { storageService } from '../utils/storage.js';
import { KPIGrid } from './KPIGrid.js';
import { ChartCard } from './ChartCard.js';

export class Dashboard {
  constructor(container) {
    this.container = container;
    this.charts = {};
  }
  
  async render() {
    this.container.innerHTML = `
      <div class="dashboard-container active">
        <div id="kpi-container"></div>
        
        <div class="chart-container">
          <div class="chart-header">
            <h3 class="chart-title">Evolución Mensual de Planes</h3>
            <div class="chart-filters">
              <button class="chart-filter active" data-period="6m">6 Meses</button>
              <button class="chart-filter" data-period="12m">12 Meses</button>
              <button class="chart-filter" data-period="ytd">Año Actual</button>
            </div>
          </div>
          <canvas id="chartEvolucion" width="400" height="200"></canvas>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="chart-container">
            <div class="chart-header">
              <h3 class="chart-title">Distribución por Tipo de Deuda</h3>
            </div>
            <canvas id="chartDistribucion" width="200" height="200"></canvas>
          </div>
          
          <div class="chart-container">
            <div class="chart-header">
              <h3 class="chart-title">Funnel de Conversión</h3>
            </div>
            <canvas id="chartFunnel" width="200" height="200"></canvas>
          </div>
        </div>
      </div>
    `;
    
    // Initialize components
    const kpiContainer = this.container.querySelector('#kpi-container');
    this.kpiGrid = new KPIGrid(kpiContainer);
    
    // Add event listeners
    this.attachEventListeners();
    
    // Load data
    await this.refresh();
  }
  
  async refresh() {
    const planes = await storageService.getPlans();
    
    // Update KPIs
    await this.kpiGrid.update(planes);
    
    // Update charts
    this.updateCharts(planes);
  }
  
  updateCharts(planes) {
    // Evolución mensual
    this.updateEvolutionChart(planes);
    
    // Distribución por tipo
    this.updateDistributionChart(planes);
    
    // Funnel de conversión
    this.updateFunnelChart(planes);
  }
  
  updateEvolutionChart(planes) {
    const canvas = document.getElementById('chartEvolucion');
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (this.charts.evolution) {
      this.charts.evolution.destroy();
    }
    
    // Prepare data
    const monthsData = this.getMonthlyData(planes, 6);
    
    this.charts.evolution = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthsData.labels,
        datasets: [{
          label: 'Planes Creados',
          data: monthsData.data,
          borderColor: '#0071e3',
          backgroundColor: 'rgba(0, 113, 227, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
  
  updateDistributionChart(planes) {
    const canvas = document.getElementById('chartDistribucion');
    const ctx = canvas.getContext('2d');
    
    if (this.charts.distribution) {
      this.charts.distribution.destroy();
    }
    
    // Count debt types
    const debtTypes = {};
    planes.forEach(plan => {
      if (plan.deudas) {
        plan.deudas.forEach(deuda => {
          const tipo = deuda.producto || 'Sin especificar';
          debtTypes[tipo] = (debtTypes[tipo] || 0) + 1;
        });
      }
    });
    
    const labels = Object.keys(debtTypes);
    const data = Object.values(debtTypes);
    const colors = ['#0071e3', '#34c759', '#ffcc00', '#ff3b30', '#af52de', '#ff9f0a'];
    
    this.charts.distribution = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }
  
  updateFunnelChart(planes) {
    const canvas = document.getElementById('chartFunnel');
    const ctx = canvas.getContext('2d');
    
    if (this.charts.funnel) {
      this.charts.funnel.destroy();
    }
    
    // Filtrar planes con estado definido
    const validPlanes = planes.filter(p => p.estado && p.estado !== '');
    
    const created = validPlanes.filter(p => p.estado === 'plan_creado').length;
    const contracted = validPlanes.filter(p => p.estado === 'plan_contratado').length;
    const paid = validPlanes.filter(p => p.estado === 'primer_pago').length;
    
    // Verificar si todos los conteos son cero
    const allZero = created === 0 && contracted === 0 && paid === 0;
    
    this.charts.funnel = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Simulados', 'Contratados', 'Primer Pago'],
        datasets: [{
          label: 'Cantidad',
          data: [created, contracted, paid],
          backgroundColor: ['#ffcc00', '#0071e3', '#34c759'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            callbacks: {
              title: (tooltipItems) => {
                return allZero ? 'Sin datos' : undefined;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
  
  getMonthlyData(planes, months) {
    const labels = [];
    const data = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      
      const monthName = date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      labels.push(monthName);
      
      const monthPlans = planes.filter(plan => {
        if (!plan.fecha) return false; // Ignorar planes sin fecha
        const planDate = new Date(plan.fecha);
        return planDate.getMonth() === date.getMonth() && 
               planDate.getFullYear() === date.getFullYear();
      }).length;
      
      data.push(monthPlans);
    }
    
    return { labels, data };
  }
  
  attachEventListeners() {
    // Period filter buttons
    const filterButtons = this.container.querySelectorAll('.chart-filter');
    filterButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        filterButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const period = e.target.dataset.period;
        const planes = await storageService.getPlans();
        
        // Update evolution chart based on period
        const months = period === '6m' ? 6 : period === '12m' ? 12 : 12;
        const monthsData = this.getMonthlyData(planes, months);
        
        this.charts.evolution.data.labels = monthsData.labels;
        this.charts.evolution.data.datasets[0].data = monthsData.data;
        this.charts.evolution.update();
      });
    });
  }
  
  destroy() {
    // Destroy all charts
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
  }
}