import {
    getTeams,
    getTeamAIs,
    getAIAvailableUnits,
    getAIPurchasedUnits,
    createTeam,
    updateTeam,
    deleteTeam,
    createTeamAI,
    updateTeamAI,
    deleteTeamAI,
    createAIAvailableUnit,
    deleteAIAvailableUnit,
    createAIPurchasedUnit,
    updateAIPurchasedUnit,
    deleteAIPurchasedUnit,
    getAIServices,
    checkTeamDependencies
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

export function setupRouteConfig2Teams(app) {
    app.post('/api/config2/teams', handleAsyncRoute(async (req) => {
        const teams = req.body;

        try {
            const existingTeams = await getTeams();
            const existingTeamAIs = await getTeamAIs();
            const services = await getAIServices();

            const existingTeamIds = existingTeams.map(t => t.team_id);
            const requestedTeamIds = teams.map(t => t.id);

            const teamsToDelete = existingTeamIds.filter(id => !requestedTeamIds.includes(id));
            for (const teamId of teamsToDelete) {
                await deleteTeam(teamId);
            }

            for (const team of teams) {
                let teamId = team.id;
                const existingTeam = existingTeams.find(t => t.team_id === teamId);

                if (existingTeam) {
                    await updateTeam(teamId, team.name, team.color, team.isAvailable);
                } else {
                    const newTeam = await createTeam(team.name, team.color, team.isAvailable);
                    teamId = newTeam.team_id;
                    team.id = teamId;
                }

                const currentTeamAIs = existingTeamAIs.filter(ai => ai.team_id === teamId);
                const currentAIIds = currentTeamAIs.map(ai => ai.ai_id);
                const requestedAIIds = team.ais.map(ai => ai.id).filter(id => id);

                const aisToDelete = currentAIIds.filter(id => !requestedAIIds.includes(id));
                for (const aiId of aisToDelete) {
                    await deleteTeamAI(aiId);
                }

                for (const ai of team.ais) {
                    const aiId = ai.id;
                    let serviceId = ai.service_id;

                    if (!serviceId && services.length > 0) {
                        const defaultService = services.find(s => s.is_active === 1) || services[0];
                        serviceId = defaultService.service_id;
                        ai.service_id = serviceId;
                    }

                    if (!serviceId) {
                        console.error(`No service ID found for AI`);
                        continue;
                    }

                    if (aiId && currentAIIds.includes(aiId)) {
                        await updateTeamAI(aiId, teamId, serviceId);
                    } else {
                        const result = await createTeamAI(teamId, serviceId);
                        ai.id = result.ai_id;
                    }

                    await updateAIUnits(ai);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating teams:', error);
            throw error;
        }

        async function updateAIUnits(ai) {
            try {
                const existingAvailableUnits = await getAIAvailableUnits();
                const existingPurchasedUnits = await getAIPurchasedUnits();

                if (ai.availableUnits && Array.isArray(ai.availableUnits)) {
                    const currentAvailableUnits = existingAvailableUnits
                        .filter(u => u.team_ai_id === ai.id)
                        .map(u => u.unit_id);

                    const unitsToAdd = ai.availableUnits.filter(u => !currentAvailableUnits.includes(u));
                    const unitsToRemove = currentAvailableUnits.filter(u => !ai.availableUnits.includes(u));

                    for (const unitId of unitsToAdd) {
                        await createAIAvailableUnit(ai.id, unitId);
                    }

                    for (const unitId of unitsToRemove) {
                        const unitToRemove = existingAvailableUnits.find(u => u.team_ai_id === ai.id && u.unit_id === unitId);
                        if (unitToRemove) {
                            await deleteAIAvailableUnit(unitToRemove.id);
                        }
                    }
                }

                if (ai.purchasedUnits && Array.isArray(ai.purchasedUnits)) {
                    const currentPurchasedUnits = existingPurchasedUnits
                        .filter(u => u.team_ai_id === ai.id)
                        .map(u => ({ id: u.unit_id, dbId: u.id, quantity: u.quantity }));

                    for (const purchasedUnit of ai.purchasedUnits) {
                        const existingPurchase = currentPurchasedUnits.find(u => u.id === purchasedUnit.id);

                        if (existingPurchase) {
                            if (existingPurchase.quantity !== purchasedUnit.quantity) {
                                await updateAIPurchasedUnit(existingPurchase.dbId, ai.id, purchasedUnit.id, purchasedUnit.quantity);
                            }
                        } else {
                            await createAIPurchasedUnit(ai.id, purchasedUnit.id, purchasedUnit.quantity);
                        }
                    }

                    const unitsToRemove = currentPurchasedUnits.filter(u =>
                        !ai.purchasedUnits.some(pu => pu.id === u.id)
                    );

                    for (const unitToRemove of unitsToRemove) {
                        await deleteAIPurchasedUnit(unitToRemove.dbId);
                    }
                }
            } catch (error) {
                console.error('Error updating AI units:', error);
                throw error;
            }
        }
    }));

    app.post('/api/config2/teams/add', handleAsyncRoute(async (req) => {
        const team = req.body;
        
        try {
            const newTeam = await createTeam(team.name, team.color, team.isAvailable);
            const teamId = newTeam.team_id;
            
            if (team.ais && Array.isArray(team.ais)) {
                const services = await getAIServices();
                
                for (const ai of team.ais) {
                    let serviceId = ai.service_id;
                    
                    if (!serviceId && services.length > 0) {
                        const defaultService = services.find(s => s.is_active === 1) || services[0];
                        serviceId = defaultService.service_id;
                    }
                    
                    if (!serviceId) {
                        console.error(`No service ID found for AI`);
                        continue;
                    }
                    
                    const result = await createTeamAI(teamId, serviceId);
                    const aiId = result.ai_id;
                    
                    if (ai.availableUnits && Array.isArray(ai.availableUnits)) {
                        for (const unitId of ai.availableUnits) {
                            await createAIAvailableUnit(aiId, unitId);
                        }
                    } else {
                        await createAIAvailableUnit(aiId, 'kewoBasico');
                        await createAIAvailableUnit(aiId, 'kewoArco');
                    }
                    
                    if (ai.purchasedUnits && Array.isArray(ai.purchasedUnits)) {
                        for (const unit of ai.purchasedUnits) {
                            await createAIPurchasedUnit(aiId, unit.id, unit.quantity);
                        }
                    }
                }
            }
            
            return { 
                success: true, 
                team: {
                    id: teamId,
                    name: team.name,
                    color: team.color
                }
            };
        } catch (error) {
            console.error('Error adding team:', error);
            throw error;
        }
    }));

    app.put('/api/config2/teams/:teamId', handleAsyncRoute(async (req) => {
        const teamId = parseInt(req.params.teamId);
        const updates = req.body;
        
        if (isNaN(teamId)) {
            throw new Error('ID de equipo inválido');
        }
        
        try {
            const hasDependencies = await checkTeamDependencies(teamId);
            if (hasDependencies && (updates.name || updates.color)) {
                return {
                    success: false,
                    error: 'No se puede modificar el nombre o color del equipo porque ya tiene partidas asociadas',
                    teamId: teamId
                };
            }
            
            const existingTeams = await getTeams();
            const existingTeam = existingTeams.find(t => t.team_id === teamId);
            
            if (existingTeam) {
                const finalName = updates.name !== undefined ? updates.name : existingTeam.name;
                const finalColor = updates.color !== undefined ? updates.color : existingTeam.color;
                const finalIsAvailable = updates.isAvailable !== undefined ? updates.isAvailable : existingTeam.is_available === 1;
                
                await updateTeam(teamId, finalName, finalColor, finalIsAvailable);
            }
            
            if (updates.ais && Array.isArray(updates.ais)) {
                const existingTeamAIs = await getTeamAIs();
                const currentTeamAIs = existingTeamAIs.filter(ai => ai.team_id === teamId);
                const currentAIIds = currentTeamAIs.map(ai => ai.ai_id);
                const requestedAIIds = updates.ais.map(ai => ai.id).filter(id => id);
                
                const aisToDelete = currentAIIds.filter(id => !requestedAIIds.includes(id));
                for (const aiId of aisToDelete) {
                    await deleteTeamAI(aiId);
                }
                
                const services = await getAIServices();
                
                for (const ai of updates.ais) {
                    const aiId = ai.id;
                    let serviceId = ai.service_id;
                    
                    if (!serviceId && services.length > 0) {
                        const defaultService = services.find(s => s.is_active === 1) || services[0];
                        serviceId = defaultService.service_id;
                    }
                    
                    if (!serviceId) {
                        console.error(`No service ID found for AI`);
                        continue;
                    }
                    
                    if (aiId && currentAIIds.includes(aiId)) {
                        await updateTeamAI(aiId, teamId, serviceId);
                    } else {
                        const result = await createTeamAI(teamId, serviceId);
                        ai.id = result.ai_id;
                    }
                    
                    await updateAIUnits(ai);
                }
            }
            
            return { 
                success: true,
                team: {
                    id: teamId,
                    name: updates.name,
                    color: updates.color
                }
            };
        } catch (error) {
            console.error('Error updating team:', error);
            throw error;
        }
        
        async function updateAIUnits(ai) {
            try {
                const existingAvailableUnits = await getAIAvailableUnits();
                const existingPurchasedUnits = await getAIPurchasedUnits();

                if (ai.availableUnits && Array.isArray(ai.availableUnits)) {
                    const currentAvailableUnits = existingAvailableUnits
                        .filter(u => u.team_ai_id === ai.id)
                        .map(u => u.unit_id);

                    const unitsToAdd = ai.availableUnits.filter(u => !currentAvailableUnits.includes(u));
                    const unitsToRemove = currentAvailableUnits.filter(u => !ai.availableUnits.includes(u));

                    for (const unitId of unitsToAdd) {
                        await createAIAvailableUnit(ai.id, unitId);
                    }

                    for (const unitId of unitsToRemove) {
                        const unitToRemove = existingAvailableUnits.find(u => u.team_ai_id === ai.id && u.unit_id === unitId);
                        if (unitToRemove) {
                            await deleteAIAvailableUnit(unitToRemove.id);
                        }
                    }
                }

                if (ai.purchasedUnits && Array.isArray(ai.purchasedUnits)) {
                    const currentPurchasedUnits = existingPurchasedUnits
                        .filter(u => u.team_ai_id === ai.id)
                        .map(u => ({ id: u.unit_id, dbId: u.id, quantity: u.quantity }));

                    for (const purchasedUnit of ai.purchasedUnits) {
                        const existingPurchase = currentPurchasedUnits.find(u => u.id === purchasedUnit.id);

                        if (existingPurchase) {
                            if (existingPurchase.quantity !== purchasedUnit.quantity) {
                                await updateAIPurchasedUnit(existingPurchase.dbId, ai.id, purchasedUnit.id, purchasedUnit.quantity);
                            }
                        } else {
                            await createAIPurchasedUnit(ai.id, purchasedUnit.id, purchasedUnit.quantity);
                        }
                    }

                    const unitsToRemove = currentPurchasedUnits.filter(u =>
                        !ai.purchasedUnits.some(pu => pu.id === u.id)
                    );

                    for (const unitToRemove of unitsToRemove) {
                        await deleteAIPurchasedUnit(unitToRemove.dbId);
                    }
                }
            } catch (error) {
                console.error('Error updating AI units:', error);
                throw error;
            }
        }
    }));

    app.delete('/api/config2/teams/:teamId', handleAsyncRoute(async (req) => {
        const teamId = parseInt(req.params.teamId);

        if (isNaN(teamId)) {
            throw new Error('ID de equipo inválido');
        }

        try {
            await deleteTeam(teamId);
            return { success: true, teamId };
        } catch (error) {
            console.error('Error deleting team:', error);
            throw error;
        }
    }));

    app.get('/api/config2/team/check-dependencies/:teamId', handleAsyncRoute(async (req) => {
        const teamId = parseInt(req.params.teamId);

        if (isNaN(teamId)) {
            throw new Error('ID de equipo inválido');
        }

        try {
            const hasDependencies = await checkTeamDependencies(teamId);
            return { hasDependencies };
        } catch (error) {
            console.error('Error checking team dependencies:', error);
            throw error;
        }
    }));
}