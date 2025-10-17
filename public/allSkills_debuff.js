import { SkillManager } from './allSkills_base.js';

SkillManager.prototype.validateDebuffSkill = function(skill) {
    const { metadata } = skill;
    
    this.validateProperty(skill, 'seffects', true, true);
    
    this.validateProperty(skill, 'graphics', false);
    this.validateProperty(skill, 'targetSelection', false);
    this.validateProperty(skill, 'projectileConfig', false);
    this.validateProperty(skill, 'target', false);
    this.validateProperty(skill, 'summonProperties', false);
    
    this.validateTrigger(skill, 'onDeath', false);
    this.validateTrigger(skill, 'duration', false);
    this.validateTrigger(skill, 'onSpawn', false);
    this.validateTrigger(skill, 'interval', false);
    this.validateTrigger(skill, 'healthThreshold', false);
    
    this.validateFx(skill, 'start', false);
    this.validateFx(skill, 'end', false);
    this.validateFx(skill, 'continuous', false);
    this.validateFx(skill, 'impact', false);
    
    if (!(metadata.trigger && (metadata.trigger.onAttack || metadata.trigger.onGetAttacked))) {
        this.reportIssue(skill, `Error: DEBUFF skill '${skill.id}' must have either 'onAttack' or 'onGetAttacked' trigger defined.`, true);
    }
};

SkillManager.prototype.applyDebuffSkill = async function(skill, unit) {
    this.validateDebuffSkill(skill);
    
    const { 
        getSkillEffect, 
        applySkillEffect, 
        isPaused, 
        gameIsOver, 
        on,
        EVENTS,
        getGameSpeed,
        killUnit
    } = await import('./baseSkill.js');
    
    if (skill.metadata.fx) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type DEBUFF but uses 'fx' directly. FX should be handled by seffects and will be ignored.`);
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.duration) {
        this.reportIssue(skill, `Warning: Skill ${skill.id} is of type DEBUFF but uses 'trigger.duration' directly. Duration should be handled by seffects and will be ignored.`);
    }
    
    const effect = skill.metadata.seffects ? await getSkillEffect(skill.metadata.seffects) : null;

    if (!effect) {
        this.reportIssue(skill, `Warning: DEBUFF skill '${skill.id}' has no associated effect defined.`, true);
        return;
    }

    const applyDebuffToTarget = async (target) => {
        if (isPaused || gameIsOver || !unit || unit.health <= 0 || !target || target.health <= 0) return;
        
        if (skill.metadata.sounds) {
            const { playSkillStartSound } = await import('./baseSkill.js');
            playSkillStartSound(skill.metadata.sounds);
        }
        
        applySkillEffect(target, skill.metadata.seffects, effect, false);
        
        if (skill.metadata.suicide) {
            const gameSpeed = getGameSpeed();
            const suicideDelay = typeof skill.metadata.suicide === 'number' ? skill.metadata.suicide / gameSpeed : 100 / gameSpeed;
            setTimeout(() => {
                killUnit(unit);
            }, suicideDelay);
        }
    };

    if (skill.metadata.trigger && skill.metadata.trigger.onAttack) {
        on(unit, EVENTS.ATTACK, async (data) => {
            if (data && data.target) {
                await applyDebuffToTarget(data.target);
            }
        });
    }
    
    if (skill.metadata.trigger && skill.metadata.trigger.onGetAttacked) {
        on(unit, EVENTS.DAMAGE_RECEIVED, async (data) => {
            if (data && data.attacker) {
                await applyDebuffToTarget(data.attacker);
            }
        });
    }
};

export {};