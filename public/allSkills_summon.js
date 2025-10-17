import { SkillManager } from './allSkills_base.js';

SkillManager.prototype.validateSummonSkill = function(skill) {
    const { metadata } = skill;
    
    this.validateProperty(skill, 'summonProperties', true, true);
    
    this.validateProperty(skill, 'seffects', false);
    this.validateProperty(skill, 'graphics', false);
    this.validateProperty(skill, 'targetSelection', false);
    this.validateProperty(skill, 'projectileConfig', false);
    this.validateProperty(skill, 'target', false);
    
    this.validateFx(skill, 'end', false);
    this.validateFx(skill, 'impact', false);
    
    if (!metadata.summonProperties) {
        this.reportIssue(skill, `Error: SUMMON skill '${skill.id}' missing required 'summonProperties' property.`, true);
        return;
    }
    
    const summonProps = metadata.summonProperties;
    
    if (!summonProps.summonCount) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' missing 'summonCount' in summonProperties.`);
    }
    
    if (summonProps.summonDuration !== undefined && summonProps.summonDuration !== -1 && summonProps.summonDuration < 1000) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' has summonDuration less than 1000ms which may be too short.`);
    }
    
    if (!summonProps.health && !summonProps.inheritHealth) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' should define either 'health' or 'inheritHealth' in summonProperties.`);
    }
    
    if (summonProps.damage === null) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' has 'damage: null' which is invalid. Use a numeric value or 'inheritDamage: true' instead.`);
    }
    
    if (summonProps.damage === undefined && !summonProps.inheritDamage) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' should define either 'damage' (numeric value) or 'inheritDamage: true' in summonProperties.`);
    }
    
    if (!summonProps.speed && !summonProps.inheritSpeed) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' should define either 'speed' or 'inheritSpeed' in summonProperties.`);
    }
    
    if (!summonProps.graphics && !summonProps.inheritGraphics) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' should define either 'graphics' or 'inheritGraphics' in summonProperties.`);
    }
    
    if (summonProps.attackType) {
        if (summonProps.attackType !== 'melee' && summonProps.attackType !== 'ranged') {
            this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' has invalid attackType '${summonProps.attackType}'. Must be 'melee' or 'ranged'.`);
        }
        
        if (summonProps.attackType === 'melee' && !summonProps.attackRange) {
            this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' has attackType 'melee' but missing required 'attackRange' in summonProperties.`);
        }
        
        if (summonProps.attackType === 'ranged' && !summonProps.optimalRange) {
            this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' has attackType 'ranged' but missing required 'optimalRange' in summonProperties.`);
        }
    } else if (!summonProps.inheritAttack) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' should define either valid 'attackType' or 'inheritAttack' in summonProperties.`);
    }
    
    if (!metadata.trigger || 
        !(metadata.trigger.onAttack || 
          metadata.trigger.onAttackOnce || 
          metadata.trigger.onGetAttacked || 
          metadata.trigger.onDeath || 
          metadata.trigger.onSpawn || 
          metadata.trigger.interval || 
          metadata.trigger.healthThreshold)) {
        this.reportIssue(skill, `Warning: SUMMON skill '${skill.id}' does not have any activation trigger.`);
    }
};

