export class PopupManager {
    constructor() {
        this.popup = null;
        this.init();
    }

    init() {
        if (document.getElementById('global-popup')) {
            return;
        }

        const popupStyles = document.createElement('style');
        popupStyles.textContent = `
            #global-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.7);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            #global-popup-overlay.active {
                opacity: 1;
            }
            
            #global-popup {
                background-color: #2a2a2a;
                border-radius: 8px;
                padding: 20px;
                width: 400px;
                max-width: 90%;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
                transform: translateY(-20px);
                transition: transform 0.3s ease;
            }
            
            #global-popup-overlay.active #global-popup {
                transform: translateY(0);
            }
            
            #global-popup.error {
                border-left: 4px solid #FF5555;
            }
            
            #global-popup.warning {
                border-left: 4px solid #FFAA00;
            }
            
            #global-popup.info {
                border-left: 4px solid #4CAF50;
            }
            
            #global-popup-title {
                color: #fff;
                margin-top: 0;
                margin-bottom: 15px;
                font-size: 20px;
            }
            
            #global-popup.error #global-popup-title {
                color: #FF5555;
            }
            
            #global-popup.warning #global-popup-title {
                color: #FFAA00;
            }
            
            #global-popup.info #global-popup-title {
                color: #4CAF50;
            }
            
            #global-popup-message {
                color: #fff;
                margin-bottom: 20px;
            }
            
            #global-popup-buttons {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .global-popup-button {
                padding: 8px 16px;
                border-radius: 4px;
                background-color: #444;
                color: #fff;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .global-popup-button:hover {
                background-color: #555;
            }
            
            .global-popup-button.primary {
                background-color: #4CAF50;
            }
            
            .global-popup-button.primary:hover {
                background-color: #45a049;
            }
            
            .global-popup-button.danger {
                background-color: #FF5555;
            }
            
            .global-popup-button.danger:hover {
                background-color: #e04949;
            }
            
            .global-popup-button.warning {
                background-color: #FFAA00;
            }
            
            .global-popup-button.warning:hover {
                background-color: #e69900;
            }
        `;
        document.head.appendChild(popupStyles);

        const overlay = document.createElement('div');
        overlay.id = 'global-popup-overlay';
        
        const popup = document.createElement('div');
        popup.id = 'global-popup';
        
        const title = document.createElement('h3');
        title.id = 'global-popup-title';
        
        const message = document.createElement('div');
        message.id = 'global-popup-message';
        
        const buttons = document.createElement('div');
        buttons.id = 'global-popup-buttons';
        
        popup.appendChild(title);
        popup.appendChild(message);
        popup.appendChild(buttons);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        
        this.popup = popup;
        this.overlay = overlay;
    }

    show(options = {}) {
        const { 
            title = 'Mensaje', 
            message = '', 
            type = 'info',
            buttons = [
                { text: 'Aceptar', type: 'primary', action: () => this.hide() }
            ]
        } = options;
        
        if (!this.popup) {
            this.init();
        }

        const titleElement = document.getElementById('global-popup-title');
        const messageElement = document.getElementById('global-popup-message');
        const buttonsElement = document.getElementById('global-popup-buttons');
        
        titleElement.textContent = title;
        messageElement.innerHTML = message;
        
        this.popup.className = type;
        this.popup.classList.add('global-popup');
        
        buttonsElement.innerHTML = '';
        buttons.forEach(button => {
            const buttonElement = document.createElement('button');
            buttonElement.textContent = button.text;
            buttonElement.className = `global-popup-button ${button.type || ''}`;
            
            buttonElement.addEventListener('click', () => {
                if (typeof button.action === 'function') {
                    button.action();
                }
            });
            
            buttonsElement.appendChild(buttonElement);
        });
        
        this.overlay.style.display = 'flex';
        setTimeout(() => {
            this.overlay.classList.add('active');
        }, 10);
        
        return new Promise(resolve => {
            this.resolvePromise = resolve;
        });
    }

    hide(result) {
        if (!this.overlay) return;
        
        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.style.display = 'none';
            if (this.resolvePromise) {
                this.resolvePromise(result);
                this.resolvePromise = null;
            }
        }, 300);
    }

    showError(message, title = 'Error') {
        return this.show({
            title,
            message,
            type: 'error',
            buttons: [
                { text: 'Aceptar', type: 'primary', action: () => this.hide() }
            ]
        });
    }

    showWarning(message, title = 'Advertencia') {
        return this.show({
            title,
            message,
            type: 'warning',
            buttons: [
                { text: 'Aceptar', type: 'primary', action: () => this.hide() }
            ]
        });
    }

    showConfirm(message, title = 'Confirmar') {
        return this.show({
            title,
            message,
            type: 'info',
            buttons: [
                { 
                    text: 'Cancelar', 
                    action: () => this.hide(false) 
                },
                { 
                    text: 'Aceptar', 
                    type: 'primary', 
                    action: () => this.hide(true) 
                }
            ]
        });
    }
}

export const popupManager = new PopupManager();