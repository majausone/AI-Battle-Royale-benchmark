import { emit, EVENTS } from './events.js';
import { playDeathSound } from './audio.js';
import { getUnitData, getEffect, getSkillEffect } from './unitLoader.js';
import { validateEffect } from './seffectValidator.js';

export let gameIsOver = false;
export let isPaused = false;
export let isInitialized = false;
export const gameArea = document.getElementById('game-area');
export let selectedUnit = null;
export let gameSpeedFactor = 1.0;

export const mainCanvas = document.createElement('canvas');
mainCanvas.style.position = 'absolute';
mainCanvas.style.top = '0';
mainCanvas.style.left = '0';
mainCanvas.style.width = '100%';
mainCanvas.style.height = '100%';

export const gameObjects = new Map();
export const projectiles = new Map();
export const swords = new Map();
export const trails = [];
export const activeSkillEffects = new Map();
export const activeSkills = new Map();
export const teamStats = new Map();
export const spawnPoints = new Map();
let activeBattleTeams = new Set();
export const effects = new Map();
export const terrainEffects = new Map();
export const activeErrors = [];
export let nextId = 0;
let reportValidationIssuePromise = null;

const cameraState = {
    currentZoom: 1,
    targetZoom: 1,
    startZoom: 1,
    elapsed: 0,
    duration: 500,
    target: null,
    startPos: null,
    targetPos: null,
    currentPos: null
};

const BATTLE_MARGIN_TOP = 75;
const BATTLE_MARGIN_SIDES = 4;
const BATTLE_MARGIN_BOTTOM = 4;

export function getGameSpeed() {
    return gameSpeedFactor;
}

export function setGameSpeed(factor, syncWithServer = true) {
    const newValue = Math.max(0.1, Math.min(3.0, factor));

    if (gameSpeedFactor !== newValue) {
        gameSpeedFactor = newValue;

        if (syncWithServer) {
            try {
                fetch('/api/config2/display', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        gameSpeed: gameSpeedFactor
                    })
                });
            } catch (error) {
                console.error('Error saving game speed:', error);
            }
        }

        window.dispatchEvent(new CustomEvent('gameSpeedChange', { detail: gameSpeedFactor }));
    }

    return gameSpeedFactor;
}

function resolveTargetPos(target) {
    if (target && typeof target.x === 'number' && typeof target.y === 'number') {
        const w = target.width || 0;
        const h = target.height || 0;
        return { x: target.x + w / 2, y: target.y + h / 2 };
    }
    return { x: mainCanvas.width / 2, y: mainCanvas.height / 2 };
}

export function setCameraZoom(zoomFactor = 1, target = null, duration = 500) {
    const clamped = Math.max(1, zoomFactor);
    cameraState.startZoom = cameraState.currentZoom || 1;
    cameraState.targetZoom = clamped;
    cameraState.elapsed = 0;
    cameraState.duration = Math.max(200, duration);
    cameraState.target = target || null;

    const centerPos = resolveTargetPos(null);
    const desiredPos = resolveTargetPos(target);

    if (zoomFactor > 1) {
        // zoom in: center -> target
        cameraState.startPos = centerPos;
        cameraState.targetPos = desiredPos;
    } else {
        // zoom out: from current toward center
        const fromPos = cameraState.currentPos || desiredPos || centerPos;
        cameraState.startPos = fromPos;
        cameraState.targetPos = centerPos;
    }

    if (!cameraState.currentPos) {
        cameraState.currentPos = cameraState.startPos;
    }
}

export function refreshCameraTarget(target) {
    if (!target) return;
    cameraState.target = target;
    const desiredPos = resolveTargetPos(target);
    cameraState.targetPos = desiredPos;
    if (cameraState.elapsed >= cameraState.duration && cameraState.currentZoom === cameraState.targetZoom) {
        cameraState.currentPos = desiredPos;
    }
}

export function getCameraZoom() {
    return {
        zoom: cameraState.currentZoom,
        target: cameraState.target,
        targetPos: cameraState.currentPos
    };
}

export function updateCameraZoom(deltaTime) {
    if (cameraState.currentZoom === undefined) {
        cameraState.currentZoom = 1;
    }
    if (cameraState.elapsed >= cameraState.duration && cameraState.currentZoom === cameraState.targetZoom) {
        return;
    }

    cameraState.elapsed += deltaTime;
    const t = Math.min(1, cameraState.elapsed / cameraState.duration);
    const eased = t * t * (3 - 2 * t); // smoothstep
    cameraState.currentZoom = cameraState.startZoom + (cameraState.targetZoom - cameraState.startZoom) * eased;
    if (cameraState.startPos && cameraState.targetPos) {
        const sx = cameraState.startPos.x;
        const sy = cameraState.startPos.y;
        const tx = cameraState.targetPos.x;
        const ty = cameraState.targetPos.y;
        cameraState.currentPos = {
            x: sx + (tx - sx) * eased,
            y: sy + (ty - sy) * eased
        };
        if (t === 1) {
            cameraState.currentPos = { ...cameraState.targetPos };
        }
    }
}

