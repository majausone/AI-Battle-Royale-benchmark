import { SkillManager } from './allSkills_base.js';

SkillManager.prototype.validateBuffSkill = function(skill) {
    const { metadata } = skill;
    
    this.validateProperty(skill, 'seffects', true, true);
    
    this.validateProperty(skill, 'graphics', false);
    this.validateProperty(skill, 'targetSelection', false);
    this.validateProperty(skill, 'projectileConfig', false);
    this.validateProperty(skill, 'target', false);
    this.validateProperty(skill, 'summonProperties', false);
    
    this.validateTrigger(skill, 'onDeath', false);
    this.validateTrigger(skill, 'duration', false);
    
    this.validateFx(skill, 'start', false);
    this.validateFx(skill, 'end', false);
    this.validateFx(skill, 'continuous', false);
    this.validateFx(skill, 'impact', false);
    
    if (!metadata.trigger || 
        !(metadata.trigger.onAttack || 
          metadata.trigger.onAttackOnce || 
          metadata.trigger.onGetAttacked || 
          metadata.trigger.onSpawn || 
          metadata.trigger.interval || 
          metadata.trigger.healthThreshold)) {
        this.reportIssue(skill, `Warning: BUFF skill '${skill.id}' does not have any activation trigger.`);
    }
};

