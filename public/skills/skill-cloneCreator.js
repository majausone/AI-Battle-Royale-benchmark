import { BaseSkill } from '../baseSkill.js';

class CloneCreatorSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-cloneCreator";
        this.metadata = {
            name: "Clone Creator",
            description: "Creates temporary clones of the unit",
            skillType: "SUMMON",
            seffects: null,
            
            trigger: {
                interval: 10000,
                duration: 5000
            },
            
            sounds: {
                start: ["sine", 880, 400, 5, 30, 3000, 4, 0, 0, false, true, 70, 50, 30]
            },
            
            summonProperties: {
                inheritType: true,
                inheritGraphics: true,
                inheritHealth: true,
                inheritAttack: true,
                inheritSpeed: true,
                inheritDamage: true,
                summonCount: 2,
                summonDuration: 5000,
                scale: null,
                health: 10,
                speed: null,
                fx: {
                    start: "fx-cloneStart",
                    continuous: "fx-cloneContinuous"
                }
            }
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new CloneCreatorSkill();
export default skill;