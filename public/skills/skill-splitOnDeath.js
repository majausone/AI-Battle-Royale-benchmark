import { BaseSkill } from '../baseSkill.js';

class SplitOnDeathSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-splitOnDeath";
        this.metadata = {
            name: "Split On Death",
            description: "Creates two smaller copies when killed",
            skillType: "SUMMON",
            seffects: null,

            trigger: {
                onDeath: true
            },

            sounds: {
                start: ["sawtooth", 150, 1000, 18, 100, 4500, 18, 0, 0, false, true, 20, 10, 0]
            },

            summonProperties: {
                inheritType: true,
                scale: 4,
                health: 25,
                speed: 2,
                damage: 4,
                summonCount: 2,
                summonDuration: -1,
                graphics: [
                    [0, "#00FF00", 0],
                    ["#00FF00", "#00FF00", "#00FF00"],
                    [0, "#00FF00", 0]
                ],
                attackType: 'melee',
                attackRange: 40,
                attackSpeed: 800,
                swordGraphics: {
                    width: 30,
                    height: 3,
                    color: '#00FF00'
                },
                fx: {
                    start: "fx-basicSpawn",
                    continuous: "fx-basicGlow"
                }
            }
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new SplitOnDeathSkill();
export default skill;