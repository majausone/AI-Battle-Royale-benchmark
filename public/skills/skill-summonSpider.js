import { BaseSkill, registerSkill } from '../baseSkill.js';

class SummonSpiderSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-summonSpider";
        this.metadata = {
            name: "Summon Spider",
            description: "Periodically summons a spider minion",
            skillType: "SUMMON",
            seffects: null,
            
            trigger: {
                interval: 5000,
                chance: 0.4
            },
            
            sounds: {
                start: ["triangle", 240, 700, 6, 70, 800, 14, 0, 0, false, true, 20, 60, 40]
            },
            
            summonProperties: {
                health: 10,
                speed: 1.5,
                damage: 5,
                scale: 7.5,
                summonCount: 1,
                summonDuration: 15000,
                attackType: 'melee',
                attackRange: 70,
                attackSpeed: 2000,
                graphics: [
                    [0, 0, 0, "#00FF00", 0, "#00FF00", 0, 0, 0],
                    ["#00FF00", 0, "#00FF00", 0, "#00FF00", 0, "#00FF00", 0, "#00FF00"],
                    [0, "#00FF00", "#00FF00", "#00FF00", "#00FF00", "#00FF00", "#00FF00", "#00FF00", 0],
                    [0, 0, "#00FF00", "#00FF00", "#00FF00", "#00FF00", "#00FF00", 0, 0],
                    ["#00FF00", 0, "#00FF00", 0, "#00FF00", 0, "#00FF00", 0, "#00FF00"],
                    [0, "#00FF00", 0, 0, "#00FF00", 0, 0, "#00FF00", 0]
                ],
                swordGraphics: {
                    width: 40,
                    height: 4,
                    color: '#00ff00'
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

const skill = new SummonSpiderSkill();
export default skill;