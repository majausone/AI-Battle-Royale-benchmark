import {
    getAIServices,
    createAIService,
    updateAIService,
    deleteAIService
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

export function setupRouteConfig2AIServices(app) {
    app.post('/api/config2/ai-services', handleAsyncRoute(async (req) => {
        const services = req.body;
        const updatedServices = [];

        try {
            const existingServices = await getAIServices();
            const existingServiceIds = existingServices.map(s => s.service_id);
            const receivedServiceIds = services.map(s => s.service_id).filter(Boolean);

            const serviceIdsToRemove = existingServiceIds.filter(id => !receivedServiceIds.includes(id));

            for (const serviceId of serviceIdsToRemove) {
                await deleteAIService(serviceId);
            }

            for (const service of services) {
                if (service.service_id) {
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
                    updatedServices.push(service);
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
                    updatedServices.push({
                        ...service,
                        service_id: result.service_id
                    });
                }
            }

            return { success: true, services: updatedServices };
        } catch (error) {
            console.error('Error updating AI services:', error);
            throw error;
        }
    }));
}