SkillManager.prototype.createSummonedUnit = async function(unit, summonConfig, position) {
    const { 
        drawPixelArt, 
        moveCharacter, 
        addGameObject,
        applyFX,
        gameObjects,
        getGameSpeed,
        getUnitData
    } = await import('./baseSkill.js');
    
    const summonProps = summonConfig.summonProperties || {};
    
    let summonGraphics = summonProps.graphics;
    if (!summonGraphics && summonProps.inheritGraphics) {
        summonGraphics = unit.graphics;
    }
    
    const summonScale = summonProps.scale || unit.scale;
    
    const summon = drawPixelArt(summonGraphics, summonScale, position.x, position.y);
    
    let summonType = unit.type;
    if (!summonProps.inheritType) {
        summonType = 'summon';
    }
    
    let health = unit.health / 2;
    if (summonProps.health !== null && summonProps.health !== undefined) {
        health = summonProps.health;
    } else if (summonProps.inheritHealth) {
        health = unit.health;
    }
    
    let summonDamage = unit.damage / 2;
    if (summonProps.damage !== null && summonProps.damage !== undefined) {
        summonDamage = summonProps.damage;
    } else if (summonProps.inheritDamage) {
        summonDamage = unit.damage;
    }
    
    let summonSpeed = unit.speed;
    if (summonProps.speed !== null && summonProps.speed !== undefined) {
        summonSpeed = summonProps.speed;
    } else if (summonProps.inheritSpeed) {
        summonSpeed = unit.speed;
    }
    
    Object.assign(summon, {
        id: summonConfig.id,
        type: summonType,
        health: health,
        maxHealth: health,
        damage: summonDamage,
        speed: summonSpeed,
        scale: summonScale,
        teamId: unit.teamId,
        aiId: unit.aiId,
        activeEffects: new Map(),
        skills: new Map(),
        effectCleanups: []
    });
   
    let attackConfig;
    
    if (summonProps.inheritAttack && unit.type) {
        const unitData = getUnitData(unit.type);
        if (unitData) {
            attackConfig = {
                attackType: unitData.attackType,
                scale: summonScale,
                damage: summon.damage,
                speed: summon.speed
            };
            
            if (unitData.attackType === 'melee') {
                attackConfig.attackRange = unitData.attackRange;
                attackConfig.attackSpeed = unitData.attackSpeed;
                attackConfig.swordGraphics = unitData.swordGraphics;
            } else if (unitData.attackType === 'ranged') {
                attackConfig.optimalRange = unitData.optimalRange;
                attackConfig.projectileSpeed = unitData.projectileSpeed;
                attackConfig.attackInterval = unitData.attackInterval;
                attackConfig.projectileColor = unitData.projectileColor;
                attackConfig.projectileTrailColor = unitData.projectileTrailColor;
            }
        }
    } else if (summonProps.attackType) {
        attackConfig = {
            attackType: summonProps.attackType,
            scale: summonScale,
            damage: summon.damage,
            speed: summon.speed
        };
        
        if (summonProps.attackType === 'melee') {
            attackConfig.attackRange = summonProps.attackRange || 50;
            attackConfig.attackSpeed = summonProps.attackSpeed || 1000;
            attackConfig.swordGraphics = summonProps.swordGraphics || {
                width: 30,
                height: 3,
                color: '#808080'
            };
        } else if (summonProps.attackType === 'ranged') {
            attackConfig.optimalRange = summonProps.optimalRange || 200;
            attackConfig.projectileSpeed = summonProps.projectileSpeed || 5;
            attackConfig.attackInterval = summonProps.attackInterval || {
                min: 2000,
                max: 3000
            };
            attackConfig.projectileColor = summonProps.projectileColor || '#808080';
            attackConfig.projectileTrailColor = summonProps.projectileTrailColor || '#808080';
        }
    }
    
    if (attackConfig) {
        moveCharacter(summon, attackConfig);
    }
    
    addGameObject(summon.id, summon);
    
    const fx = summonProps.fx || {};
    if (fx.start) {
        applyFX(fx.start, summon);
    }
    
    if (fx.continuous) {
        setTimeout(() => {
            if (gameObjects.has(summon.id)) {
                const cleanupFn = applyFX(fx.continuous, summon);
                if (typeof cleanupFn === 'function') {
                    summon.effectCleanups.push(cleanupFn);
                } else if (cleanupFn && typeof cleanupFn.then === 'function') {
                    cleanupFn.then(fn => {
                        if (typeof fn === 'function') {
                            summon.effectCleanups.push(fn);
                        }
                    }).catch(error => {
                        console.warn("Error in cleanup promise:", error);
                    });
                }
            }
        }, 100);
    }
    
    const duration = summonProps.summonDuration || -1;
    if (duration > 0) {
        const gameSpeed = getGameSpeed();
        setTimeout(() => {
            if (gameObjects.has(summon.id)) {
                summon.effectCleanups.forEach(cleanup => {
                    if (typeof cleanup === 'function') {
                        try {
                            cleanup();
                        } catch (error) {
                            console.warn("Error executing cleanup function:", error);
                        }
                    }
                });
                
                gameObjects.delete(summon.id);
            }
        }, duration / gameSpeed);
    }
    
    return summon;
};

SkillManager.prototype.findValidSummonPosition = async function(unit, minDistance = 20, maxDistance = 50) {
    const { getBattleAreaBounds } = await import('./baseSkill.js');
    
    const bounds = getBattleAreaBounds();
    const margin = 30; 
    
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    
    let summonX = unit.x + Math.cos(angle) * distance;
    let summonY = unit.y + Math.sin(angle) * distance;
    
    summonX = Math.max(bounds.left + margin, Math.min(summonX, bounds.right - margin - 40));
    summonY = Math.max(bounds.top + margin, Math.min(summonY, bounds.bottom - margin - 40));
    
    return { x: summonX, y: summonY };
};

SkillManager.prototype.findValidAngleSummonPosition = async function(unit, angle, minDistance = 20, maxDistance = 50) {
    const { getBattleAreaBounds } = await import('./baseSkill.js');
    
    const bounds = getBattleAreaBounds();
    const margin = 30; 
    
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    
    let summonX = unit.x + Math.cos(angle) * distance;
    let summonY = unit.y + Math.sin(angle) * distance;
    
    summonX = Math.max(bounds.left + margin, Math.min(summonX, bounds.right - margin - 40));
    summonY = Math.max(bounds.top + margin, Math.min(summonY, bounds.bottom - margin - 40));
    
    return { x: summonX, y: summonY };
};

