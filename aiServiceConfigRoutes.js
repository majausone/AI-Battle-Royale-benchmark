import {
    getAIServices,
    createAIService,
    updateAIService,
    deleteAIService,
    checkServiceDependencies
} from './database.js';

const handleAsyncRoute = (fn) => async (req, res) => {
    try {
        const result = await fn(req, res);
        if (result) {
            res.json(result);
        }
    } catch (error) {
        console.error('Error en ruta:', error.message, error.stack);
        res.status(500).json({
            error: error.message || 'Error interno del servidor',
            details: error.toString(),
            stack: error.stack
        });
    }
};

export function setupRouteConfig2AIService(app) {
    app.post('/api/config2/ai-service/update', handleAsyncRoute(async (req) => {
        const service = req.body;

        try {
            if (service.service_id) {
                const hasDependencies = await checkServiceDependencies(service.service_id);
                if (hasDependencies) {
                    return {
                        success: false,
                        error: 'No se puede modificar el servicio porque ya tiene partidas asociadas',
                        serviceId: service.service_id
                    };
                }
                
                await updateAIService(
                    service.service_id,
                    service.name,
                    service.type,
                    service.endpoint,
                    service.apiKey,
                    service.model,
                    service.isActive,
                    service.thinking || false,
                    service.reasoning || false,
                    service.mirror || false
                );
                return { success: true, service_id: service.service_id };
            } else {
                const result = await createAIService(
                    service.name,
                    service.type,
                    service.endpoint,
                    service.apiKey,
                    service.model,
                    service.isActive,
                    service.thinking || false,
                    service.reasoning || false,
                    service.mirror || false
                );
                return { success: true, service_id: result.service_id };
            }
        } catch (error) {
            console.error('Error updating AI service:', error);
            throw error;
        }
    }));

    app.post('/api/config2/ai-service/delete', handleAsyncRoute(async (req) => {
        const { service_id } = req.body;

        try {
            if (!service_id) {
                throw new Error('Service ID is required');
            }

            await deleteAIService(service_id);
            return { success: true, deleted: service_id };
        } catch (error) {
            console.error('Error deleting AI service:', error);
            throw error;
        }
    }));

    app.get('/api/config2/ai-service/check-dependencies/:serviceId', handleAsyncRoute(async (req) => {
        const serviceId = parseInt(req.params.serviceId);

        if (isNaN(serviceId)) {
            throw new Error('ID de servicio inválido');
        }

        try {
            const hasDependencies = await checkServiceDependencies(serviceId);
            return { hasDependencies };
        } catch (error) {
            console.error('Error checking service dependencies:', error);
            throw error;
        }
    }));
}