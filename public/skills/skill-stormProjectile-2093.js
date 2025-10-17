import { BaseSkill } from '../baseSkill.js';

class StormProjectileSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-stormProjectile-2093";
        this.metadata = {
            name: "Proyectil de Tormenta",
            description: "Lanza un proyectil que crea una tormenta que daña a los enemigos",
            skillType: "PROJECTILE",
            seffects: "seffect-stormField-2093",
            
            trigger: {
                interval: 6000,
                chance: 0.7
            },
            
            sounds: {
                start: ["sine", 660, 250, 7, 60, 2500, 4, 0, 0, false, true, 70, 50, 30]
            },
            
            fx: {
                start: "fx-stormStart-2093",
                impact: "fx-stormImpact-2093"
            },
            
            target: ["enemies"],
            
            projectileConfig: {
                speed: 4,
                size: 12,
                color: "#87CEEB",
                trailColor: "#B0E0E6",
                maxDistance: 320,
                damage: 0,
                count: 1,
                spreadAngle: 0,
                areaEffect: true,
                areaRadius: 80
            }
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new StormProjectileSkill();
export default skill;