export async function testConnection(service) {
    try {
        const response = await fetch('/api/ai/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(service)
        });

        if (!response.ok) {
            const errorData = await response.json();
            showErrorPopup(service.type, errorData.error || 'Error de conexión desconocido');
            return false;
        }

        return true;
    } catch (error) {
        showErrorPopup(service.type, error.message || 'Error de conexión desconocido');
        return false;
    }
}

export async function sendPrompt(service, prompt) {
    try {
        let requestBody = {
            service,
            prompt
        };
        
        const response = await fetch('/api/ai/prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

function showErrorPopup(serviceType, errorMessage) {
    if (!document.getElementById('error-popup-styles')) {
        const style = document.createElement('style');
        style.id = 'error-popup-styles';
        style.textContent = `
            .error-popup {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            .error-popup-content {
                background-color: #2a2a2a;
                border-radius: 8px;
                padding: 20px;
                width: 500px;
                max-width: 90%;
                border-left: 4px solid #d32f2f;
            }
            .error-popup-content h3 {
                color: #d32f2f;
                margin-top: 0;
            }
            .error-popup-content p {
                color: #fff;
                margin-bottom: 20px;
            }
            .close-error-btn {
                padding: 8px 16px;
                background: #444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                float: right;
            }
            .close-error-btn:hover {
                background: #555;
            }
        `;
        document.head.appendChild(style);
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-popup';
    errorDiv.innerHTML = `
        <div class="error-popup-content">
            <h3>Error de Conexión: ${serviceType}</h3>
            <p>${errorMessage}</p>
            <button class="close-error-btn">Cerrar</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    const closeBtn = errorDiv.querySelector('.close-error-btn');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(errorDiv);
    });
}