SkillManager.prototype.applyBuffSkill = async function(skill, unit) {
    this.validateBuffSkill(skill);
    
    const { 
        getSkillEffect, 
        applySkillEffect, 
        isPaused, 
        gameIsOver, 
        registerSkill, 
        playSkillStartSound,
        playSkillEndSound,
        on,
        EVENTS,
        getEffect,
        removeEffect,
        gameObjects,
        getGameSpeed,
        killUnit
    } = await import('./baseSkill.js');
    
    if (skill.metadata.fx) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type BUFF but uses 'fx' directly. FX should be handled by seffects and will be ignored.`);
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.duration) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type BUFF but uses 'trigger.duration' directly. Duration should be handled by seffects and will be ignored.`);
    }
    
    let isActive = false;
    let lastTriggerTime = 0;
    let hasTriggeredOnce = false;
    let healthThresholdTriggered = false;
    
    const effect = skill.metadata.seffects ? await getSkillEffect(skill.metadata.seffects) : null;
    
    if (!effect) {
        this.reportIssue(skill, `Error: BUFF skill '${skill.id}' has no associated effect defined.`, true);
        return;
    }

    function activateBuff() {
        if (isActive) return;
        
        isActive = true;
        
        if (skill.metadata.sounds) {
            playSkillStartSound(skill.metadata.sounds);
        }
        
        if (effect) {
            applySkillEffect(unit, skill.metadata.seffects, effect, true);
        }
        
        if (skill.metadata.suicide) {
            const gameSpeed = getGameSpeed();
            const suicideDelay = typeof skill.metadata.suicide === 'number' ? skill.metadata.suicide / gameSpeed : 500 / gameSpeed;
            setTimeout(() => {
                killUnit(unit);
            }, suicideDelay);
        }
    }
    
    function deactivateBuff() {
        if (!isActive) return;
        
        isActive = false;
                
        if (skill.metadata.sounds) {
            playSkillEndSound(skill.metadata.sounds);
        }
        
        lastTriggerTime = Date.now();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onSpawn) {
        activateBuff();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
        on(unit, EVENTS.DAMAGE_RECEIVED, (data) => {
            if (!isActive) {
                activateBuff();
            }
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
        on(unit, EVENTS.ATTACK, (data) => {
            if (!isActive) {
                activateBuff();
            }
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttackOnce) {
        on(unit, EVENTS.ATTACK, (data) => {
            if (!hasTriggeredOnce) {
                hasTriggeredOnce = true;
                activateBuff();
            }
        });
    }
    
    function updateBuff(deltaTime) {
        if (isPaused || gameIsOver || !unit || unit.health <= 0) {
            if (isActive) {
                deactivateBuff();
            }
            return;
        }
        
        if (isActive && effect && (!unit.activeEffects || !unit.activeEffects.has(skill.metadata.seffects))) {
            deactivateBuff();
            return;
        }
        
        const currentTime = Date.now();
        const gameSpeed = getGameSpeed();
        
        if (!isActive) {
            if (skill.metadata.trigger && skill.metadata.trigger.healthThreshold) {
                const healthPercent = unit.health / unit.maxHealth;
                if (healthPercent <= skill.metadata.trigger.healthThreshold && !healthThresholdTriggered) {
                    healthThresholdTriggered = true;
                    activateBuff();
                    return;
                }
            }
            
            if (skill.metadata.trigger && skill.metadata.trigger.interval && 
                healthThresholdTriggered && 
                currentTime - lastTriggerTime >= skill.metadata.trigger.interval / gameSpeed) {
                const chanceValue = skill.metadata.trigger.chance || 1.0;
                const shouldActivate = Math.random() <= chanceValue;
                
                if (shouldActivate) {
                    activateBuff();
                }
                
                lastTriggerTime = currentTime;
                return;
            }
            
            if (skill.metadata.trigger && !skill.metadata.trigger.onGetAttacked && 
                !skill.metadata.trigger.onAttack && !skill.metadata.trigger.onAttackOnce &&
                !skill.metadata.trigger.healthThreshold &&
                skill.metadata.trigger.interval && 
                currentTime - lastTriggerTime >= skill.metadata.trigger.interval / gameSpeed) {
                
                const chanceValue = skill.metadata.trigger.chance || 1.0;
                const shouldActivate = Math.random() <= chanceValue;
                
                if (shouldActivate) {
                    activateBuff();
                }
                
                lastTriggerTime = currentTime;
            }
        }
    }
    
    function cleanup() {
        if (isActive) {
            deactivateBuff();
        }
    }
    
    registerSkill(unit.id, skill.id, updateBuff, cleanup);
};

SkillManager.prototype.validateTransformSkill = function(skill) {
    const { metadata } = skill;
    
    this.validateProperty(skill, 'seffects', true, true);
    this.validateProperty(skill, 'graphics', true, true);
    
    this.validateProperty(skill, 'targetSelection', false);
    this.validateProperty(skill, 'projectileConfig', false);
    this.validateProperty(skill, 'target', false);
    this.validateProperty(skill, 'summonProperties', false);
    
    this.validateTrigger(skill, 'onDeath', false);
    this.validateTrigger(skill, 'duration', false);
    
    this.validateFx(skill, 'start', false);
    this.validateFx(skill, 'end', false);
    this.validateFx(skill, 'continuous', false);
    this.validateFx(skill, 'impact', false);
    
    if (!metadata.trigger || 
        !(metadata.trigger.onAttack || 
          metadata.trigger.onAttackOnce || 
          metadata.trigger.onGetAttacked || 
          metadata.trigger.onSpawn || 
          metadata.trigger.interval || 
          metadata.trigger.healthThreshold)) {
        this.reportIssue(skill, `Warning: TRANSFORM skill '${skill.id}' does not have any activation trigger.`);
    }
    
    if (!metadata.graphics) {
        this.reportIssue(skill, `Error: TRANSFORM skill '${skill.id}' missing required 'graphics' property.`, true);
    }
};

SkillManager.prototype.applyTransformSkill = async function(skill, unit) {
    this.validateTransformSkill(skill);
    
    const { 
        isPaused, 
        gameIsOver, 
        registerSkill, 
        playSkillStartSound,
        playSkillEndSound,
        drawPixelArt,
        getEffect,
        removeEffect,
        gameObjects,
        getGameSpeed,
        applySkillEffect, 
        getSkillEffect,
        on,
        EVENTS,
        killUnit
    } = await import('./baseSkill.js');
    
    if (skill.metadata.fx) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type TRANSFORM but uses 'fx' directly. FX should be handled by seffects and will be ignored.`);
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.duration) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type TRANSFORM but uses 'trigger.duration' directly. Duration should be handled by seffects and will be ignored.`);
    }
    
    let isTransformed = false;
    let lastTransformTime = Date.now();
    let originalProps = null;
    let hasTriggeredOnce = false;
    let healthThresholdTriggered = false;
    
    const effect = skill.metadata.seffects ? await getSkillEffect(skill.metadata.seffects) : null;
    
    if (!effect) {
        this.reportIssue(skill, `Error: TRANSFORM skill '${skill.id}' has no associated effect defined.`, true);
        return;
    }
    
    function enableTransform() {
        if (isTransformed) return;
        
        isTransformed = true;
        
        originalProps = {
            graphics: JSON.parse(JSON.stringify(unit.graphics)),
            width: unit.width,
            height: unit.height,
            key: unit.key
        };
        
        if (skill.metadata.sounds) {
            playSkillStartSound(skill.metadata.sounds);
        }
        
        if (effect) {
            applySkillEffect(unit, skill.metadata.seffects, effect, true);
            
            const activeEffect = unit.activeEffects && unit.activeEffects.get(skill.metadata.seffects);
            if (activeEffect) {
                const originalCleanup = activeEffect.cleanup || (() => {});
                activeEffect.cleanup = () => {
                    originalCleanup();
                    disableTransform();
                };
            }
        }
        
        if (skill.metadata.graphics) {
            const transformedUnit = drawPixelArt(skill.metadata.graphics, unit.scale, unit.x, unit.y);
            unit.graphics = skill.metadata.graphics;
            unit.width = transformedUnit.width;
            unit.height = transformedUnit.height;
            unit.key = transformedUnit.key;
        }
        
        if (skill.metadata.suicide) {
            const gameSpeed = getGameSpeed();
            const suicideDelay = typeof skill.metadata.suicide === 'number' ? skill.metadata.suicide / gameSpeed : 500 / gameSpeed;
            setTimeout(() => {
                killUnit(unit);
            }, suicideDelay);
        }
    }
    
    function disableTransform() {
        if (!isTransformed || !originalProps) return;
        
        if (gameObjects.has(unit.id)) {
            const restoredUnit = drawPixelArt(originalProps.graphics, unit.scale, unit.x, unit.y);
            unit.graphics = originalProps.graphics;
            unit.width = originalProps.width;
            unit.height = originalProps.height;
            unit.key = originalProps.key || restoredUnit.key;
            
            if (skill.metadata.sounds) {
                playSkillEndSound(skill.metadata.sounds);
            }
        }
        
        isTransformed = false;
        lastTransformTime = Date.now();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onSpawn) {
        enableTransform();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
        on(unit, EVENTS.DAMAGE_RECEIVED, (data) => {
            if (!isTransformed) {
                enableTransform();
            }
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
        on(unit, EVENTS.ATTACK, (data) => {
            if (!isTransformed) {
                enableTransform();
            }
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttackOnce) {
        on(unit, EVENTS.ATTACK, (data) => {
            if (!hasTriggeredOnce) {
                hasTriggeredOnce = true;
                enableTransform();
            }
        });
    }
    
    function updateTransform(deltaTime) {
        if (isPaused || gameIsOver || !unit || unit.health <= 0) {
            if (isTransformed) {
                disableTransform();
            }
            return;
        }
        
        if (isTransformed && effect && (!unit.activeEffects || !unit.activeEffects.has(skill.metadata.seffects))) {
            disableTransform();
            return;
        }
        
        const currentTime = Date.now();
        const gameSpeed = getGameSpeed();
        
        if (!isTransformed) {
            if (skill.metadata.trigger && skill.metadata.trigger.healthThreshold) {
                const healthPercent = unit.health / unit.maxHealth;
                if (healthPercent <= skill.metadata.trigger.healthThreshold && !healthThresholdTriggered) {
                    healthThresholdTriggered = true;
                    enableTransform();
                    return;
                }
            }
            
            if (skill.metadata.trigger && skill.metadata.trigger.interval && 
                healthThresholdTriggered && 
                currentTime - lastTransformTime >= skill.metadata.trigger.interval / gameSpeed) {
                if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                    enableTransform();
                }
                lastTransformTime = currentTime;
                return;
            }
            
            if (skill.metadata.trigger && !skill.metadata.trigger.onGetAttacked && 
                !skill.metadata.trigger.onAttack && !skill.metadata.trigger.onAttackOnce &&
                !skill.metadata.trigger.healthThreshold &&
                skill.metadata.trigger.interval && 
                currentTime - lastTransformTime >= skill.metadata.trigger.interval / gameSpeed) {
                if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                    enableTransform();
                }
                lastTransformTime = currentTime;
            }
        }
    }
    
    function cleanup() {
        if (isTransformed) {
            disableTransform();
        }
    }
    
    registerSkill(unit.id, skill.id, updateTransform, cleanup);
};

export {};