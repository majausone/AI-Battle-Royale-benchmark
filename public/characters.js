import { gameArea, isPaused, gameIsOver, addGameObject, gameObjects, isPositionInBounds, getBattleAreaBounds, getSpawnPoint } from './gameState.js';
import { drawPixelArt } from './render.js';
import { moveCharacter } from './characterMovement.js';
import { playSpawnSound } from './audio.js';
import { getUnitData, getSkill, getEffect } from './unitLoader.js';
import { applyFX } from './baseSkill.js';

let nextId = 0;

export function clearAllCharacters() {
    gameObjects.clear();
}

function findValidSpawnPosition(spawnPoint, unitWidth, unitHeight, spawnRadius) {
    const bounds = getBattleAreaBounds();
    const maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * spawnRadius;
        const x = spawnPoint.x + radius * Math.cos(angle);
        const y = spawnPoint.y + radius * Math.sin(angle);

        if (isPositionInBounds(x, y, unitWidth, unitHeight)) {
            let isValid = true;

            gameObjects.forEach(obj => {
                const dx = x - obj.x;
                const dy = y - obj.y;
                const minDistance = 30;
                if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
                    isValid = false;
                }
            });

            if (isValid) {
                return { x, y };
            }
        }
        attempts++;
    }

    return { x: spawnPoint.x, y: spawnPoint.y };
}

function getTeamSpawnPosition(teamId) {
    const spawnPoint = getSpawnPoint(teamId);
    if (!spawnPoint) {
        const bounds = getBattleAreaBounds();
        return {
            x: bounds.left + (bounds.right - bounds.left) / 2,
            y: bounds.top + (bounds.bottom - bounds.top) / 2
        };
    }
    return spawnPoint;
}

export async function spawnUnit(unitId, teamId = null, aiId = null, position = null, parentUnit = null) {
    if (isPaused || gameIsOver) return;

    const unitData = getUnitData(unitId);
    if (!unitData) {
        console.error(`No se encontraron datos para la unidad: ${unitId}`);
        return;
    }

    const effectiveTeamId = parentUnit ? parentUnit.teamId : teamId;
    const unitWidth = unitData.graphics[0].length * unitData.scale;
    const unitHeight = unitData.graphics.length * unitData.scale;

    let spawnPos;
    if (position) {
        spawnPos = position;
    } else {
        const spawnPoint = getTeamSpawnPosition(effectiveTeamId);
        const spawnRadius = Math.min(gameArea.offsetWidth, gameArea.offsetHeight) * 0.05;
        spawnPos = findValidSpawnPosition(spawnPoint, unitWidth, unitHeight, spawnRadius);
    }

    const id = `unit-${nextId++}`;

    const unit = {
        ...drawPixelArt(unitData.graphics, unitData.scale, spawnPos.x, spawnPos.y),
        type: unitId,
        id: id,
        health: unitData.life,
        maxHealth: unitData.life,
        speed: unitData.speed,
        damage: unitData.damage,
        scale: unitData.scale,
        width: unitWidth,
        height: unitHeight,
        graphics: unitData.graphics,
        teamId: effectiveTeamId,
        aiId: parentUnit ? parentUnit.aiId : aiId,
        activeEffects: new Map()
    };

    addGameObject(id, unit);
    moveCharacter(unit, unitData);
    playSpawnSound(unitData);

    if (!unit.effects) {
        unit.effects = [];
    }

    if (unitData.effects?.spawn) {
        const effect = getEffect(unitData.effects.spawn);
        if (effect) {
            effect(unit);
        }
    } else {
        const defaultSpawn = getEffect('defaultSpawn');
        if (defaultSpawn) {
            defaultSpawn(unit);
        }
    }

    if (unitData.effects?.continuous) {
        const effect = getEffect(unitData.effects.continuous);
        if (effect) {
            const cleanup = effect(unit);
            if (cleanup) {
                unit.effects.push(cleanup);
            }
        }
    }

    if (unitData.skills) {
        for (const skillName of unitData.skills) {
            const skill = getSkill(skillName);
            if (skill) {
                await skill.apply(unit);
            }
        }
    }

    return unit;
}

export function resumeAllCharacters() {
    gameObjects.forEach(obj => {
        if (obj.type) {
            const unitData = getUnitData(obj.type);
            if (unitData && unitData.skills) {
                for (const skillName of unitData.skills) {
                    const skill = getSkill(skillName);
                    if (skill && skill.resume) {
                        skill.resume(obj);
                    }
                }
            }
        }
    });
}