SkillManager.prototype.createMultipleSummons = async function(unit, skill, nextEntityId = 0) {
    const { playSkillStartSound, applyFX, killUnit, getGameSpeed } = await import('./baseSkill.js');

    if (skill.metadata.sounds) {
        playSkillStartSound(skill.metadata.sounds);
    }
    
    if (skill.metadata.fx && skill.metadata.fx.start) {
        applyFX(skill.metadata.fx.start, unit);
    }
    
    const summonProps = skill.metadata.summonProperties || {};
    const spawnCount = summonProps.summonCount || 1;
    const summonedUnits = [];
    const baseId = `summon-${unit.id}-${nextEntityId}`;
    
    for (let i = 0; i < spawnCount; i++) {
        let position;
        if (skill.metadata.trigger && skill.metadata.trigger.onDeath) {
            const angle = (i * Math.PI) + (Math.random() * 0.5);
            position = await this.findValidAngleSummonPosition(unit, angle, 20, 40);
        } else {
            position = await this.findValidSummonPosition(unit, 40, 70);
        }
        
        const summonId = `${baseId}-${i}`;
        
        const summonConfig = {
            id: summonId,
            summonProperties: skill.metadata.summonProperties
        };
        
        const summon = await this.createSummonedUnit(unit, summonConfig, position);
        summonedUnits.push(summon);
    }
    
    if (skill.metadata.suicide) {
        const gameSpeed = getGameSpeed();
        const suicideDelay = typeof skill.metadata.suicide === 'number' ? skill.metadata.suicide / gameSpeed : 100 / gameSpeed;
        setTimeout(() => {
            killUnit(unit);
        }, suicideDelay);
    }
    
    return summonedUnits;
};

SkillManager.prototype.applySummonSkill = async function(skill, unit) {
    this.validateSummonSkill(skill);
    
    const { 
        isPaused, 
        gameIsOver, 
        registerSkill, 
        on,
        EVENTS,
        getGameSpeed,
        killUnit
    } = await import('./baseSkill.js');
    
    let lastSummonTime = Date.now();
    let nextEntityId = 0;
    let hasTriggeredOnce = false;
    let healthThresholdTriggered = false;
    
    if (skill.metadata.trigger && skill.metadata.trigger.onDeath) {
        on(unit, EVENTS.DEATH, async () => {
            await this.createMultipleSummons(unit, skill, nextEntityId++);
        });
    }
    
    const summonUnits = async () => {
        if (isPaused || gameIsOver || !unit || unit.health <= 0) return;
        
        await this.createMultipleSummons(unit, skill, nextEntityId++);
        lastSummonTime = Date.now();
    };
    
    if (skill.metadata.trigger && skill.metadata.trigger.onSpawn) {
        summonUnits();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
        on(unit, EVENTS.DAMAGE_RECEIVED, async () => {
            await summonUnits();
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
        on(unit, EVENTS.ATTACK, async () => {
            await summonUnits();
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttackOnce) {
        on(unit, EVENTS.ATTACK, async () => {
            if (!hasTriggeredOnce) {
                hasTriggeredOnce = true;
                await summonUnits();
            }
        });
    }
    
    const updateSummon = async (deltaTime) => {
        if (isPaused || gameIsOver || !unit || unit.health <= 0) return;
        
        if (skill.metadata.trigger && skill.metadata.trigger.onDeath) {
            return;
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
            return;
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.onAttackOnce) {
            return;
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
            return;
        }
        
        const currentTime = Date.now();
        const gameSpeed = getGameSpeed();
        
        if (skill.metadata.trigger && skill.metadata.trigger.healthThreshold) {
            const healthPercent = unit.health / unit.maxHealth;
            if (healthPercent <= skill.metadata.trigger.healthThreshold && !healthThresholdTriggered) {
                healthThresholdTriggered = true;
                await summonUnits();
                return;
            }
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.interval && 
            healthThresholdTriggered && 
            currentTime - lastSummonTime >= skill.metadata.trigger.interval / gameSpeed) {
            if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                await summonUnits();
            }
            return;
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.interval && 
            !skill.metadata.trigger.healthThreshold &&
            currentTime - lastSummonTime >= skill.metadata.trigger.interval / gameSpeed) {
            
            if (skill.metadata.trigger.chance && Math.random() > skill.metadata.trigger.chance) {
                lastSummonTime = currentTime;
                return;
            }
            
            await summonUnits();
        }
    };
    
    registerSkill(unit.id, skill.id, updateSummon.bind(this));
};

export {};