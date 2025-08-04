let notificationContainer = null;

export function initNotifications() {
  notificationContainer = document.createElement('div');
  notificationContainer.className = 'notification-container';
  document.body.appendChild(notificationContainer);
}

export function showNotification(message, type = 'info', duration = 4000) {
  if (!notificationContainer) {
    initNotifications();
  }
  
  // Remove any existing notification
  const existing = notificationContainer.querySelector('.notification');
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const icons = {
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <circle cx="12" cy="12" r="10"></circle>
             <line x1="12" y1="16" x2="12" y2="12"></line>
             <line x1="12" y1="8" x2="12.01" y2="8"></line>
           </svg>`,
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>`
  };
  
  notification.innerHTML = `${icons[type]} <span>${message}</span>`;
  notificationContainer.appendChild(notification);
  
  // Auto-remove after duration
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
  
  return notification;
}

export function showConfirm(message, onConfirm, onCancel) {
  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.innerHTML = `
    <div class="confirm-content">
      <p>${message}</p>
      <div class="confirm-buttons">
        <button class="btn btn-secundario" id="confirm-cancel">Cancelar</button>
        <button class="btn btn-primario" id="confirm-ok">Aceptar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const handleCancel = () => {
    modal.remove();
    if (onCancel) onCancel();
  };
  
  const handleConfirm = () => {
    modal.remove();
    if (onConfirm) onConfirm();
  };
  
  modal.querySelector('#confirm-cancel').addEventListener('click', handleCancel);
  modal.querySelector('#confirm-ok').addEventListener('click', handleConfirm);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) handleCancel();
  });
}