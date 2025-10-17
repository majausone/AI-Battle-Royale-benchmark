import { gameArea, isPaused, gameIsOver, swords, getModifiedStat, getGameSpeed } from './gameState.js';
import { checkCollision, attackKewo } from './collisions.js';
import { createSword } from './render.js';
import { playAttackSound } from './audio.js';
import { getEffect } from './unitLoader.js';
import { emit, EVENTS } from './events.js';

const meleeAttacks = new WeakMap();

export function performMeleeAttack(attacker, target, unitData) {
    if (isPaused || gameIsOver) return;

    if (attacker.teamId && target.teamId && attacker.teamId === target.teamId) {
        return;
    }

    const attackerX = attacker.x + attacker.width / 2;
    const attackerY = attacker.y + attacker.height / 2;
    const targetX = target.x + target.width / 2;
    const targetY = target.y + target.height / 2;

    const sword = createSword(attackerX, attackerY, targetX, targetY, unitData.swordGraphics);
    const swordId = `sword-${Date.now()}-${Math.random()}`;
    swords.set(swordId, sword);
    
    const gameSpeed = getGameSpeed();
    const adjustedAnimTime = 400 / gameSpeed;
    const adjustedDamageTime = 200 / gameSpeed;

    setTimeout(() => {
        if (target.health > 0 && (!attacker.teamId || target.teamId !== attacker.teamId)) {
            const damage = getModifiedStat(attacker, 'damage');
            attackKewo(target, damage, attacker);
            playAttackSound(unitData);
            
            emit(attacker, EVENTS.ATTACK, { target, damage });
            
            if (unitData.effects?.attack) {
                const effect = getEffect(unitData.effects.attack);
                if (effect) {
                    effect(attacker, {x: targetX, y: targetY});
                }
            } else {
                const defaultAttack = getEffect('defaultAttack');
                if (defaultAttack) {
                    defaultAttack(attacker, {x: targetX, y: targetY});
                }
            }
        }
    }, adjustedDamageTime);

    let attackState = meleeAttacks.get(attacker) || [];
    attackState.push({ sword, timestamp: Date.now() });
    meleeAttacks.set(attacker, attackState);
    
    setTimeout(() => {
        swords.delete(swordId);
        const currentAttacks = meleeAttacks.get(attacker);
        if (currentAttacks) {
            const index = currentAttacks.findIndex(attack => attack.sword === sword);
            if (index !== -1) {
                currentAttacks.splice(index, 1);
                if (currentAttacks.length === 0) {
                    meleeAttacks.delete(attacker);
                }
            }
        }
    }, adjustedAnimTime);
}

export function clearCharacterAttacks(character) {
    const attackState = meleeAttacks.get(character);
    if (attackState) {
        attackState.forEach(attack => {
            for (let [id, sword] of swords.entries()) {
                if (sword === attack.sword) {
                    swords.delete(id);
                }
            }
        });
        meleeAttacks.delete(character);
    }
}

export function clearAllMeleeAttacks() {
    swords.clear();
    for (const [character, attacks] of meleeAttacks.entries()) {
        meleeAttacks.delete(character);
    }
}