export async function loadGameSpeed() {
    try {
        const response = await fetch('/api/config2');
        if (response.ok) {
            const config = await response.json();
            if (config.display && config.display.gameSpeed !== undefined) {
                setGameSpeed(config.display.gameSpeed, false);
            }
        }
    } catch (e) {
        console.error('Error loading game speed:', e);
    }
    return gameSpeedFactor;
}

export function getAdjustedDeltaTime(deltaTime) {
    return deltaTime * gameSpeedFactor;
}

export function getAdjustedTimeDifference(currentTime, previousTime) {
    return (currentTime - previousTime) * gameSpeedFactor;
}

export function getBattleAreaBounds() {
    return {
        top: BATTLE_MARGIN_TOP,
        left: BATTLE_MARGIN_SIDES,
        right: gameArea.offsetWidth - BATTLE_MARGIN_SIDES,
        bottom: gameArea.offsetHeight - BATTLE_MARGIN_BOTTOM
    };
}

export function isPositionInBounds(x, y, width, height) {
    const bounds = getBattleAreaBounds();
    return x >= bounds.left &&
        (x + width) <= bounds.right &&
        y >= bounds.top &&
        (y + height) <= bounds.bottom;
}

export function getSpawnPoint(teamId) {
    if (!spawnPoints.has(teamId)) {
        calculateSpawnPoints();
    }
    return spawnPoints.get(teamId);
}

function reportRuntimeIssue(filename, message, isError = false, target = null) {
    try {
        if (!reportValidationIssuePromise) {
            reportValidationIssuePromise = import('./socketManager.js')
                .then(module => module.reportValidationIssue)
                .catch(error => {
                    console.error('Error loading validation reporter:', error);
                    return null;
                });
        }

        reportValidationIssuePromise.then(reporter => {
            if (!reporter) return;

            const team = target?.teamId ? teamStats.get(target.teamId) : null;
            const ai = target?.aiId && team?.ais ? team.ais.get(target.aiId) : null;

            reporter(
                filename,
                message,
                isError,
                {
                    aiId: target?.aiId || null,
                    teamId: target?.teamId || null,
                    aiName: ai?.service || null,
                    teamName: team?.name || null
                }
            );
        });
    } catch (error) {
        console.error('Error reporting runtime issue:', error);
    }
}

export function calculateSpawnPoints() {
    const bounds = getBattleAreaBounds();
    const centerX = (bounds.right - bounds.left) / 2 + bounds.left;
    const centerY = (bounds.bottom - bounds.top) / 2 + bounds.top;
    const radius = Math.min(centerX - bounds.left, centerY - bounds.top) * 0.8;

    const prioritizedTeams = activeBattleTeams.size > 0
        ? Array.from(activeBattleTeams)
        : Array.from(teamStats.keys());

    if (prioritizedTeams.length === 0) {
        return;
    }

    prioritizedTeams.forEach((teamId, index) => {
        const angle = (index * 2 * Math.PI / prioritizedTeams.length) - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        spawnPoints.set(teamId, { x, y });
    });
}

export function setActiveBattleTeams(teamIds = []) {
    if (Array.isArray(teamIds) && teamIds.length > 0) {
        activeBattleTeams = new Set(teamIds.filter(id => id !== undefined && id !== null));
    } else {
        activeBattleTeams.clear();
    }
    calculateSpawnPoints();
}

export function getActiveTeamsForDisplay() {
    if (activeBattleTeams.size > 0) {
        return Array.from(activeBattleTeams)
            .map(id => [id, teamStats.get(id)])
            .filter(([, team]) => !!team);
    }
    return Array.from(teamStats.entries());
}

export function setGameOver(value) {
    gameIsOver = value;
}

export function setPaused(value) {
    isPaused = value;
}

export function cleanupEffects() {
    for (const [id, effect] of effects.entries()) {
        if (effect && typeof effect.cleanup === 'function') {
            effect.cleanup();
        }
    }
    effects.clear();

    for (const [id, effect] of terrainEffects.entries()) {
        if (effect.visualEffectCleanup && typeof effect.visualEffectCleanup === 'function') {
            effect.visualEffectCleanup();
        }
    }
    terrainEffects.clear();
}

