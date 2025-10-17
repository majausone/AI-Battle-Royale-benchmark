import { SkillManager } from './allSkills_base.js';

SkillManager.prototype.validateProjectileSkill = function(skill) {
    const { metadata } = skill;
    
    this.validateProperty(skill, 'projectileConfig', true, true);
    this.validateProperty(skill, 'target', true, true);
    
    this.validateProperty(skill, 'graphics', false);
    this.validateProperty(skill, 'targetSelection', false);
    this.validateProperty(skill, 'summonProperties', false);
    
    this.validateTrigger(skill, 'onDeath', false);
    this.validateTrigger(skill, 'duration', false);
    
    this.validateFx(skill, 'end', false);
    this.validateFx(skill, 'continuous', false);
    
    if (!metadata.projectileConfig) {
        this.reportIssue(skill, `Error: PROJECTILE skill '${skill.id}' missing required 'projectileConfig' property.`, true);
    } else {
        const config = metadata.projectileConfig;
        
        if (!config.speed) {
            this.reportIssue(skill, `Error: PROJECTILE skill '${skill.id}' missing required 'speed' in projectileConfig.`, true);
        }
        if (!config.size) {
            this.reportIssue(skill, `Error: PROJECTILE skill '${skill.id}' missing required 'size' in projectileConfig.`, true);
        }
        if (!config.color) {
            this.reportIssue(skill, `Error: PROJECTILE skill '${skill.id}' missing required 'color' in projectileConfig.`, true);
        }
        if (!config.maxDistance) {
            this.reportIssue(skill, `Error: PROJECTILE skill '${skill.id}' missing required 'maxDistance' in projectileConfig.`, true);
        }
        if (config.damage === undefined) {
            this.reportIssue(skill, `Error: PROJECTILE skill '${skill.id}' missing required 'damage' in projectileConfig.`, true);
        }
    }
    
    if (!metadata.target) {
        this.reportIssue(skill, `Error: PROJECTILE skill '${skill.id}' missing required 'target' property.`, true);
    } else if (!Array.isArray(metadata.target)) {
        this.reportIssue(skill, `Warning: PROJECTILE skill '${skill.id}' has 'target' property that is not an array.`);
    }
};

