import { BaseSkill, playSkillStartSound, applySkillEffect, getSkillEffect, registerSkill } from '../baseSkill.js';

class DebuffSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-debuff-3741";
        this.metadata = {
            name: "Weaken",
            description: "Reduces target's damage on hit",
            skillType: "DEBUFF",
            seffects: "seffect-freezeTarget",
            
            trigger: {
                onAttack: true
            },
            
            sounds: {
                start: ["sawtooth", 330, 200, 10, 70, 1500, 5, 0, 0, false, true, 50, 30, 0]
            },
        };
    }

    async apply(unit) {
        super.apply(unit);
    }
}

const skill = new DebuffSkill();
export default skill;