export function resetGameState() {
    gameIsOver = false;
    isPaused = false;
    cleanupEffects();
    gameObjects.clear();
    projectiles.clear();
    swords.clear();
    trails.length = 0;
    activeSkillEffects.clear();
    activeSkills.clear();
    teamStats.clear();
    spawnPoints.clear();
    activeBattleTeams.clear();
    terrainEffects.clear();
    nextId = 0;
    isInitialized = false;
    selectedUnit = null;
    cameraState.zoom = 1;
    cameraState.target = null;

    if (mainCanvas.parentNode) {
        mainCanvas.parentNode.removeChild(mainCanvas);
    }
}

export function clearGameErrors() {
    activeErrors.length = 0;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('errorsCleared'));
    }
}

export function initGame() {
    if (!isInitialized) {
        gameArea.appendChild(mainCanvas);
        mainCanvas.width = gameArea.offsetWidth;
        mainCanvas.height = gameArea.offsetHeight;

        mainCanvas.addEventListener('click', handleCanvasClick);
        document.addEventListener('click', handleDocumentClick);

        isInitialized = true;
    }
}

export function killUnit(target) {
    if (!target || target.id === undefined || !gameObjects.has(target.id)) return;

    emit(target, EVENTS.DEATH);
    const unitData = getUnitData(target.type);

    if (unitData?.effects?.death) {
        const effect = getEffect(unitData.effects.death);
        if (effect) {
            effect(target);
        }
    } else {
        const defaultDeath = getEffect('defaultDeath');
        if (defaultDeath) {
            defaultDeath(target);
        }
    }

    playDeathSound(unitData, {
        aiId: target.aiId,
        teamId: target.teamId,
        unitType: target.type
    });

    removeGameObject(target.id);
}

function handleCanvasClick(event) {
    const rect = mainCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let clickedUnit = null;
    gameObjects.forEach(obj => {
        if (x >= obj.x && x <= obj.x + obj.width &&
            y >= obj.y && y <= obj.y + obj.height) {
            clickedUnit = obj;
        }
    });

    if (clickedUnit) {
        event.stopPropagation();
        selectedUnit = clickedUnit;
        const unitData = getUnitData(clickedUnit.type);
        if (unitData) {
            window.dispatchEvent(new CustomEvent('showUnitTooltip', {
                detail: {
                    unit: clickedUnit,
                    unitData: unitData
                }
            }));
        }
    }
}

function handleDocumentClick(event) {
    // Auto-close functionality removed as per user request
}

window.addEventListener('deselectUnit', () => {
    selectedUnit = null;
    window.dispatchEvent(new CustomEvent('hideUnitTooltip'));
});

export function getNextId() {
    return nextId++;
}

export function initTeam(teamId, teamData) {
    if (!teamStats.has(teamId)) {
        teamStats.set(teamId, {
            totalHealth: 0,
            currentHealth: 0,
            unitCount: 0,
            color: teamData.color,
            name: teamData.name,
            ais: new Map()
        });

        teamData.ais.forEach(ai => {
            teamStats.get(teamId).ais.set(ai.id, {
                totalHealth: 0,
                currentHealth: 0,
                unitCount: 0,
                service: ai.service
            });
        });

        calculateSpawnPoints();
    }
}

export function addGameObject(id, object) {
    if (!object.activeEffects) {
        object.activeEffects = new Map();
    }
    if (!object.skills) {
        object.skills = new Map();
    }

    if (object.teamId) {
        const team = teamStats.get(object.teamId);
        if (team) {
            team.totalHealth += object.health;
            team.currentHealth += object.health;
            team.unitCount++;

            if (object.aiId && team.ais.has(object.aiId)) {
                const ai = team.ais.get(object.aiId);
                ai.totalHealth += object.health;
                ai.currentHealth += object.health;
                ai.unitCount++;
            }
        }
    }

    const bounds = getBattleAreaBounds();
    object.x = Math.max(bounds.left, Math.min(object.x, bounds.right - object.width));
    object.y = Math.max(bounds.top, Math.min(object.y, bounds.bottom - object.height));

    gameObjects.set(id, object);
    return id;
}

