import { SkillManager } from './allSkills_base.js';

SkillManager.prototype.validateTeleportSkill = function(skill) {
    const { metadata } = skill;
    
    this.validateProperty(skill, 'targetSelection', true, true);
    
    this.validateProperty(skill, 'seffects', false);
    this.validateProperty(skill, 'graphics', false);
    this.validateProperty(skill, 'projectileConfig', false);
    this.validateProperty(skill, 'target', false);
    this.validateProperty(skill, 'summonProperties', false);
    
    this.validateTrigger(skill, 'onDeath', false);
    this.validateTrigger(skill, 'duration', false);
    
    this.validateFx(skill, 'continuous', false);
    this.validateFx(skill, 'impact', false);
    
    if (!metadata.targetSelection) {
        this.reportIssue(skill, `Error: TELEPORT skill '${skill.id}' missing required 'targetSelection' property.`, true);
    } else if (
        metadata.targetSelection !== "RANDOM" && 
        metadata.targetSelection !== "NEAREST_ENEMY" && 
        metadata.targetSelection !== "FURTHEST_ENEMY" &&
        metadata.targetSelection !== "NEAREST_ALLY" && 
        metadata.targetSelection !== "FURTHEST_ALLY"
    ) {
        this.reportIssue(skill, `Warning: TELEPORT skill '${skill.id}' has invalid 'targetSelection' value: ${metadata.targetSelection}`);
    }
    
    if (!metadata.trigger || 
        !(metadata.trigger.onAttack || 
          metadata.trigger.onAttackOnce || 
          metadata.trigger.onGetAttacked || 
          metadata.trigger.onSpawn || 
          metadata.trigger.interval || 
          metadata.trigger.healthThreshold)) {
        this.reportIssue(skill, `Warning: TELEPORT skill '${skill.id}' does not have any activation trigger.`);
    }
};

SkillManager.prototype.applyTeleportSkill = async function(skill, unit) {
    this.validateTeleportSkill(skill);
    
    const { 
        isPaused, 
        gameIsOver, 
        registerSkill, 
        applyFX, 
        playSkillStartSound,
        getBattleAreaBounds,
        getGameSpeed,
        on,
        EVENTS,
        killUnit
    } = await import('./baseSkill.js');
    
    let lastTeleportTime = Date.now();
    let hasTriggeredOnce = false;
    let healthThresholdTriggered = false;
    
    function updateTeleport(deltaTime) {
        if (isPaused || gameIsOver || !unit || unit.health <= 0) return;
        
        const currentTime = Date.now();
        const gameSpeed = getGameSpeed();
        
        if (skill.metadata.trigger && skill.metadata.trigger.healthThreshold) {
            const healthPercent = unit.health / unit.maxHealth;
            if (healthPercent <= skill.metadata.trigger.healthThreshold && !healthThresholdTriggered) {
                healthThresholdTriggered = true;
                executeTeleport();
                lastTeleportTime = currentTime;
                return;
            }
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.interval && 
            healthThresholdTriggered && 
            currentTime - lastTeleportTime >= skill.metadata.trigger.interval / gameSpeed) {
            if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                executeTeleport();
                lastTeleportTime = currentTime;
            }
            return;
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.interval && 
            !skill.metadata.trigger.onAttack && !skill.metadata.trigger.onAttackOnce && 
            !skill.metadata.trigger.onGetAttacked && !skill.metadata.trigger.onSpawn &&
            !skill.metadata.trigger.healthThreshold &&
            currentTime - lastTeleportTime >= skill.metadata.trigger.interval / gameSpeed) {
            
            if (skill.metadata.trigger.chance && Math.random() > skill.metadata.trigger.chance) {
                lastTeleportTime = currentTime;
                return;
            }
            
            executeTeleport();
            lastTeleportTime = currentTime;
        }
    }
    
    function executeTeleport() {
        if (skill.metadata.sounds) {
            playSkillStartSound(skill.metadata.sounds);
        }
        
        if (skill.metadata.fx && skill.metadata.fx.start) {
            applyFX(skill.metadata.fx.start, unit, { x: unit.x, y: unit.y });
        }
        
        const bounds = getBattleAreaBounds();
        const margin = 30; 
        
        let newX, newY;
        
        if (skill.metadata.targetSelection === "NEAREST_ENEMY") {
            newX = Math.random() * (bounds.right - bounds.left - 2 * margin) + bounds.left + margin;
            newY = Math.random() * (bounds.bottom - bounds.top - 2 * margin) + bounds.top + margin;
        } else {
            newX = Math.random() * (bounds.right - bounds.left - 2 * margin) + bounds.left + margin;
            newY = Math.random() * (bounds.bottom - bounds.top - 2 * margin) + bounds.top + margin;
        }
        
        unit.x = newX;
        unit.y = newY;
        
        if (skill.metadata.fx && skill.metadata.fx.end) {
            applyFX(skill.metadata.fx.end, unit);
        }
        
        if (skill.metadata.suicide) {
            const gameSpeed = getGameSpeed();
            const suicideDelay = typeof skill.metadata.suicide === 'number' ? skill.metadata.suicide / gameSpeed : 100 / gameSpeed;
            setTimeout(() => {
                killUnit(unit);
            }, suicideDelay);
        }
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onSpawn) {
        executeTeleport();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
        on(unit, EVENTS.DAMAGE_RECEIVED, (data) => {
            executeTeleport();
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
        on(unit, EVENTS.ATTACK, (data) => {
            executeTeleport();
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttackOnce) {
        on(unit, EVENTS.ATTACK, (data) => {
            if (!hasTriggeredOnce) {
                hasTriggeredOnce = true;
                executeTeleport();
            }
        });
    }
    
    registerSkill(unit.id, skill.id, updateTeleport);
};

export {};