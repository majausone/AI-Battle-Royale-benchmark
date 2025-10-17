import { gameArea, isPaused, gameIsOver, gameObjects, getModifiedStat, getBattleAreaBounds, isPositionInBounds, getGameSpeed } from './gameState.js';
import { createTrail } from './render.js';
import { performMeleeAttack } from './meleeAttack.js';
import { startProjectileAttack } from './projectiles.js';
import { getEffect } from './unitLoader.js';

export function moveCharacter(character, unitData) {
    const isMeleeCharacter = unitData.attackType === 'melee';
    const state = {
        dx: 0,
        dy: 0,
        lastAttackTime: 0,
        isMeleeCharacter
    };

    character.moveState = state;

    if (unitData.effects?.continuous) {
        const effect = getEffect(unitData.effects.continuous);
        if (effect) {
            const cleanup = effect(character);
            if (typeof cleanup === 'function') {
                const originalCleanup = character.cleanupEffects || (() => {});
                character.cleanupEffects = () => {
                    originalCleanup();
                    cleanup();
                };
            }
        }
    }

    if (unitData.attackType === 'ranged') {
        startProjectileAttack(character, unitData);
    }

    character.update = function(deltaTime) {
        if (!gameObjects.has(character.id)) {
            if (character.cleanupEffects) {
                character.cleanupEffects();
            }
            return;
        }

        let x = character.x;
        let y = character.y;
        const width = character.width;
        const height = character.height;

        const currentTime = Date.now();
        const gameSpeed = getGameSpeed();

        let nearestTarget = null;
        let minDistance = Infinity;

        gameObjects.forEach(obj => {
            if (obj.id !== character.id && (!character.teamId || obj.teamId !== character.teamId)) {
                const dx = obj.x - x;
                const dy = obj.y - y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestTarget = obj;
                }
            }
        });

        if (nearestTarget) {
            const dirX = nearestTarget.x - x;
            const dirY = nearestTarget.y - y;
            const distance = Math.sqrt(dirX * dirX + dirY * dirY);
            const speed = getModifiedStat(character, 'speed');

            if (state.isMeleeCharacter) {
                if (distance <= unitData.attackRange) {
                    if (currentTime - state.lastAttackTime >= unitData.attackSpeed / gameSpeed) {
                        performMeleeAttack(character, nearestTarget, unitData);
                        state.lastAttackTime = currentTime;
                    }
                    state.dx = 0;
                    state.dy = 0;
                } else {
                    state.dx = (dirX / distance) * speed;
                    state.dy = (dirY / distance) * speed;
                }
            } else {
                if (distance < unitData.optimalRange - 50) {
                    state.dx = (-dirX / distance) * speed;
                    state.dy = (-dirY / distance) * speed;
                } else if (distance > unitData.optimalRange + 50) {
                    state.dx = (dirX / distance) * speed;
                    state.dy = (dirY / distance) * speed;
                } else {
                    state.dx = 0;
                    state.dy = 0;
                }
            }
        } else {
            if (Math.random() < 0.02) {
                state.dx = (Math.random() - 0.5) * character.speed;
                state.dy = (Math.random() - 0.5) * character.speed;
            }
        }

        const vibration = (Math.random() - 0.5) * 2;
        y += vibration;

        const nextX = x + state.dx * (deltaTime / 16);
        const nextY = y + state.dy * (deltaTime / 16);

        const bounds = getBattleAreaBounds();
        x = Math.max(bounds.left, Math.min(nextX, bounds.right - width));
        y = Math.max(bounds.top, Math.min(nextY, bounds.bottom - height));

        if (nextX < bounds.left || nextX + width > bounds.right) state.dx = -state.dx;
        if (nextY < bounds.top || nextY + height > bounds.bottom) state.dy = -state.dy;

        character.x = x;
        character.y = y;

        if (unitData.showTrail) {
            createTrail(x, y, unitData.trailColor || 'blue');
        }
    };
}

export function clearAllMovements() {
    gameObjects.forEach(obj => {
        if (obj.moveState) {
            obj.moveState = null;
        }
        if (obj.cleanupEffects) {
            obj.cleanupEffects();
            obj.cleanupEffects = null;
        }
    });
}