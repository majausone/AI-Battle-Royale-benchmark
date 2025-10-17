import { BaseSkill, isPaused, getEnemiesInRange, playSkillStartSound, applyFX, applySkillEffect, getSkillEffect, registerSkill } from '../baseSkill.js';

class PoisonTrailSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-poisonTrail";
        this.metadata = {
            name: "Poison Trail",
            description: "Leaves a poisonous trail that damages enemies",
            skillType: "AURA",
            seffects: "seffect-poisonTrail",
            
            trigger: {
                onSpawn: true
            },
            
            sounds: {
                start: ["triangle", 120, 800, 12, 90, 500, 16, 0, 0, false, true, 30, 0, 0]
            }
        };
    }

    async apply(unit) {
        super.apply(unit);
    }
}

const skill = new PoisonTrailSkill();
export default skill;