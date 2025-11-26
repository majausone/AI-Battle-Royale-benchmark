import { gameArea, isPaused, gameIsOver, addGameObject, gameObjects, isPositionInBounds, getBattleAreaBounds, getSpawnPoint } from './gameState.js';
import { drawPixelArt } from './render.js';
import { moveCharacter } from './characterMovement.js';
import { playSpawnSound } from './audio.js';
import { getUnitData, getSkill, getEffect } from './unitLoader.js';
import { applyFX } from './baseSkill.js';
import { on, EVENTS } from './events.js';

let nextId = 0;

export function clearAllCharacters() {
    gameObjects.clear();
}

function isValidFrame(frame, width, height) {
    return Array.isArray(frame) &&
        frame.length === height &&
        frame.every(row => Array.isArray(row) && row.length === width);
}

function getAnimationFrames(unitData) {
    const baseFrame = Array.isArray(unitData.graphics) && unitData.graphics.length > 0
        ? unitData.graphics
        : [[null]];

    const frameWidth = Array.isArray(baseFrame[0]) ? baseFrame[0].length : 1;
    const frameHeight = baseFrame.length;

    const normalize = (frame) => isValidFrame(frame, frameWidth, frameHeight) ? frame : baseFrame;

    const move1 = normalize(unitData.animationGraphics?.move1);
    const move2 = normalize(unitData.animationGraphics?.move2);
    const attackFrame = normalize(unitData.animationGraphics?.attack);

    return {
        baseFrame,
        moveFrames: [baseFrame, move1, move2],
        attackFrame
    };
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

    const { baseFrame, moveFrames, attackFrame } = getAnimationFrames(unitData);

    const effectiveTeamId = parentUnit ? parentUnit.teamId : teamId;
    const unitWidth = baseFrame[0].length * unitData.scale;
    const unitHeight = baseFrame.length * unitData.scale;

    let spawnPos;
    if (position) {
        spawnPos = position;
    } else {
        const spawnPoint = getTeamSpawnPosition(effectiveTeamId);
        const spawnRadius = Math.min(gameArea.offsetWidth, gameArea.offsetHeight) * 0.05;
        spawnPos = findValidSpawnPosition(spawnPoint, unitWidth, unitHeight, spawnRadius);
    }

    const id = `unit-${nextId++}`;

    const initialSprite = drawPixelArt(baseFrame, unitData.scale, spawnPos.x, spawnPos.y);
    const animationKeys = moveFrames.map((frame, index) => {
        if (index === 0) return initialSprite.key;
        return drawPixelArt(frame, unitData.scale, spawnPos.x, spawnPos.y).key;
    });
    const attackKey = attackFrame === baseFrame
        ? initialSprite.key
        : drawPixelArt(attackFrame, unitData.scale, spawnPos.x, spawnPos.y).key;

    const unit = {
        ...initialSprite,
        type: unitId,
        id: id,
        health: unitData.life,
        maxHealth: unitData.life,
        speed: unitData.speed,
        damage: unitData.damage,
        scale: unitData.scale,
        width: unitWidth,
        height: unitHeight,
        graphics: baseFrame,
        teamId: effectiveTeamId,
        aiId: parentUnit ? parentUnit.aiId : aiId,
        activeEffects: new Map(),
        animationState: {
            moveKeys: animationKeys,
            attackKey,
            attackTimer: 0,
            frameTimer: 0,
            frameDuration: 200,
            currentIndex: 0
        }
    };

    addGameObject(id, unit);

    unit.updateAnimation = function(deltaTime) {
        if (!this.animationState || this.animationState.moveKeys.length === 0) return;

        if (this.animationState.attackTimer > 0) {
            this.animationState.attackTimer = Math.max(0, this.animationState.attackTimer - deltaTime);
            this.key = this.animationState.attackKey;
            return;
        }

        this.animationState.frameTimer += deltaTime;
        if (this.animationState.frameTimer >= this.animationState.frameDuration) {
            this.animationState.frameTimer = 0;
            this.animationState.currentIndex = (this.animationState.currentIndex + 1) % this.animationState.moveKeys.length;
            this.key = this.animationState.moveKeys[this.animationState.currentIndex];
        }
    };

    unit.triggerAttackAnimation = function() {
        if (!this.animationState) return;
        this.animationState.attackTimer = 1000;
        this.animationState.frameTimer = 0;
        this.key = this.animationState.attackKey;
    };

    on(unit, EVENTS.ATTACK, () => unit.triggerAttackAnimation());

    moveCharacter(unit, unitData);
    playSpawnSound(unitData, {
        aiId: unit.aiId,
        teamId: unit.teamId,
        unitType: unit.type
    });

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