export function removeGameObject(id) {
    const obj = gameObjects.get(id);
    if (obj) {
        if (typeof obj.cleanupEffects === 'function') {
            try {
                obj.cleanupEffects();
            } catch (error) {
                console.warn("Error executing cleanupEffects:", error);
            }
        }

        if (Array.isArray(obj.effects)) {
            obj.effects.forEach(cleanup => {
                if (typeof cleanup === 'function') {
                    try {
                        cleanup();
                    } catch (error) {
                        console.warn("Error cleaning up effect:", error);
                    }
                }
            });
            obj.effects = [];
        }

        if (obj.skills) {
            obj.skills.clear();
        }

        if (obj.activeEffects) {
            obj.activeEffects.forEach(effect => {
                if (effect.continuousEffect && typeof effect.continuousEffect === 'function') {
                    try {
                        effect.continuousEffect();
                    } catch (error) {
                        console.warn("Error cleaning up continuous effect:", error);
                    }
                }
                if (effect.sourceContinuousEffect && typeof effect.sourceContinuousEffect === 'function') {
                    try {
                        effect.sourceContinuousEffect();
                    } catch (error) {
                        console.warn("Error cleaning up source continuous effect:", error);
                    }
                }
                if (effect.cleanup && typeof effect.cleanup === 'function') {
                    try {
                        effect.cleanup();
                    } catch (error) {
                        console.warn("Error cleaning up effect:", error);
                    }
                }
            });
        }

        if (obj.teamId) {
            const team = teamStats.get(obj.teamId);
            if (team) {
                team.currentHealth = Math.max(0, team.currentHealth - obj.health);
                team.unitCount--;

                if (obj.aiId && team.ais.has(obj.aiId)) {
                    const ai = team.ais.get(obj.aiId);
                    ai.currentHealth = Math.max(0, ai.currentHealth - obj.health);
                    ai.unitCount--;
                }
            }
        }
    }
    gameObjects.delete(id);
}

export function registerSkill(objectId, skillName, updateFunction, cleanup) {
    const object = gameObjects.get(objectId);
    if (object && object.skills) {
        object.skills.set(skillName, { update: updateFunction, cleanup });
    }
}

export function getGameObject(id) {
    return gameObjects.get(id);
}

export function updateCanvas() {
    mainCanvas.width = gameArea.offsetWidth;
    mainCanvas.height = gameArea.offsetHeight;
    calculateSpawnPoints();
}

function areInSameTeam(unit1, unit2) {
    return unit1 && unit2 && unit1.teamId && unit2.teamId && unit1.teamId === unit2.teamId;
}

function hasActiveEffect(target, effectId) {
    return target.activeEffects.has(effectId);
}

export async function applySkillEffect(target, effectId, effect, isSource = false) {
    if (!effect) {
        console.warn(`Warning: Skill effect application failed - No effect definition provided. EffectId: ${effectId}, Target: ${target.id}, Type: ${target.type}. This often happens when a skill tries to apply effects without a corresponding seffect-*.json file.`);
        return;
    }

    if (!validateEffect(effect)) {
        console.warn(`Warning: Skill effect validation failed for ${effectId}. The effect may not work as expected.`);
    }

    if (effect.targetEffectId) {
        const targetEffect = await getSkillEffect(effect.targetEffectId);
        if (targetEffect) {
            applySkillEffect(target, effect.targetEffectId, targetEffect);
        }
        return;
    }

    if (effect.effectType === "MULTI_STAT") {
        applyMultiStatEffect(target, effectId, effect);
        return;
    }

    if (effect.stat) {
        applyStatEffect(target, effectId, effect);
        return;
    }

    if (effect.healAmount || effect.damageAmount) {
        applyDirectEffect(target, effectId, effect, isSource);
        return;
    }
}

function applyMultiStatEffect(target, effectId, effect) {
    if (hasActiveEffect(target, effectId)) {
        return;
    }

    const currentTime = Date.now();

    const effectInstance = {
        ...effect,
        fromSkill: true,
        startTime: currentTime,
        lastPulse: currentTime,
        originalValues: {},
        id: effectId
    };

    if (effect.effects) {
        effect.effects.forEach(subEffect => {
            if (subEffect.stat) {
                effectInstance.originalValues[subEffect.stat] = target[subEffect.stat];
            }
        });
    }

    if (effect.targetFx && effect.targetFx.start) {
        try {
            const startEffectFn = getEffect(effect.targetFx.start);
            if (startEffectFn) {
                startEffectFn(target);
            }
        } catch (error) {
            console.warn("Error applying start effect:", error);
        }
    }

    if (effect.sourceFx && effect.sourceFx.start) {
        try {
            const startEffectFn = getEffect(effect.sourceFx.start);
            if (startEffectFn) {
                startEffectFn(target);
            }
        } catch (error) {
            console.warn("Error applying source start effect:", error);
        }
    }

    if (effect.targetFx && effect.targetFx.continuous) {
        try {
            const contEffect = getEffect(effect.targetFx.continuous);
            if (contEffect) {
                const cleanup = contEffect(target);
                if (typeof cleanup === 'function') {
                    effectInstance.continuousEffect = cleanup;
                } else if (cleanup && typeof cleanup.then === 'function') {
                    cleanup.then(cleanupFn => {
                        if (typeof cleanupFn === 'function') {
                            effectInstance.continuousEffect = cleanupFn;
                        }
                    });
                }
            }
        } catch (error) {
            console.warn("Error applying continuous effect:", error);
        }
    }

    if (effect.sourceFx && effect.sourceFx.continuous) {
        try {
            const contEffect = getEffect(effect.sourceFx.continuous);
            if (contEffect) {
                const cleanup = contEffect(target);
                if (typeof cleanup === 'function') {
                    effectInstance.sourceContinuousEffect = cleanup;
                } else if (cleanup && typeof cleanup.then === 'function') {
                    cleanup.then(cleanupFn => {
                        if (typeof cleanupFn === 'function') {
                            effectInstance.sourceContinuousEffect = cleanupFn;
                        }
                    });
                }
            }
        } catch (error) {
            console.warn("Error applying source continuous effect:", error);
        }
    }

    target.activeEffects.set(effectId, effectInstance);
}

