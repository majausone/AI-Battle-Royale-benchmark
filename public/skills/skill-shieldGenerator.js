import { BaseSkill, on, EVENTS, playSkillStartSound, playSkillEndSound, applyFX, removeEffect, registerSkill } from '../baseSkill.js';

class ShieldGeneratorSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-shieldGenerator";
        this.metadata = {
            name: "Shield Generator",
            description: "Reduces incoming damage by 2",
            skillType: "BUFF",
            seffects: "seffect-shieldReduction",
            
            trigger: {
                interval: 3000
            },
            
            sounds: {
                start: ["square", 220, 500, 10, 60, 3500, 6, 0, 0, false, true, 40, 30, 0],
                end: ["square", 180, 300, 8, 40, 2500, 4, 0, 0, false, true, 30, 20, 0]
            }
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new ShieldGeneratorSkill();
export default skill;