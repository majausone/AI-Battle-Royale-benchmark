import { SkillManager } from './allSkills_base.js';

SkillManager.prototype.validateAuraSkill = function(skill) {
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
        this.reportIssue(skill, `Warning: AURA skill '${skill.id}' does not have any activation trigger.`);
    }
    
    const effectIds = Array.isArray(metadata.seffects) 
        ? metadata.seffects 
        : (metadata.seffects ? [metadata.seffects] : []);
    
    if (effectIds.length === 0) {
        this.reportIssue(skill, `Error: AURA skill '${skill.id}' missing required 'seffects' property.`, true);
    }
};

SkillManager.prototype.applyAuraSkill = async function(skill, unit) {
    this.validateAuraSkill(skill);
    
    const { 
        getSkillEffect, 
        applySkillEffect, 
        isPaused, 
        gameIsOver, 
        getAlliesInRange, 
        getEnemiesInRange, 
        getUnitsInRange, 
        registerSkill, 
        playSkillStartSound, 
        playSkillEndSound,
        killUnit,
        getEffect,
        on,
        EVENTS,
        getGameSpeed
    } = await import('./baseSkill.js');

    const { teamStats } = await import('./gameState.js');
    
    if (skill.metadata.fx) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type AURA but uses 'fx' directly. FX should be handled by seffects and will be ignored.`);
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.duration) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type AURA but uses 'trigger.duration' directly. Duration should be handled by seffects and will be ignored.`);
    }
    
    const effectIds = Array.isArray(skill.metadata.seffects) 
        ? skill.metadata.seffects 
        : (skill.metadata.seffects ? [skill.metadata.seffects] : []);
    
    if (effectIds.length === 0) {
        this.reportIssue(skill, `Missing effect for aura skill ${skill.id}`);
        return;
    }
    
    const primaryEffectId = effectIds[0];
    const effect = await getSkillEffect(primaryEffectId);
    
    if (!effect) {
        this.reportIssue(skill, `Missing effect for aura skill ${skill.id}`);
        return;
    }
    
    let effectInstanceId = null;
    let lastTriggerTime = 0;
    let continuousEffectCleanup = null;
    let affectedTargets = new Map();
    let isActive = false;
    let hasTriggeredOnce = false;
    let lastActivationTime = 0;
    let healthThresholdTriggered = false;
    
    async function activateAura() {
        if (isActive) return;
        isActive = true;
        lastActivationTime = Date.now();

        if (skill.metadata.sounds) {
            playSkillStartSound(skill.metadata.sounds);
        }

        if (effect.sourceFx && effect.sourceFx.start) {
            try {
                const startEffectFn = getEffect(effect.sourceFx.start);
                if (startEffectFn) {
                    startEffectFn(unit);
                }
            } catch (error) {
                console.warn("Error applying start effect:", error);
            }
        }

        if (effect.sourceFx && effect.sourceFx.continuous) {
            effectInstanceId = `${skill.id}-continuous-${unit.id}`;
            try {
                const effectFn = getEffect(effect.sourceFx.continuous);
                if (effectFn) {
                    continuousEffectCleanup = effectFn(unit);
                }
            } catch (error) {
                console.warn("Error applying continuous effect:", error);
            }
        }
        
        const auraEffectInstance = {
            ...effect,
            fromSkill: true,
            startTime: Date.now(),
            lastTick: Date.now(),
            id: primaryEffectId,
            sourceSkill: skill.id,
            isAuraSource: true
        };
        
        if (unit.activeEffects) {
            unit.activeEffects.set(primaryEffectId, auraEffectInstance);
        }
        
        if (skill.metadata.suicide) {
            const gameSpeed = getGameSpeed();
            const suicideDelay = typeof skill.metadata.suicide === 'number' ? skill.metadata.suicide / gameSpeed : 100 / gameSpeed;
            setTimeout(() => {
                killUnit(unit);
            }, suicideDelay);
        }
    }

    function deactivateAura() {
        if (!isActive) return;
        isActive = false;
        
        if (skill.metadata.sounds) {
            playSkillEndSound(skill.metadata.sounds);
        }

        if (continuousEffectCleanup) {
            if (typeof continuousEffectCleanup === 'function') {
                try {
                    continuousEffectCleanup();
                } catch (error) {
                    console.warn("Error cleaning up continuous effect:", error);
                }
            } else if (continuousEffectCleanup && typeof continuousEffectCleanup.then === 'function') {
                continuousEffectCleanup.then(cleanupFn => {
                    if (typeof cleanupFn === 'function') {
                        cleanupFn();
                    }
                }).catch(error => {
                    console.warn("Error in promise cleanup:", error);
                });
            }
            continuousEffectCleanup = null;
        }
        
        if (unit.activeEffects && unit.activeEffects.has(primaryEffectId)) {
            unit.activeEffects.delete(primaryEffectId);
        }

        lastTriggerTime = Date.now();
    }

    if (skill.metadata.trigger && skill.metadata.trigger.onSpawn) {
        await activateAura();
    }

    if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
        on(unit, EVENTS.DAMAGE_RECEIVED, async (data) => {
            if (!isActive) {
                await activateAura();
            }
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
        on(unit, EVENTS.ATTACK, async (data) => {
            if (!isActive) {
                await activateAura();
            }
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttackOnce) {
        on(unit, EVENTS.ATTACK, async (data) => {
            if (!hasTriggeredOnce) {
                hasTriggeredOnce = true;
                await activateAura();
            }
        });
    }

    async function updateAura(deltaTime) {
        if (isPaused || gameIsOver || !unit || unit.health <= 0) {
            if (isActive) {
                deactivateAura();
            }
            return;
        }

        const currentTime = Date.now();
        const gameSpeed = getGameSpeed();
        
        if (!isActive) {
            if (skill.metadata.trigger && skill.metadata.trigger.healthThreshold) {
                const healthPercent = unit.health / unit.maxHealth;
                if (healthPercent <= skill.metadata.trigger.healthThreshold && !healthThresholdTriggered) {
                    healthThresholdTriggered = true;
                    await activateAura();
                    return;
                }
            }
            
            if (skill.metadata.trigger && skill.metadata.trigger.interval && 
                healthThresholdTriggered && 
                currentTime - lastTriggerTime >= skill.metadata.trigger.interval / gameSpeed) {
                if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                    await activateAura();
                }
                lastTriggerTime = currentTime;
                return;
            }
            
            if (skill.metadata.trigger && !skill.metadata.trigger.onGetAttacked && 
                !skill.metadata.trigger.onAttack && !skill.metadata.trigger.onAttackOnce &&
                !skill.metadata.trigger.onSpawn && !skill.metadata.trigger.healthThreshold &&
                skill.metadata.trigger.interval && 
                currentTime - lastTriggerTime >= skill.metadata.trigger.interval / gameSpeed) {
                if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                    await activateAura();
                }
                lastTriggerTime = currentTime;
            }
            
            return;
        }
        
        if (effect.duration && effect.duration > 0 && 
            currentTime - lastActivationTime >= effect.duration / gameSpeed) {
            deactivateAura();
            return;
        }
        
        let targets = [];
        const radius = effect.auraRadius || 100;
        
        if (effect.targetType) {
            const targetTypes = effect.targetType.split(',');
            
            targetTypes.forEach(type => {
                type = type.trim();
                if (type === "allies") {
                    targets = [...targets, ...getAlliesInRange(unit, radius)];
                } else if (type === "enemies") {
                    targets = [...targets, ...getEnemiesInRange(unit, radius)];
                } else if (type === "self") {
                    targets.push(unit);
                }
            });
            
            targets = Array.from(new Set(targets));
        } else {
            targets = getUnitsInRange(unit, radius);
        }

        if (effect.targetEffectId) {
            try {
                const targetEffect = await getSkillEffect(effect.targetEffectId);
                if (targetEffect) {
                    for (const target of targets) {
                        applySkillEffect(target, effect.targetEffectId, targetEffect, false);
                    }
                }
            } catch (error) {
                console.warn(`Error applying target effect ${effect.targetEffectId}:`, error);
            }
        } else if (effect.healAmount || effect.damageAmount) {
            const value = effect.healAmount || -effect.damageAmount;
            const interval = (effect.pulseInterval || 1000) / gameSpeed;
            
            targets.forEach(target => {
                const targetId = target.id;
                const lastPulse = affectedTargets.get(targetId) || 0;
                
                if (currentTime - lastPulse >= interval) {
                    if (effect.pulseFx) {
                        try {
                            const pulseEffect = getEffect(effect.pulseFx);
                            if (pulseEffect) {
                                pulseEffect(target, { damage: Math.abs(value) });
                            }
                        } catch (error) {
                            console.warn(`Error applying pulse effect ${effect.pulseFx}:`, error);
                        }
                    }
                    
                    const oldHealth = target.health;
                    target.health = Math.min(target.maxHealth, Math.max(0, target.health + value));
                    
                    const healthDiff = target.health - oldHealth;
                    if (target.teamId) {
                        const team = teamStats.get(target.teamId);
                        if (team) {
                            if (healthDiff > 0) {
                                team.currentHealth = Math.min(team.totalHealth, team.currentHealth + healthDiff);
                            } else if (healthDiff < 0) {
                                team.currentHealth = Math.max(0, team.currentHealth + healthDiff);
                            }
                            
                            if (target.aiId && team.ais.has(target.aiId)) {
                                const ai = team.ais.get(target.aiId);
                                if (healthDiff > 0) {
                                    ai.currentHealth = Math.min(ai.totalHealth, ai.currentHealth + healthDiff);
                                } else if (healthDiff < 0) {
                                    ai.currentHealth = Math.max(0, ai.currentHealth + healthDiff);
                                }
                            }
                        }
                    }
                    
                    if (target.health <= 0 && oldHealth > 0) {
                        killUnit(target);
                    }
                    
                    affectedTargets.set(targetId, currentTime);
                }
            });
        }
    }

    function cleanup() {
        if (isActive) {
            deactivateAura();
        }
    }

    registerSkill(unit.id, skill.id, updateAura, cleanup);
};

export {};
