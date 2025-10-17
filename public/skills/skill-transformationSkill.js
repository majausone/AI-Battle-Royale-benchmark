import { BaseSkill, addGameObject, applyFX, playSkillStartSound, playSkillEndSound, registerSkill } from '../baseSkill.js';

class TransformationSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-transformationSkill";
        this.metadata = {
            name: "Transformation",
            description: "Damage x2, Speed x1.5",
            skillType: "TRANSFORM",
            seffects: "seffect-transformation",
            
            trigger: {
                interval: 5000
            },
            
            sounds: {
                start: ["sawtooth", 330, 1200, 8, 85, 2500, 6, 0, 0, false, true, 70, 50, 30],
                end: ["sawtooth", 660, 800, 6, 60, 3000, 4, 0, 0, false, true, 50, 30, 20]
            },
            
            graphics: [
                [0, 0, "#FF0000", "#FF0000", "#FF0000", 0, 0],
                [0, "#FF0000", "#FF0000", "#FF0000", "#FF0000", "#FF0000", 0],
                ["#FF0000", "#FF0000", "#FF0000", "#000000", "#FF0000", "#FF0000", "#FF0000"],
                ["#FF0000", "#FF0000", "#FF0000", "#FF0000", "#FF0000", "#FF0000", "#FF0000"],
                [0, "#FF0000", "#FF0000", "#FF0000", "#FF0000", "#FF0000", 0],
                [0, 0, "#FF0000", "#FF0000", "#FF0000", 0, 0],
                [0, "#FF0000", 0, "#FF0000", 0, "#FF0000", 0]
            ]
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new TransformationSkill();
export default skill;