function applyStatEffect(target, effectId, effect) {
    if (hasActiveEffect(target, effectId)) {
        return;
    }

    const currentTime = Date.now();

    const effectInstance = {
        ...effect,
        fromSkill: true,
        startTime: currentTime,
        lastPulse: currentTime,
        id: effectId
    };

    if (effect.stat) {
        effectInstance.originalValue = target[effect.stat];
    }

    if (effect.targetFx && effect.targetFx.start) {
        try {
            const startEffectFn = getEffect(effect.targetFx.start);
            if (startEffectFn) {
                startEffectFn(target);
            }
        } catch (error) {
            console.warn("Error applying start effect:", error);
        }
    }

    if (effect.sourceFx && effect.sourceFx.start) {
        try {
            const startEffectFn = getEffect(effect.sourceFx.start);
            if (startEffectFn) {
                startEffectFn(target);
            }
        } catch (error) {
            console.warn("Error applying source start effect:", error);
        }
    }

    if (effect.targetFx && effect.targetFx.continuous) {
        try {
            const contEffect = getEffect(effect.targetFx.continuous);
            if (contEffect) {
                const cleanup = contEffect(target);
                if (typeof cleanup === 'function') {
                    effectInstance.continuousEffect = cleanup;
                } else if (cleanup && typeof cleanup.then === 'function') {
                    cleanup.then(cleanupFn => {
                        if (typeof cleanupFn === 'function') {
                            effectInstance.continuousEffect = cleanupFn;
                        }
                    });
                }
            }
        } catch (error) {
            console.warn("Error applying continuous effect:", error);
        }
    }

    if (effect.sourceFx && effect.sourceFx.continuous) {
        try {
            const contEffect = getEffect(effect.sourceFx.continuous);
            if (contEffect) {
                const cleanup = contEffect(target);
                if (typeof cleanup === 'function') {
                    effectInstance.sourceContinuousEffect = cleanup;
                } else if (cleanup && typeof cleanup.then === 'function') {
                    cleanup.then(cleanupFn => {
                        if (typeof cleanupFn === 'function') {
                            effectInstance.sourceContinuousEffect = cleanupFn;
                        }
                    });
                }
            }
        } catch (error) {
            console.warn("Error applying source continuous effect:", error);
        }
    }

    target.activeEffects.set(effectId, effectInstance);
}

