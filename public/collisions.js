import { emit, EVENTS } from './events.js';
import { playDeathSound } from './audio.js';
import { removeGameObject, gameObjects, teamStats, killUnit } from './gameState.js';
import { getUnitData, getEffect } from './unitLoader.js';

export function checkCollision(obj1, obj2) {
    if (obj1.teamId && obj2.teamId && obj1.teamId === obj2.teamId) {
        return false;
    }

    if (obj1.sourceTeamId && obj1.sourceTeamId === obj2.teamId) {
        return false;
    }

    if (obj2.sourceTeamId && obj2.sourceTeamId === obj1.teamId) {
        return false;
    }

    return !(
        obj1.x >= obj2.x + obj2.width ||
        obj1.x + obj1.width <= obj2.x ||
        obj1.y >= obj2.y + obj2.height ||
        obj1.y + obj1.height <= obj2.y
    );
}

export function attackKewo(target, damage, attacker = null, canDamageAllies = false) {
    if (!target || target.health <= 0) return;

    if (attacker && attacker.teamId && target.teamId && attacker.teamId === target.teamId && !canDamageAllies) {
        return;
    }

    const damageData = { damage, target, attacker };
    emit(target, EVENTS.DAMAGE_RECEIVED, damageData);
    damage = damageData.damage;

    if (target.activeEffects) {
        for (const effect of target.activeEffects.values()) {
            if (effect.shieldAmount) {
                damage = Math.max(1, damage - effect.shieldAmount);
            } else if (effect.effectType === "MULTI_STAT" && effect.effects) {
                for (const subEffect of effect.effects) {
                    if (subEffect.shieldAmount) {
                        damage = Math.max(1, damage - subEffect.shieldAmount);
                    }
                }
            }
        }
    }

    const previousHealth = target.health;
    const newHealth = Math.max(0, previousHealth - damage);
    target.health = newHealth;

    if (target.teamId) {
        const team = teamStats.get(target.teamId);
        if (team) {
            team.currentHealth = Math.max(0, team.currentHealth - (previousHealth - newHealth));
            if (target.aiId && team.ais.has(target.aiId)) {
                const ai = team.ais.get(target.aiId);
                ai.currentHealth = Math.max(0, ai.currentHealth - (previousHealth - newHealth));
            }
        }
    }

    const unitData = getUnitData(target.type);

    if (newHealth <= 0) {
        killUnit(target);
        return;
    }

    if (unitData?.effects?.damage) {
        const effect = getEffect(unitData.effects.damage);
        if (effect) {
            effect(target, { damage });
        }
    } else {
        const defaultDamage = getEffect('damageEffect');
        if (defaultDamage) {
            defaultDamage(target, { damage });
        }
    }
}

export function getAlliesInRange(unit, range) {
    return Array.from(gameObjects.values()).filter(obj => {
        if (obj.id === unit.id) return false;
        if (!unit.teamId || obj.teamId !== unit.teamId) return false;
        
        const dx = obj.x - unit.x;
        const dy = obj.y - unit.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance <= range;
    });
}

export function getEnemiesInRange(unit, range) {
    return Array.from(gameObjects.values()).filter(obj => {
        if (obj.id === unit.id) return false;
        if (unit.teamId && obj.teamId && obj.teamId === unit.teamId) return false;
        
        const dx = obj.x - unit.x;
        const dy = obj.y - unit.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance <= range;
    });
}

export function getUnitsInRange(unit, range) {
    return Array.from(gameObjects.values()).filter(obj => {
        if (obj.id === unit.id) return false;
        
        const dx = obj.x - unit.x;
        const dy = obj.y - unit.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance <= range;
    });
}