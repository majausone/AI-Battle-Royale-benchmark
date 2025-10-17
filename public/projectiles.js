import { gameArea, isPaused, gameIsOver, projectiles, gameObjects, getModifiedStat, getBattleAreaBounds, isPositionInBounds, getGameSpeed } from './gameState.js';
import { checkCollision, attackKewo } from './collisions.js';
import { createTrail, createProjectile, removeProjectile } from './render.js';
import { playAttackSound, playProjectileImpactSound } from './audio.js';
import { getUnitData, getEffect } from './unitLoader.js';
import { emit, EVENTS } from './events.js';

export function startProjectileAttack(unit, unitData) {
    if (!unitData) return;

    unit.projectileState = {
        lastShot: Date.now(),
        interval: Math.random() * (unitData.attackInterval.max - unitData.attackInterval.min) + unitData.attackInterval.min
    };

    unit.updateProjectiles = function(deltaTime) {
        if (!gameObjects.has(unit.id)) return;

        const now = Date.now();
        const gameSpeed = getGameSpeed();
        const timeSinceLastShot = (now - unit.projectileState.lastShot) * gameSpeed;

        if (timeSinceLastShot >= unit.projectileState.interval) {
            shootProjectile(unit, unitData);
            unit.projectileState.lastShot = now;
            unit.projectileState.interval = Math.random() * (unitData.attackInterval.max - unitData.attackInterval.min) + unitData.attackInterval.min;
        }
    };
}

function shootProjectile(unit, unitData) {
    const startX = unit.x + unit.width / 2;
    const startY = unit.y + unit.height / 2;
    
    const projectile = createProjectile(startX, startY, 8, 8, unitData.projectileColor);
    projectile.sourceTeamId = unit.teamId;
    const projectileId = `projectile-${Date.now()}-${Math.random()}`;
    projectiles.set(projectileId, projectile);

    let nearestTarget = null;
    let minDistance = Infinity;

    gameObjects.forEach(obj => {
        if (obj.id !== unit.id && (!unit.teamId || obj.teamId !== unit.teamId)) {
            const dx = obj.x - unit.x;
            const dy = obj.y - unit.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance) {
                minDistance = distance;
                nearestTarget = obj;
            }
        }
    });

    if (!nearestTarget) {
        removeProjectile(projectile);
        projectiles.delete(projectileId);
        return;
    }

    const dx = nearestTarget.x + nearestTarget.width/2 - startX;
    const dy = nearestTarget.y + nearestTarget.height/2 - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const vx = (dx / distance) * unitData.projectileSpeed;
    const vy = (dy / distance) * unitData.projectileSpeed;

    playAttackSound(unitData);
    
    emit(unit, EVENTS.ATTACK, { target: nearestTarget });

    if (unitData.effects?.attack) {
        const effect = getEffect(unitData.effects.attack);
        if (effect) {
            effect(unit, {x: startX, y: startY});
        }
    } else {
        const defaultAttack = getEffect('defaultAttack');
        if (defaultAttack) {
            defaultAttack(unit, {x: startX, y: startY});
        }
    }

    projectile.update = function(deltaTime) {
        if (!projectile.active) {
            projectiles.delete(projectileId);
            return;
        }

        const nextX = projectile.x + vx * (deltaTime / 16);
        const nextY = projectile.y + vy * (deltaTime / 16);

        if (!isPositionInBounds(nextX, nextY, projectile.width, projectile.height)) {
            removeProjectile(projectile);
            projectiles.delete(projectileId);
            return;
        }

        projectile.x = nextX;
        projectile.y = nextY;

        if (unitData.projectileTrailColor) {
            createTrail(projectile.x, projectile.y, unitData.projectileTrailColor);
        }

        let hasCollided = false;
        gameObjects.forEach(target => {
            if (!hasCollided && 
                target.id !== unit.id && 
                (!unit.teamId || target.teamId !== unit.teamId) && 
                checkCollision(projectile, target)) {
                const damage = getModifiedStat(unit, 'damage');
                attackKewo(target, damage, unit);
                playProjectileImpactSound();
                removeProjectile(projectile);
                projectiles.delete(projectileId);
                hasCollided = true;
            }
        });
    };
}

export function clearAllProjectileAttacks() {
    projectiles.clear();
    gameObjects.forEach(obj => {
        if (obj.projectileState) {
            obj.projectileState = null;
            obj.updateProjectiles = null;
        }
    });
}