function applyDirectEffect(target, effectId, effect, isSource) {
    const currentTime = Date.now();

    if (effect.healAmount) {
        const oldHealth = target.health;
        target.health = Math.min(target.maxHealth, target.health + effect.healAmount);

        if (effect.pulseFx) {
            try {
                const pulseEffect = getEffect(effect.pulseFx);
                if (pulseEffect) {
                    pulseEffect(target);
                }
            } catch (error) {
                console.warn(`Error applying pulse effect ${effect.pulseFx}:`, error);
            }
        }

        const healthDiff = target.health - oldHealth;
        if (target.teamId && healthDiff > 0) {
            const team = teamStats.get(target.teamId);
            if (team) {
                team.currentHealth = Math.min(team.totalHealth, team.currentHealth + healthDiff);
                if (target.aiId && team.ais.has(target.aiId)) {
                    const ai = team.ais.get(target.aiId);
                    ai.currentHealth = Math.min(ai.totalHealth, ai.currentHealth + healthDiff);
                }
            }
        }
    } else if (effect.damageAmount) {
        const oldHealth = target.health;
        target.health = Math.max(0, target.health - effect.damageAmount);

        if (effect.pulseFx) {
            try {
                const pulseEffect = getEffect(effect.pulseFx);
                if (pulseEffect) {
                    pulseEffect(target, { damage: effect.damageAmount });
                }
            } catch (error) {
                console.warn(`Error applying pulse effect ${effect.pulseFx}:`, error);
            }
        }

        const healthDiff = oldHealth - target.health;
        if (target.teamId && healthDiff > 0) {
            const team = teamStats.get(target.teamId);
            if (team) {
                team.currentHealth = Math.max(0, team.currentHealth - healthDiff);
                if (target.aiId && team.ais.has(target.aiId)) {
                    const ai = team.ais.get(target.aiId);
                    ai.currentHealth = Math.max(0, ai.currentHealth - healthDiff);
                }
            }
        }

        if (target.health <= 0) {
            killUnit(target);
        }
    }

    if ((effect.healAmount || effect.damageAmount) && effect.pulseInterval && !hasActiveEffect(target, effectId)) {
        const effectInstance = {
            ...effect,
            fromSkill: true,
            startTime: currentTime,
            lastPulse: currentTime,
            id: effectId
        };

        if (effect.targetFx && effect.targetFx.continuous) {
            try {
                const contEffect = getEffect(effect.targetFx.continuous);
                if (contEffect) {
                    const cleanup = contEffect(target);
                    if (typeof cleanup === 'function') {
                        effectInstance.continuousEffect = cleanup;
                    } else if (cleanup && typeof cleanup.then === 'function') {
                        cleanup.then(cleanupFn => {
                            if (typeof cleanupFn === 'function') {
                                effectInstance.continuousEffect = cleanupFn;
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn("Error applying continuous effect:", error);
            }
        }

        if (effect.sourceFx && effect.sourceFx.continuous) {
            try {
                const contEffect = getEffect(effect.sourceFx.continuous);
                if (contEffect) {
                    const cleanup = contEffect(target);
                    if (typeof cleanup === 'function') {
                        effectInstance.sourceContinuousEffect = cleanup;
                    } else if (cleanup && typeof cleanup.then === 'function') {
                        cleanup.then(cleanupFn => {
                            if (typeof cleanupFn === 'function') {
                                effectInstance.sourceContinuousEffect = cleanupFn;
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn("Error applying source continuous effect:", error);
            }
        }

        target.activeEffects.set(effectId, effectInstance);
    }
}

export function createTerrainEffect(params) {
    const { id, position, radius, effectType, effect, targetTypes, teamId, duration, pulseInterval, targetEffectId, damageAmount, healAmount, pulseFx, fxId } = params;
    const terrainEffectId = `terrain-effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const terrainEffect = {
        id: terrainEffectId,
        effectId: id,
        position,
        radius,
        effectType,
        effect,
        targetTypes,
        teamId,
        duration,
        pulseInterval,
        targetEffectId,
        damageAmount,
        healAmount,
        pulseFx,
        startTime: Date.now(),
        lastPulseTime: Date.now(),
        visualEffectCleanup: null
    };

    if (fxId) {
        const effectFn = getEffect(fxId);
        if (effectFn) {
            const cleanup = effectFn(position);
            if (typeof cleanup === 'function') {
                terrainEffect.visualEffectCleanup = cleanup;
            } else if (cleanup && typeof cleanup.then === 'function') {
                cleanup.then(cleanupFn => {
                    if (typeof cleanupFn === 'function') {
                        terrainEffect.visualEffectCleanup = cleanupFn;
                    }
                });
            }
        }
    }

    terrainEffects.set(terrainEffectId, terrainEffect);
    return terrainEffectId;
}

async function processTerrainEffects(deltaTime) {
    const currentTime = Date.now();
    const adjustedDeltaTime = deltaTime * gameSpeedFactor;

    for (const [effectId, effect] of terrainEffects.entries()) {
        if (effect.duration && currentTime - effect.startTime >= effect.duration / gameSpeedFactor) {
            if (effect.visualEffectCleanup && typeof effect.visualEffectCleanup === 'function') {
                try {
                    effect.visualEffectCleanup();
                } catch (error) {
                    console.warn(`Error cleaning up visual effect for terrain effect ${effectId}:`, error);
                }
            }
            terrainEffects.delete(effectId);
            continue;
        }

        if (effect.pulseInterval && currentTime - effect.lastPulseTime >= effect.pulseInterval / gameSpeedFactor) {
            effect.lastPulseTime = currentTime;

            let unitsInRange = [];

            if (effect.targetTypes.includes('allies')) {
                unitsInRange = [...unitsInRange, ...Array.from(gameObjects.values()).filter(obj => {
                    if (!obj.teamId || obj.teamId !== effect.teamId) return false;

                    const dx = obj.x + obj.width / 2 - effect.position.x;
                    const dy = obj.y + obj.height / 2 - effect.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    return distance <= effect.radius;
                })];
            }

            if (effect.targetTypes.includes('enemies')) {
                unitsInRange = [...unitsInRange, ...Array.from(gameObjects.values()).filter(obj => {
                    if (effect.teamId && obj.teamId === effect.teamId) return false;

                    const dx = obj.x + obj.width / 2 - effect.position.x;
                    const dy = obj.y + obj.height / 2 - effect.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    return distance <= effect.radius;
                })];
            }

            for (const unit of unitsInRange) {
                if (effect.targetEffectId) {
                    try {
                        const targetEffect = await getSkillEffect(effect.targetEffectId);
                        if (targetEffect) {
                            applySkillEffect(unit, effect.targetEffectId, targetEffect);
                        }
                    } catch (error) {
                        console.warn(`Error applying target effect ${effect.targetEffectId}:`, error);
                    }
                } else if (effect.damageAmount) {
                    const oldHealth = unit.health;
                    unit.health = Math.max(0, unit.health - effect.damageAmount);

                    if (effect.pulseFx) {
                        try {
                            const pulseEffect = getEffect(effect.pulseFx);
                            if (pulseEffect) {
                                pulseEffect(unit, { damage: effect.damageAmount });
                            }
                        } catch (error) {
                            console.warn(`Error applying pulse effect ${effect.pulseFx}:`, error);
                        }
                    }

                    const healthDiff = oldHealth - unit.health;
                    if (unit.teamId && healthDiff > 0) {
                        const team = teamStats.get(unit.teamId);
                        if (team) {
                            team.currentHealth = Math.max(0, team.currentHealth - healthDiff);
                            if (unit.aiId && team.ais.has(unit.aiId)) {
                                const ai = team.ais.get(unit.aiId);
                                ai.currentHealth = Math.max(0, ai.currentHealth - healthDiff);
                            }
                        }
                    }

                    if (unit.health <= 0) {
                        killUnit(unit);
                    }
                } else if (effect.healAmount) {
                    const oldHealth = unit.health;
                    unit.health = Math.min(unit.maxHealth, unit.health + effect.healAmount);

                    if (effect.pulseFx) {
                        try {
                            const pulseEffect = getEffect(effect.pulseFx);
                            if (pulseEffect) {
                                pulseEffect(unit);
                            }
                        } catch (error) {
                            console.warn(`Error applying pulse effect ${effect.pulseFx}:`, error);
                        }
                    }

                    const healthDiff = unit.health - oldHealth;
                    if (unit.teamId && healthDiff > 0) {
                        const team = teamStats.get(unit.teamId);
                        if (team) {
                            team.currentHealth = Math.min(team.totalHealth, team.currentHealth + healthDiff);
                            if (unit.aiId && team.ais.has(unit.aiId)) {
                                const ai = team.ais.get(unit.aiId);
                                ai.currentHealth = Math.min(ai.totalHealth, ai.currentHealth + healthDiff);
                            }
                        }
                    }
                }
            }
        }
    }
}

export function processEffects(target, deltaTime) {
    if (!target.activeEffects) return;

    const currentTime = Date.now();

    for (const [effectId, effect] of target.activeEffects.entries()) {
        try {
            if (!effect.startTime) {
                effect.startTime = currentTime;
                effect.lastPulse = currentTime;
            }

            if (effect.duration && effect.duration !== -1) {
                const timeRunning = (currentTime - effect.startTime) * gameSpeedFactor;

                if (timeRunning >= effect.duration) {
                    if (effect.cleanup) {
                        try {
                            effect.cleanup();
                        } catch (error) {
                            console.warn("Error executing cleanup function:", error);
                        }
                    }

                    if (effect.continuousEffect) {
                        try {
                            if (typeof effect.continuousEffect === 'function') {
                                effect.continuousEffect();
                            }
                        } catch (error) {
                            console.warn("Error cleaning up continuous effect:", error);
                        }
                    }

                    if (effect.sourceContinuousEffect) {
                        try {
                            if (typeof effect.sourceContinuousEffect === 'function') {
                                effect.sourceContinuousEffect();
                            }
                        } catch (error) {
                            console.warn("Error cleaning up source continuous effect:", error);
                        }
                    }

                    const fxSource = effect.targetFx || {};
                    if (fxSource.end) {
                        try {
                            const endEffect = getEffect(fxSource.end);
                            if (endEffect) {
                                endEffect(target);
                            }
                        } catch (error) {
                            console.warn(`Error applying end effect ${fxSource.end}:`, error);
                        }
                    }

                    const sourceFxSource = effect.sourceFx || {};
                    if (sourceFxSource.end) {
                        try {
                            const endEffect = getEffect(sourceFxSource.end);
                            if (endEffect) {
                                endEffect(target);
                            }
                        } catch (error) {
                            console.warn(`Error applying end effect ${sourceFxSource.end}:`, error);
                        }
                    }

                    target.activeEffects.delete(effectId);
                    continue;
                }
            }

            if (effect.pulseInterval && (effect.damageAmount || effect.healAmount)) {
                const timeSinceLastPulse = (currentTime - effect.lastPulse) * gameSpeedFactor;
                if (timeSinceLastPulse >= effect.pulseInterval) {
                    if (effect.damageAmount) {
                        const oldHealth = target.health;
                        target.health = Math.max(0, target.health - effect.damageAmount);

                        if (effect.pulseFx) {
                            try {
                                const pulseEffect = getEffect(effect.pulseFx);
                                if (pulseEffect) {
                                    pulseEffect(target, { damage: effect.damageAmount });
                                }
                            } catch (error) {
                                console.warn(`Error applying pulse effect ${effect.pulseFx}:`, error);
                            }
                        }

                        const healthDiff = oldHealth - target.health;
                        if (target.teamId && healthDiff > 0) {
                            const team = teamStats.get(target.teamId);
                            if (team) {
                                team.currentHealth = Math.max(0, team.currentHealth - healthDiff);
                                if (target.aiId && team.ais.has(target.aiId)) {
                                    const ai = team.ais.get(target.aiId);
                                    ai.currentHealth = Math.max(0, ai.currentHealth - healthDiff);
                                }
                            }
                        }

                        if (target.health <= 0) {
                            killUnit(target);
                            return;
                        }
                    } else if (effect.healAmount) {
                        const oldHealth = target.health;
                        target.health = Math.min(target.maxHealth, target.health + effect.healAmount);

                        if (effect.pulseFx) {
                            try {
                                const pulseEffect = getEffect(effect.pulseFx);
                                if (pulseEffect) {
                                    pulseEffect(target);
                                }
                            } catch (error) {
                                console.warn(`Error applying pulse effect ${effect.pulseFx}:`, error);
                            }
                        }

                        const healthDiff = target.health - oldHealth;
                        if (target.teamId && healthDiff > 0) {
                            const team = teamStats.get(target.teamId);
                            if (team) {
                                team.currentHealth = Math.min(team.totalHealth, team.currentHealth + healthDiff);
                                if (target.aiId && team.ais.has(target.aiId)) {
                                    const ai = team.ais.get(target.aiId);
                                    ai.currentHealth = Math.min(ai.totalHealth, ai.currentHealth + healthDiff);
                                }
                            }
                        }
                    }

                    effect.lastPulse = currentTime;
                }
            }
        } catch (error) {
            console.error('Error processing active effect:', error);
            reportRuntimeIssue(
                `runtime-effect-${effectId || 'unknown'}.json`,
                `Runtime error while processing effect '${effectId || 'unknown'}' for unit '${target?.type || 'unknown'}': ${error.message}`,
                true,
                target
            );
            if (target?.activeEffects?.has(effectId)) {
                target.activeEffects.delete(effectId);
            }
        }
    }
}

export function getModifiedStat(target, stat) {
    if (!target.activeEffects) return target[stat];

    const baseValue = target[stat];
    let value = baseValue;

    const effects = Array.from(target.activeEffects.values());

    for (const effect of effects) {
        if (effect.effectType === "MULTI_STAT" && effect.effects) {
            for (const subEffect of effect.effects) {
                if (subEffect.stat === stat) {
                    if (subEffect.value !== undefined) {
                        value += subEffect.value;
                    }
                }
            }
        } else if (effect.stat === stat && effect.value !== undefined) {
            value += effect.value;
        }
    }

    return value;
}

export async function processGameUpdates(deltaTime) {
    if (!isInitialized) return;

    const adjustedDeltaTime = deltaTime * gameSpeedFactor;

    try {
        const updateOrder = [];

        gameObjects.forEach(obj => {
            if (obj.update) {
                updateOrder.push(() => obj.update(adjustedDeltaTime));
            }
            if (obj.updateProjectiles) {
                updateOrder.push(() => obj.updateProjectiles(adjustedDeltaTime));
            }
            if (obj.updateAnimation) {
                updateOrder.push(() => obj.updateAnimation(adjustedDeltaTime));
            }
            if (obj.skills) {
                obj.skills.forEach((skill) => {
                    if (skill.update) {
                        updateOrder.push(() => skill.update(adjustedDeltaTime));
                    }
                });
            }
        });

        for (const update of updateOrder) {
            await update();
        }

        gameObjects.forEach(obj => {
            processEffects(obj, adjustedDeltaTime);
        });

        projectiles.forEach(proj => {
            if (proj.update) {
                proj.update(adjustedDeltaTime);
            }
        });

        await processTerrainEffects(adjustedDeltaTime);
    } catch (error) {
        console.error('Error in game update:', error);
    }
}
