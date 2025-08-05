export class ChartCard {
  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.chart = null;
    this.cardDiv = null; // Initialize reference for chart container
  }
  
  render(data) {
    // Create card structure
    const cardDiv = document.createElement('div');
    cardDiv.className = 'chart-container';
    // Guarda referencia interna
    this.cardDiv = cardDiv;
    cardDiv.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-title">${this.config.title}</h3>
        ${this.config.showFilters ? this.renderFilters() : ''}
      </div>
      <canvas id="${this.config.id}" width="${this.config.width || 400}" height="${this.config.height || 200}"></canvas>
    `;
    
    this.container.appendChild(cardDiv);
    
    // Create chart
    const ctx = document.getElementById(this.config.id).getContext('2d');
    this.createChart(ctx, data);
    
    // Attach filter listeners if needed
    if (this.config.showFilters) {
      this.attachFilterListeners();
    }
  }
  
  renderFilters() {
    const filters = this.config.filters || [];
    return `
      <div class="chart-filters">
        ${filters.map(filter => `
          <button class="chart-filter ${filter.active ? 'active' : ''}"
                  data-filter="${filter.value}"
                  aria-pressed="${filter.active ? 'true' : 'false'}"
                  aria-label="Filtrar por ${filter.label}">
            ${filter.label}
          </button>
        `).join('')}
      </div>
    `;
  }
  
  createChart(ctx, data) {
    // Destroy existing chart if any
    if (this.chart) {
      this.chart.destroy();
    }
    
    // Default chart options
    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.config.showLegend !== false,
          position: this.config.legendPosition || 'top'
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        }
      },
      scales: this.getScalesConfig()
    };
    
    // Merge with custom options
    const options = {
      ...defaultOptions,
      ...(this.config.options || {})
    };
    
    // Create new chart
    this.chart = new Chart(ctx, {
      type: this.config.type || 'line',
      data: this.formatData(data),
      options: options
    });
  }
  
  getScalesConfig() {
    if (this.config.type === 'doughnut' || this.config.type === 'pie') {
      return {};
    }
    
    return {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: this.config.stepSize || undefined,
          callback: function(value) {
            if (this.config && this.config.formatY) {
              return this.config.formatY(value);
            }
            return value;
          }.bind(this)
        }
      },
      x: {
        ticks: {
          callback: function(value) {
            if (this.config && this.config.formatX) {
              return this.config.formatX(value);
            }
            return value;
          }.bind(this)
        }
      }
    };
  }
  
  formatData(data) {
    // If data is already formatted, return as is
    if (data.labels && data.datasets) {
      return data;
    }
    
    // Format based on chart type
    switch (this.config.type) {
      case 'line':
        return this.formatLineData(data);
      case 'bar':
        return this.formatBarData(data);
      case 'doughnut':
      case 'pie':
        return this.formatPieData(data);
      default:
        return data;
    }
  }
  
  formatLineData(data) {
    return {
      labels: data.labels || [],
      datasets: [{
        label: this.config.dataLabel || 'Data',
        data: data.values || [],
        borderColor: this.config.color || '#0071e3',
        backgroundColor: this.config.backgroundColor || 'rgba(0, 113, 227, 0.1)',
        borderWidth: this.config.borderWidth || 3,
        fill: this.config.fill !== false,
        tension: this.config.tension || 0.4
      }]
    };
  }
  
  formatBarData(data) {
    return {
      labels: data.labels || [],
      datasets: [{
        label: this.config.dataLabel || 'Data',
        data: data.values || [],
        backgroundColor: this.config.colors || '#0071e3',
        borderRadius: this.config.borderRadius || 6
      }]
    };
  }
  
  formatPieData(data) {
    return {
      labels: data.labels || [],
      datasets: [{
        data: data.values || [],
        backgroundColor: this.config.colors || [
          '#0071e3', '#34c759', '#ffcc00', '#ff3b30', '#af52de', '#ff9f0a'
        ],
        borderWidth: this.config.borderWidth || 2,
        borderColor: '#ffffff'
      }]
    };
  }
  
  attachFilterListeners() {
    const filterButtons = this.cardDiv.querySelectorAll('.chart-filter');
    filterButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        // Update active state
        filterButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        e.target.classList.add('active');
        e.target.setAttribute('aria-pressed', 'true');
        
        // Trigger filter callback
        if (this.config.onFilterChange) {
          const filterValue = e.target.dataset.filter;
          this.config.onFilterChange(filterValue, this);
        }
      });
    });
  }
  
  update(newData) {
    if (this.chart) {
      const formattedData = this.formatData(newData);
      this.chart.data = formattedData;
      this.chart.update();
    }
  }
  
  updateOptions(newOptions) {
    if (this.chart) {
      Object.assign(this.chart.options, newOptions);
      this.chart.update();
    }
  }
  
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
  
  // Utility methods for common updates
  updateLabels(labels) {
    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.update();
    }
  }
  
  updateDataset(datasetIndex, newData) {
    if (this.chart && this.chart.data.datasets[datasetIndex]) {
      this.chart.data.datasets[datasetIndex].data = newData;
      this.chart.update();
    }
  }
  
  addData(label, data) {
    if (this.chart) {
      this.chart.data.labels.push(label);
      this.chart.data.datasets.forEach((dataset, index) => {
        dataset.data.push(Array.isArray(data) ? data[index] : data);
      });
      this.chart.update();
    }
  }
  
  removeData() {
    if (this.chart) {
      this.chart.data.labels.pop();
      this.chart.data.datasets.forEach(dataset => {
        dataset.data.pop();
      });
      this.chart.update();
    }
  }
  
  // Get chart instance for advanced operations
  getChart() {
    return this.chart;
  }
  
  // Export chart as image
  exportAsImage() {
    if (this.chart) {
      const canvas = this.chart.canvas;
      return canvas.toDataURL('image/png');
    }
    return null;
  }
  
  // Static factory methods for common chart types
  static createEvolutionChart(container, data) {
    return new ChartCard(container, {
      id: 'chart-evolution',
      type: 'line',
      title: 'Evolución Mensual',
      dataLabel: 'Planes Creados',
      showFilters: true,
      filters: [
        { label: '6 Meses', value: '6m', active: true },
        { label: '12 Meses', value: '12m' },
        { label: 'Año Actual', value: 'ytd' }
      ],
      color: '#0071e3',
      fill: true,
      tension: 0.4
    });
  }
  
  static createDistributionChart(container, data) {
    return new ChartCard(container, {
      id: 'chart-distribution',
      type: 'doughnut',
      title: 'Distribución por Tipo',
      showLegend: true,
      legendPosition: 'bottom'
    });
  }
  
  static createFunnelChart(container, data) {
    return new ChartCard(container, {
      id: 'chart-funnel',
      type: 'bar',
      title: 'Funnel de Conversión',
      dataLabel: 'Cantidad',
      colors: ['#ffcc00', '#0071e3', '#34c759'],
      borderRadius: 6,
      showLegend: false
    });
  }
}