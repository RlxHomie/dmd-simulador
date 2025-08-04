export class KPIGrid {
  constructor(container) {
    this.container = container;
  }
  
  async update(planes) {
    const kpis = this.calculateKPIs(planes);
    this.render(kpis);
  }
  
  calculateKPIs(planes) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Filter current month plans
    const currentMonthPlans = planes.filter(plan => {
      if (!plan.fecha || isNaN(new Date(plan.fecha))) return false;
      const planDate = new Date(plan.fecha);
      return planDate.getMonth() === currentMonth && planDate.getFullYear() === currentYear;
    });
    
    // Previous month
    const prevDate = new Date(currentDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthPlans = planes.filter(plan => {
      if (!plan.fecha || isNaN(new Date(plan.fecha))) return false;
      const planDate = new Date(plan.fecha);
      return planDate.getMonth() === prevDate.getMonth() && planDate.getFullYear() === prevDate.getFullYear();
    });
    
    // KPIs calculation
    const totalPlans = currentMonthPlans.length;
    const prevTotalPlans = prevMonthPlans.length;
    const plansChange = prevTotalPlans > 0 ? 
      ((totalPlans - prevTotalPlans) / prevTotalPlans * 100) : 
      (totalPlans > 0 ? 100 : 0);
    
    // Conversion rate
    const contracted = currentMonthPlans.filter(p => 
      p.estado === 'plan_contratado' || p.estado === 'primer_pago'
    ).length;
    const conversionRate = totalPlans > 0 ? (contracted / totalPlans * 100) : 0;
    
    const prevContracted = prevMonthPlans.filter(p => 
      p.estado === 'plan_contratado' || p.estado === 'primer_pago'
    ).length;
    const prevConversionRate = prevMonthPlans.length > 0 ? 
      (prevContracted / prevMonthPlans.length * 100) : 0;
    const conversionChange = prevConversionRate > 0 ? 
      ((conversionRate - prevConversionRate) / prevConversionRate * 100) : 
      (conversionRate > 0 ? 100 : 0);
    
    // Total savings
    const totalSavings = currentMonthPlans.reduce((sum, plan) => 
      sum + (plan.ahorro || 0), 0
    );
    const prevSavings = prevMonthPlans.reduce((sum, plan) => 
      sum + (plan.ahorro || 0), 0
    );
    const savingsChange = prevSavings > 0 ? 
      ((totalSavings - prevSavings) / prevSavings * 100) : 
      (totalSavings > 0 ? 100 : 0);
    
    // Commissions
    const totalCommissions = currentMonthPlans.reduce((sum, plan) => {
      if (plan.deudaFinal && plan.ahorro) {
        const baseCommission = plan.deudaFinal * 0.15;
        const successCommission = plan.ahorro * 0.25;
        return sum + baseCommission + successCommission;
      }
      return sum;
    }, 0);
    
    const prevCommissions = prevMonthPlans.reduce((sum, plan) => {
      if (plan.deudaFinal && plan.ahorro) {
        const baseCommission = plan.deudaFinal * 0.15;
        const successCommission = plan.ahorro * 0.25;
        return sum + baseCommission + successCommission;
      }
      return sum;
    }, 0);
    
    const commissionsChange = prevCommissions > 0 ? 
      ((totalCommissions - prevCommissions) / prevCommissions * 100) : 
      (totalCommissions > 0 ? 100 : 0);
    
    return {
      totalPlans,
      plansChange,
      conversionRate,
      conversionChange,
      totalSavings,
      savingsChange,
      totalCommissions,
      commissionsChange
    };
  }
  
  render(kpis) {
    this.container.innerHTML = `
      <div class="kpi-grid">
        ${this.createKPICard('Planes Creados', kpis.totalPlans, `${kpis.plansChange >= 0 ? '+' : ''}${kpis.plansChange.toFixed(1)}% este mes`, 'primary', this.getPlanIcon())}
        ${this.createKPICard('Tasa de Conversión', `${kpis.conversionRate.toFixed(1)}%`, `${kpis.conversionChange >= 0 ? '+' : ''}${kpis.conversionChange.toFixed(1)}% vs mes anterior`, 'success', this.getConversionIcon())}
        ${this.createKPICard('Ahorro Total Generado', `${kpis.totalSavings.toLocaleString('es-ES', {minimumFractionDigits: 0})}€`, `${kpis.savingsChange >= 0 ? '+' : ''}${kpis.savingsChange.toFixed(1)}% este mes`, 'warning', this.getSavingsIcon())}
        ${this.createKPICard('Comisiones Acumuladas', `${kpis.totalCommissions.toLocaleString('es-ES', {minimumFractionDigits: 0})}€`, `${kpis.commissionsChange >= 0 ? '+' : ''}${kpis.commissionsChange.toFixed(1)}% este mes`, 'primary', this.getCommissionIcon())}
      </div>
    `;
  }
  
  createKPICard(title, value, change, color, icon) {
    const isPositive = change.startsWith('+');
    const changeClass = isPositive ? 'positive' : 'negative';
    
    return `
      <div class="kpi-card">
        <div class="kpi-header">
          <div class="kpi-title">${title}</div>
          <div class="kpi-icon" style="background: var(--${color});">
            ${icon}
          </div>
        </div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-change ${changeClass}">
          ${this.getTrendIcon(isPositive)}
          <span>${change}</span>
        </div>
      </div>
    `;
  }
  
  getPlanIcon() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Ícono de planes creados">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    </svg>`;
  }
  
  getConversionIcon() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Ícono de tasa de conversión">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>`;
  }
  
  getSavingsIcon() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Ícono de ahorro total">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>`;
  }
  
  getCommissionIcon() {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-label="Ícono de comisiones acumuladas">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>`;
  }
  
  getTrendIcon(isPositive) {
    return isPositive ? 
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Ícono de tendencia positiva">
        <polyline points="23 6 17 12 13 12 8 17 1 17"></polyline>
        <polyline points="17 6 23 6 23 12"></polyline>
      </svg>` :
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Ícono de tendencia negativa">
        <polyline points="23 18 17 12 13 12 8 7 1 7"></polyline>
        <polyline points="17 18 23 18 23 12"></polyline>
      </svg>`;
  }
}