SkillManager.prototype.applyCustomProjectileSkill = async function(skill, unit) {
    this.validateProjectileSkill(skill);
    
    const { 
        isPaused, 
        gameIsOver, 
        registerSkill, 
        applyFX, 
        playSkillStartSound,
        applySkillEffect,
        getSkillEffect,
        getEffect,
        gameObjects,
        isPositionInBounds,
        getBattleAreaBounds,
        createTerrainEffect,
        getGameSpeed,
        on,
        EVENTS,
        killUnit
    } = await import('./baseSkill.js');
    
    let lastFireTime = Date.now();
    let activeProjectiles = new Map();
    let nextProjectileId = 0;
    let hasTriggeredOnce = false;
    let healthThresholdTriggered = false;

    async function fireProjectiles() {
        if (!unit || unit.health <= 0) return;
        
        if (skill.metadata.sounds) {
            playSkillStartSound(skill.metadata.sounds);
        }
        
        if (skill.metadata.fx && skill.metadata.fx.start) {
            applyFX(skill.metadata.fx.start, unit);
        }
        
        const config = skill.metadata.projectileConfig;
        const count = config.count || 1;
        const spread = config.spreadAngle || 0;
        
        let targets = [];
        
        if (skill.metadata.target && skill.metadata.target.includes("allies") && !skill.metadata.target.includes("enemies")) {
            for (const obj of gameObjects.values()) {
                if (obj.id !== unit.id && obj.teamId && obj.teamId === unit.teamId) {
                    targets.push(obj);
                }
            }
        } else {
            for (const obj of gameObjects.values()) {
                if (obj.id !== unit.id && (!unit.teamId || obj.teamId !== unit.teamId)) {
                    targets.push(obj);
                }
            }
        }
        
        if (targets.length === 0) return;
        
        targets.sort((a, b) => {
            const distA = Math.hypot(a.x - unit.x, a.y - unit.y);
            const distB = Math.hypot(b.x - unit.x, b.y - unit.y);
            return distA - distB;
        });
        
        const target = targets[0];
        
        const mainAngle = Math.atan2(
            target.y + target.height/2 - (unit.y + unit.height/2),
            target.x + target.width/2 - (unit.x + unit.width/2)
        );
        
        for (let i = 0; i < count; i++) {
            const angleOffset = (count > 1) ? spread * (i / (count - 1) - 0.5) : 0;
            const angle = mainAngle + (angleOffset * Math.PI / 180);
            
            createProjectile(unit, angle, config);
        }
        
        if (skill.metadata.suicide) {
            const gameSpeed = getGameSpeed();
            const suicideDelay = typeof skill.metadata.suicide === 'number' ? skill.metadata.suicide / gameSpeed : 100 / gameSpeed;
            setTimeout(() => {
                killUnit(unit);
            }, suicideDelay);
        }
    }
    
    function createProjectile(unit, angle, config) {
        const projectileId = `proj-${unit.id}-${nextProjectileId++}`;
        const startX = unit.x + unit.width / 2;
        const startY = unit.y + unit.height / 2;
        
        const affectEnemies = skill.metadata.target && skill.metadata.target.includes("enemies");
        const affectAllies = skill.metadata.target && skill.metadata.target.includes("allies");
        
        const projectile = {
            id: projectileId,
            x: startX,
            y: startY,
            width: config.size,
            height: config.size,
            color: config.color,
            trailColor: config.trailColor,
            vx: Math.cos(angle) * config.speed,
            vy: Math.sin(angle) * config.speed,
            damage: config.damage,
            distance: 0,
            maxDistance: config.maxDistance,
            sourceUnit: unit,
            sourceTeamId: unit.teamId,
            areaEffect: config.areaEffect,
            areaRadius: config.areaRadius,
            createTime: Date.now(),
            affectEnemies: affectEnemies,
            affectAllies: affectAllies
        };
        
        activeProjectiles.set(projectileId, projectile);
    }
    
    async function updateProjectiles(deltaTime) {
        const bounds = getBattleAreaBounds();
        
        for (const [id, projectile] of activeProjectiles.entries()) {
            const elapsed = Date.now() - projectile.createTime;
            
            projectile.x += projectile.vx * (deltaTime / 16);
            projectile.y += projectile.vy * (deltaTime / 16);
            
            projectile.distance += Math.hypot(projectile.vx * (deltaTime / 16), projectile.vy * (deltaTime / 16));
            
            if (projectile.trailColor) {
                const renderModule = await import('./render.js');
                renderModule.createTrail(projectile.x, projectile.y, projectile.trailColor);
            }
            
            let removeProjectile = false;
            
            if (!isPositionInBounds(projectile.x, projectile.y, projectile.width, projectile.height) || 
                projectile.distance > projectile.maxDistance) {
                removeProjectile = true;
            }
            
            for (const target of gameObjects.values()) {
                if (target.id === projectile.sourceUnit.id) {
                    continue;
                }
                
                const isAlly = target.teamId && projectile.sourceTeamId && target.teamId === projectile.sourceTeamId;
                
                if (isAlly && !projectile.affectAllies) {
                    continue;
                }
                
                if (!isAlly && !projectile.affectEnemies) {
                    continue;
                }
                
                const collides = (
                    projectile.x < target.x + target.width &&
                    projectile.x + projectile.width > target.x &&
                    projectile.y < target.y + target.height &&
                    projectile.y + projectile.height > target.y
                );
                
                if (collides) {
                    await handleImpact(projectile, target);
                    removeProjectile = true;
                    break;
                }
            }
            
            if (removeProjectile) {
                activeProjectiles.delete(id);
            }
        }
    }
    
    async function handleImpact(projectile, target) {
        if (skill.metadata.fx && skill.metadata.fx.impact) {
            const impactEffect = getEffect(skill.metadata.fx.impact);
            if (impactEffect) {
                impactEffect(target, {
                    x: projectile.x,
                    y: projectile.y,
                    damage: projectile.damage,
                    areaEffect: projectile.areaEffect,
                    areaRadius: projectile.areaRadius
                });
            }
        }
        
        const collisions = await import('./collisions.js');
        collisions.attackKewo(target, projectile.damage, projectile.sourceUnit, projectile.affectAllies);
        
        const effectIds = Array.isArray(skill.metadata.seffects) 
            ? skill.metadata.seffects 
            : (skill.metadata.seffects ? [skill.metadata.seffects] : []);
        
        for (const effectId of effectIds) {
            const effect = await getSkillEffect(effectId);
            if (effect) {
                if (effect.noUnit === "true") {
                    createTerrainEffect({
                        id: effectId,
                        position: { x: projectile.x, y: projectile.y },
                        radius: effect.auraRadius || projectile.areaRadius || 80,
                        effectType: effect.effectType,
                        targetTypes: effect.targetType ? effect.targetType.split(',') : ["enemies"],
                        teamId: projectile.sourceTeamId,
                        duration: effect.duration || 5000,
                        pulseInterval: effect.pulseInterval || 1000,
                        targetEffectId: effect.targetEffectId,
                        damageAmount: effect.damageAmount,
                        healAmount: effect.healAmount,
                        pulseFx: effect.pulseFx,
                        fxId: effect.sourceFx?.continuous
                    });
                } else {
                    applySkillEffect(target, effectId, effect, projectile.sourceUnit.id);
                }
            }
        }
        
        if (projectile.areaEffect && projectile.areaRadius) {
            const areaTargets = Array.from(gameObjects.values()).filter(obj => {
                if (obj.id === target.id) {
                    return false;
                }
                
                const isOwnUnit = obj.id === projectile.sourceUnit.id;
                
                if (isOwnUnit) {
                    return projectile.affectAllies;
                }
                
                const isAlly = obj.teamId && projectile.sourceTeamId && obj.teamId === projectile.sourceTeamId;
                
                if (isAlly && !projectile.affectAllies) {
                    return false;
                }
                
                if (!isAlly && !projectile.affectEnemies) {
                    return false;
                }
                
                const dx = obj.x + obj.width/2 - projectile.x;
                const dy = obj.y + obj.height/2 - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                return distance <= projectile.areaRadius;
            });
            
            for (const secondaryTarget of areaTargets) {
                const dx = secondaryTarget.x + secondaryTarget.width/2 - projectile.x;
                const dy = secondaryTarget.y + secondaryTarget.height/2 - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const falloff = 1 - (distance / projectile.areaRadius);
                const scaledDamage = Math.floor(projectile.damage * falloff * 0.6);
                
                if (scaledDamage > 0) {
                    collisions.attackKewo(secondaryTarget, scaledDamage, projectile.sourceUnit, projectile.affectAllies);
                    
                    for (const effectId of effectIds) {
                        const effect = await getSkillEffect(effectId);
                        if (effect && effect.noUnit !== "true") {
                            applySkillEffect(secondaryTarget, effectId, effect, projectile.sourceUnit.id);
                        }
                    }
                }
            }
        }
    }
    
    function cleanup() {
        activeProjectiles.clear();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onSpawn) {
        fireProjectiles();
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
        on(unit, EVENTS.DAMAGE_RECEIVED, async (data) => {
            await fireProjectiles();
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
        on(unit, EVENTS.ATTACK, (data) => {
            fireProjectiles();
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onAttackOnce) {
        on(unit, EVENTS.ATTACK, (data) => {
            if (!hasTriggeredOnce) {
                hasTriggeredOnce = true;
                fireProjectiles();
            }
        });
    }
    
    function update(deltaTime) {
        if (isPaused || gameIsOver || !unit || unit.health <= 0) return;
        
        const currentTime = Date.now();
        const gameSpeed = getGameSpeed();
        
        if (skill.metadata.trigger && skill.metadata.trigger.healthThreshold) {
            const healthPercent = unit.health / unit.maxHealth;
            if (healthPercent <= skill.metadata.trigger.healthThreshold && !healthThresholdTriggered) {
                healthThresholdTriggered = true;
                fireProjectiles();
                lastFireTime = currentTime;
                return;
            }
        }
        
        if (skill.metadata.trigger && skill.metadata.trigger.interval && 
            healthThresholdTriggered && 
            currentTime - lastFireTime >= skill.metadata.trigger.interval / gameSpeed) {
            if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                fireProjectiles();
                lastFireTime = currentTime;
            }
            return;
        }
        
        if (!skill.metadata.trigger.onAttack && !skill.metadata.trigger.onAttackOnce && 
            !skill.metadata.trigger.onGetAttacked && !skill.metadata.trigger.onSpawn &&
            !skill.metadata.trigger.healthThreshold &&
            skill.metadata.trigger.interval && 
            currentTime - lastFireTime >= skill.metadata.trigger.interval / gameSpeed) {
            if (!skill.metadata.trigger.chance || Math.random() <= skill.metadata.trigger.chance) {
                fireProjectiles();
                lastFireTime = currentTime;
            }
        }
        
        updateProjectiles(deltaTime);
    }
    
    registerSkill(unit.id, skill.id, update, cleanup);
};

export {};