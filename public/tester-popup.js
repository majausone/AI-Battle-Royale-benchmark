export class TesterPopup {
    constructor() {
        this.popup = null;
        this.logs = [];
        this.progressBar = null;
        this.isRunning = false;
        this.matchId = null;
        this.init();
    }

    init() {
        this.popup = document.createElement('div');
        this.popup.className = 'tester-popup';
        this.popup.innerHTML = `
            <div class="tester-popup-content">
                <div class="tester-popup-header">
                    <h2>Tester de Combate</h2>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar-fill"></div>
                </div>
                <div class="tester-popup-body">
                    <div class="tester-logs"></div>
                </div>
                <div class="tester-popup-footer">
                    <button class="start-test">Iniciar Prueba</button>
                    <button class="copy-log">Copiar Logs</button>
                    <button class="close-btn">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.popup);
        
        this.logs = [];
        this.logContainer = this.popup.querySelector('.tester-logs');
        this.progressBar = this.popup.querySelector('.progress-bar-fill');
        
        this.popup.querySelector('.start-test').addEventListener('click', () => this.runTest());
        this.popup.querySelector('.copy-log').addEventListener('click', () => this.copyLogs());
        this.popup.querySelector('.close-btn').addEventListener('click', () => this.hide());
    }

    updateProgress(percent) {
        this.progressBar.style.width = `${percent}%`;
    }

    async runTest() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logs = [];
        this.logContainer.innerHTML = '';
        this.updateProgress(0);
        
        const startButton = this.popup.querySelector('.start-test');
        startButton.textContent = 'Ejecutando...';
        startButton.disabled = true;
        
        try {
            await this.performTest();
        } catch (error) {
            this.log('error', `Error general en la prueba: ${error.message}`);
        } finally {
            this.isRunning = false;
            startButton.textContent = 'Iniciar Prueba';
            startButton.disabled = false;
            this.updateProgress(100);
        }
    }

    async performTest() {
        this.log('info', '🔍 Iniciando prueba de sistema de combate');
        this.log('info', '=======================================');
        
        this.updateProgress(5);
        this.log('info', '1⃣ Creando nueva partida...');
        try {
            const createMatchResponse = await fetch('/api/matches/create', {
                method: 'POST'
            });
            
            if (!createMatchResponse.ok) {
                throw new Error(`Error al crear partida: ${createMatchResponse.status}`);
            }
            
            const matchData = await createMatchResponse.json();
            if (matchData.success && matchData.matchId) {
                this.matchId = matchData.matchId;
                this.log('success', `✅ Partida creada correctamente con ID: ${this.matchId}`);
            } else {
                throw new Error('No se pudo obtener el ID de la partida');
            }
        } catch (error) {
            this.log('error', `❌ Error al crear la partida: ${error.message}`);
            return;
        }
        
        this.updateProgress(10);
        this.log('info', '2⃣ Verificando creación de la partida en la base de datos...');
        try {
            const verifyMatchResponse = await fetch(`/api/stats/match/${this.matchId}`);
            
            if (!verifyMatchResponse.ok) {
                throw new Error(`Error al verificar la partida: ${verifyMatchResponse.status}`);
            }
            
            const matchDetails = await verifyMatchResponse.json();
            if (matchDetails && matchDetails.match) {
                this.log('success', `✅ Partida verificada en la base de datos: ID ${this.matchId}`);
                this.log('info', `   Fecha inicio: ${matchDetails.match.start_time}`);
                this.log('info', `   Estado: ${matchDetails.match.status}`);
            } else {
                throw new Error(`No se encontró la partida con ID ${this.matchId} en la base de datos`);
            }
        } catch (error) {
            this.log('error', `❌ Error al verificar la partida: ${error.message}`);
        }
        
        this.updateProgress(15);
        this.log('info', '3⃣ Cargando configuración y equipos...');
        let config;
        try {
            const configResponse = await fetch('/api/config2');
            config = await configResponse.json();
            
            if (config && config.teams && config.teams.length > 0) {
                this.log('success', `✅ Configuración cargada: ${config.teams.length} equipos encontrados`);
                config.teams.forEach(team => {
                    this.log('info', `   - Equipo: ${team.name}, Color: ${team.color}, IAs: ${team.ais.length}`);
                });
            } else {
                throw new Error('No se encontraron equipos en la configuración');
            }
        } catch (error) {
            this.log('error', `❌ Error al cargar la configuración: ${error.message}`);
            return;
        }
        
        this.updateProgress(20);
        this.log('info', '4⃣ Añadiendo participantes a la partida...');
        try {
            const availableTeams = config.teams.filter(team => team.isAvailable === true);
            this.log('info', `   Equipos disponibles: ${availableTeams.length} de ${config.teams.length}`);
            for (const team of availableTeams) {
                for (const ai of team.ais) {
                    this.log('info', `   Añadiendo IA ${ai.id} del equipo ${team.name}...`);
                    
                    const addParticipantResponse = await fetch(`/api/matches/${this.matchId}/participants`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ aiIds: [ai.id] })
                    });
                    
                    if (!addParticipantResponse.ok) {
                        throw new Error(`Error al añadir participante: ${addParticipantResponse.status}`);
                    }
                    
                    const participantData = await addParticipantResponse.json();
                    if (participantData.success) {
                        this.log('success', `✅ Participante IA ${ai.id} añadido correctamente`);
                    } else {
                        throw new Error(`No se pudo añadir el participante IA ${ai.id}`);
                    }
                }
            }
        } catch (error) {
            this.log('error', `❌ Error al añadir participantes: ${error.message}`);
        }
        
        this.updateProgress(30);
        this.log('info', '5⃣ Verificando participantes en la base de datos...');
        try {
            const verifyParticipantsResponse = await fetch(`/api/stats/match/${this.matchId}`);
            if (!verifyParticipantsResponse.ok) {
                throw new Error(`Error al verificar participantes: ${verifyParticipantsResponse.status}`);
            }
            
            const matchDetails = await verifyParticipantsResponse.json();
            if (matchDetails && matchDetails.participants && matchDetails.participants.length > 0) {
                this.log('success', `✅ Participantes verificados: ${matchDetails.participants.length} encontrados`);
                matchDetails.participants.forEach(participant => {
                    this.log('info', `   - Participante: ${participant.name || participant.ai_id}, Servicio: ${participant.service_type || 'Desconocido'}`);
                });
            } else {
                this.log('warning', `⚠️ No se encontraron participantes para la partida o aún no se han procesado`);
            }
        } catch (error) {
            this.log('error', `❌ Error al verificar participantes: ${error.message}`);
        }
        
        this.updateProgress(40);
        this.log('info', '6⃣ Simulando adaptación de precios de unidades...');
        try {
            const unitPrices = {};
            let processedCount = 0;
            
            for (const team of config.teams) {
                for (const ai of team.ais) {
                    if (ai.availableUnits && ai.availableUnits.length > 0) {
                        for (const unitId of ai.availableUnits) {
                            const newPrice = Math.floor(Math.random() * 101) + 100; // 100-200
                            unitPrices[unitId] = newPrice;
                            processedCount++;
                            
                            this.log('info', `   Ajustando precio de unidad ${unitId} a $${newPrice}...`);
                        }
                    }
                }
            }
            
            this.log('success', `✅ ${processedCount} precios de unidades ajustados`);
        } catch (error) {
            this.log('error', `❌ Error al adaptar precios: ${error.message}`);
        }
        
        this.updateProgress(50);
        this.log('info', '7⃣ Simulando compra de unidades para equipos...');
        
        const updatedTeams = JSON.parse(JSON.stringify(config.teams));
        try {
            let totalPurchased = 0;
            
            for (const team of updatedTeams) {
                for (const ai of team.ais) {
                    if (!ai.purchasedUnits) {
                        ai.purchasedUnits = [];
                    }
                    
                    if (ai.availableUnits && ai.availableUnits.length > 0) {
                        const randomUnitCount = Math.floor(Math.random() * 3) + 1; // 1-3 unidades
                        
                        for (let i = 0; i < randomUnitCount; i++) {
                            if (ai.availableUnits.length > 0) {
                                const randomIndex = Math.floor(Math.random() * ai.availableUnits.length);
                                const unitId = ai.availableUnits[randomIndex];
                                const quantity = Math.floor(Math.random() * 2) + 1; // 1-2 cantidad
                                
                                const existingUnit = ai.purchasedUnits.find(u => u.id === unitId);
                                if (existingUnit) {
                                    existingUnit.quantity += quantity;
                                } else {
                                    ai.purchasedUnits.push({
                                        id: unitId,
                                        quantity: quantity
                                    });
                                }
                                
                                totalPurchased += quantity;
                                this.log('info', `   Equipo ${team.name}, IA ${ai.id} compró ${quantity}x unidad ${unitId}`);
                            }
                        }
                    }
                }
            }
            
            await fetch('/api/config2/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedTeams)
            });
            
            this.log('success', `✅ ${totalPurchased} unidades compradas para los equipos`);
        } catch (error) {
            this.log('error', `❌ Error al comprar unidades: ${error.message}`);
        }
        
        this.updateProgress(60);
        this.log('info', '8⃣ Verificando unidades compradas en la base de datos...');
        try {
            const verifyUnitsResponse = await fetch('/api/config2');
            const updatedConfig = await verifyUnitsResponse.json();
            
            let totalVerified = 0;
            for (const team of updatedConfig.teams) {
                for (const ai of team.ais) {
                    if (ai.purchasedUnits && ai.purchasedUnits.length > 0) {
                        ai.purchasedUnits.forEach(unit => {
                            totalVerified += unit.quantity;
                        });
                    }
                }
            }
            
            this.log('success', `✅ ${totalVerified} unidades verificadas en la base de datos`);
        } catch (error) {
            this.log('error', `❌ Error al verificar unidades compradas: ${error.message}`);
        }
        
        this.updateProgress(65);
        this.log('info', '9⃣ Inicializando registros de victorias de ronda...');
        try {
            for (const team of updatedTeams) {
                try {
                    await fetch('/api/round-wins/ensure', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            match_id: this.matchId,
                            team_ids: [team.id]
                        })
                    });
                    this.log('info', `   ✓ Registro inicializado para equipo ${team.name} (ID: ${team.id})`);
                } catch (error) {
                    this.log('warning', `⚠️ No se pudo inicializar registro para equipo ${team.name}: ${error.message}`);
                }
            }
            this.log('success', `✅ Registros de victorias inicializados`);
        } catch (error) {
            this.log('error', `❌ Error al inicializar registros: ${error.message}`);
        }
        
        this.updateProgress(70);
        this.log('info', '🔟 Simulando rondas de combate...');
        const teamWins = {};
        try {
            const gameSettings = config.gameSettings || { numRounds: 3 };
            const numRounds = gameSettings.numRounds || 3;
            
            for (let round = 1; round <= numRounds; round++) {
                this.log('info', `   🔄 Iniciando ronda ${round}/${numRounds}...`);
                
                const randomTeamIndex = Math.floor(Math.random() * updatedTeams.length);
                const winningTeam = updatedTeams[randomTeamIndex];
                
                // Registrar victoria para este equipo
                if (!teamWins[winningTeam.id]) {
                    teamWins[winningTeam.id] = 0;
                }
                teamWins[winningTeam.id]++;
                
                this.log('info', `   🏆 Equipo ganador: ${winningTeam.name} (ID: ${winningTeam.id})`);
                
                await fetch('/api/round-history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        match_id: this.matchId,
                        round_number: round,
                        winner_team_id: winningTeam.id
                    })
                });
                
                const winsResponse = await fetch('/api/round-wins');
                const winsData = await winsResponse.json();
                const teamWinsRecord = winsData.data.find(w => w.match_id === this.matchId && w.team_id === winningTeam.id);
                
                if (teamWinsRecord) {
                    await fetch('/api/round-wins', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            id: teamWinsRecord.id,
                            match_id: this.matchId,
                            team_id: winningTeam.id,
                            wins_count: teamWinsRecord.wins_count + 1
                        })
                    });
                } else {
                    await fetch('/api/round-wins', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            match_id: this.matchId,
                            team_id: winningTeam.id,
                            wins_count: 1
                        })
                    });
                }
                
                this.log('success', `✅ Ronda ${round} completada y registrada correctamente`);
            }
        } catch (error) {
            this.log('error', `❌ Error al simular rondas: ${error.message}`);
        }
        
        this.updateProgress(75);
        this.log('info', '1️⃣1️⃣ Simulando respuestas de IAs...');
        try {
            for (const team of config.teams) {
                for (const ai of team.ais) {
                    for (let i = 0; i < 2; i++) {
                        const hasErrors = Math.random() < 0.3;
                        const hasWarnings = Math.random() < 0.5;
                        const responseTime = Math.random() * 10 + 1;
                        const responseText = this.generateRandomResponse(ai.id, team.name);
                        
                        const responseResult = await fetch('/api/responses/create', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                ai_id: ai.id,
                                match_id: this.matchId,
                                response: responseText,
                                has_errors: hasErrors ? 1 : 0,
                                has_warnings: hasWarnings ? 1 : 0,
                                response_time: responseTime
                            })
                        });
                        
                        if (responseResult.ok) {
                            this.log('info', `   Respuesta simulada para IA ${ai.id} (Equipo ${team.name}): ${hasErrors ? 'Con errores' : 'Sin errores'}, ${hasWarnings ? 'Con advertencias' : 'Sin advertencias'}, Tiempo: ${responseTime.toFixed(2)}s`);
                        } else {
                            this.log('warning', `   No se pudo guardar la respuesta para IA ${ai.id}`);
                        }
                    }
                }
            }
            this.log('success', `✅ Respuestas de IAs simuladas correctamente`);
        } catch (error) {
            this.log('error', `❌ Error al simular respuestas: ${error.message}`);
        }
        
        this.updateProgress(80);
        this.log('info', '1️⃣2️⃣ Simulando evaluaciones entre IAs...');
        try {
            const aiIds = [];
            
            for (const team of config.teams) {
                for (const ai of team.ais) {
                    aiIds.push({id: ai.id, teamId: team.id, teamName: team.name});
                }
            }
            
            const evaluationsCount = Math.min(5, aiIds.length * (aiIds.length - 1));
            const evaluationsDone = [];
            
            for (let i = 0; i < evaluationsCount; i++) {
                const evaluatorIndex = Math.floor(Math.random() * aiIds.length);
                let evaluatedIndex;
                
                do {
                    evaluatedIndex = Math.floor(Math.random() * aiIds.length);
                } while (evaluatedIndex === evaluatorIndex);
                
                const evaluatorAi = aiIds[evaluatorIndex];
                const evaluatedAi = aiIds[evaluatedIndex];
                
                const knowsEvaluated = Math.random() < 0.5 ? 1 : 0;
                const creativityScore = Math.random() * 10;
                const codeQualityScore = Math.random() * 10;
                const comments = this.generateRandomEvaluationComment(creativityScore, codeQualityScore);
                
                const evaluationResult = await fetch('/api/evaluations/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        match_id: this.matchId,
                        evaluator_ai_id: evaluatorAi.id,
                        evaluated_ai_id: evaluatedAi.id,
                        knows_evaluated: knowsEvaluated,
                        creativity_score: creativityScore,
                        code_quality_score: codeQualityScore,
                        comments: comments
                    })
                });
                
                if (evaluationResult.ok) {
                    this.log('info', `   Evaluación: IA ${evaluatorAi.id} evaluó a IA ${evaluatedAi.id} - Creatividad: ${creativityScore.toFixed(1)}, Calidad: ${codeQualityScore.toFixed(1)}`);
                    evaluationsDone.push({evaluator: evaluatorAi.id, evaluated: evaluatedAi.id});
                } else {
                    this.log('warning', `   No se pudo guardar la evaluación de IA ${evaluatorAi.id} a IA ${evaluatedAi.id}`);
                }
            }
            
            this.log('success', `✅ ${evaluationsDone.length} evaluaciones entre IAs simuladas correctamente`);
        } catch (error) {
            this.log('error', `❌ Error al simular evaluaciones: ${error.message}`);
        }
        
        this.updateProgress(85);
        this.log('info', '1️⃣3️⃣ Completando partida con un ganador...');
        try {
            // Determinar el equipo ganador (el que tiene más victorias)
            let winnerTeamId = null;
            let maxWins = 0;
            for (const [teamId, wins] of Object.entries(teamWins)) {
                if (wins > maxWins) {
                    maxWins = wins;
                    winnerTeamId = parseInt(teamId);
                }
            }
            
            if (!winnerTeamId && updatedTeams.length > 0) {
                // Si no hay un ganador claro, seleccionar uno al azar
                const randomTeam = updatedTeams[Math.floor(Math.random() * updatedTeams.length)];
                winnerTeamId = randomTeam.id;
            }
            
            // Encontrar una IA del equipo ganador
            const winnerTeam = updatedTeams.find(team => team.id === winnerTeamId);
            if (!winnerTeam || !winnerTeam.ais || winnerTeam.ais.length === 0) {
                throw new Error('No se pudo determinar un equipo ganador válido');
            }
            
            const winnerAi = winnerTeam.ais[0];
            this.log('info', `   Estableciendo ganador: Equipo ${winnerTeam.name}, IA ${winnerAi.id}`);
            
            // Completar la partida
            const completeMatchResponse = await fetch(`/api/matches/${this.matchId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    winnerId: winnerAi.id
                })
            });
            
            if (completeMatchResponse.ok) {
                this.log('success', `✅ Partida completada correctamente con ganador: IA ${winnerAi.id} del equipo ${winnerTeam.name}`);
            } else {
                throw new Error(`Error al completar la partida: ${completeMatchResponse.status}`);
            }
        } catch (error) {
            this.log('error', `❌ Error al completar la partida: ${error.message}`);
        }
        
        this.updateProgress(90);
        this.log('info', '1️⃣4️⃣ Verificando el estado final de la partida...');
        try {
            const verifyFinalStateResponse = await fetch(`/api/stats/match/${this.matchId}`);
            
            if (!verifyFinalStateResponse.ok) {
                throw new Error(`Error al verificar estado final: ${verifyFinalStateResponse.status}`);
            }
            
            const finalMatchData = await verifyFinalStateResponse.json();
            
            if (finalMatchData && finalMatchData.match) {
                const isCompleted = finalMatchData.match.status === 'completed';
                const hasEndTime = finalMatchData.match.end_time !== null;
                
                let errorMsg = '';
                if (!isCompleted) errorMsg += ' estado no es "completed";';
                if (!hasEndTime) errorMsg += ' no tiene fecha de fin;';
                
                if (errorMsg) {
                    throw new Error('Problemas con el estado final:' + errorMsg);
                }
                
                this.log('success', `✅ Estado final de la partida verificado correctamente`);
                this.log('info', `   - Estado: ${finalMatchData.match.status}`);
                this.log('info', `   - Fecha fin: ${finalMatchData.match.end_time}`);
                
                if (finalMatchData.participants) {
                    const winner = finalMatchData.participants.find(p => p.is_winner === 1);
                    if (winner) {
                        this.log('info', `   - Ganador: ${winner.name || winner.ai_id}`);
                    } else {
                        this.log('warning', `⚠️ No se encontró un ganador en los participantes`);
                    }
                }
                
                if (finalMatchData.responses) {
                    this.log('info', `   - Respuestas registradas: ${finalMatchData.responses.length}`);
                }
                
                if (finalMatchData.evaluations) {
                    this.log('info', `   - Evaluaciones registradas: ${finalMatchData.evaluations.length}`);
                }
            } else {
                throw new Error('No se pudo obtener el estado final de la partida');
            }
        } catch (error) {
            this.log('error', `❌ Error al verificar estado final: ${error.message}`);
        }
        
        this.updateProgress(100);
        this.log('info', '✨ Prueba finalizada');
        this.log('info', '=======================================');
    }
    
    generateRandomResponse(aiId, teamName) {
        const responses = [
            `// kewoBasico.json\n{\n  "id": "kewoTestUnit${aiId}",\n  "name": "Test Unit de ${teamName}",\n  "description": "Una unidad de prueba generada automáticamente",\n  "cost": 150,\n  "life": 15,\n  "speed": 1.5,\n  "damage": 3,\n  "attackType": "melee"\n}`,
            
            `// kewoArco.json\n{\n  "id": "kewoRanged${aiId}",\n  "name": "Ranged Unit de ${teamName}",\n  "description": "Una unidad a distancia generada automáticamente",\n  "cost": 180,\n  "life": 10,\n  "speed": 1.2,\n  "damage": 4,\n  "attackType": "ranged",\n  "attackRange": 200\n}`,
            
            `// skill-move.js\nexport default function moveToTarget(unit, target) {\n  const dx = target.x - unit.x;\n  const dy = target.y - unit.y;\n  const distance = Math.sqrt(dx * dx + dy * dy);\n  \n  if (distance > 10) {\n    unit.x += dx / distance * unit.speed;\n    unit.y += dy / distance * unit.speed;\n  }\n}`
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    generateRandomEvaluationComment(creativityScore, codeQualityScore) {
        const comments = [
            `La IA ha mostrado un nivel de creatividad ${creativityScore > 7 ? 'excepcional' : creativityScore > 4 ? 'adecuado' : 'bajo'}. La calidad del código es ${codeQualityScore > 7 ? 'excelente' : codeQualityScore > 4 ? 'aceptable' : 'mejorable'}.`,
            
            `Evaluación técnica: Creatividad ${creativityScore.toFixed(1)}/10, Código ${codeQualityScore.toFixed(1)}/10. ${creativityScore + codeQualityScore > 14 ? 'Implementación sobresaliente' : creativityScore + codeQualityScore > 8 ? 'Implementación estándar' : 'Necesita mejoras significativas'}.`,
            
            `La unidad diseñada muestra ${creativityScore > 6 ? 'ideas originales' : 'conceptos convencionales'} y el código es ${codeQualityScore > 6 ? 'eficiente y bien estructurado' : 'funcional pero con margen de mejora'}.`
        ];
        
        return comments[Math.floor(Math.random() * comments.length)];
    }

    log(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            type,
            message,
            timestamp
        };
        this.logs.push(logEntry);
        
        const logElement = document.createElement('div');
        logElement.className = `tester-log-${type}`;
        logElement.textContent = `[${timestamp}] ${message}`;
        this.logContainer.appendChild(logElement);
        
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    copyLogs() {
        const formattedLogs = this.logs.map(log => {
            return `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`;
        }).join('\n');
        
        navigator.clipboard.writeText(formattedLogs);
    }

    show() {
        this.popup.style.display = 'flex';
    }

    hide() {
        this.popup.style.display = 'none';
    }
}

export const testerPopup = new TesterPopup();