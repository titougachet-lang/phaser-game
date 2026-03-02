// attackManager.js
import { effects } from './effects.js';

export class AttackManager {
    constructor(scene) {
        this.scene = scene;
        this.activeAttacks = [];
        this.effects = effects;
    }

    executeDynamicAttack(attackCode, x, y, targetX, targetY) {
        try {
            // Crée une classe d'attaque dynamique
            const DynamicAttack = new Function('return ' + attackCode)();
            const attack = new DynamicAttack(this.scene, x, y, targetX, targetY);
            this.activeAttacks.push(attack);
            attack.execute();
            return attack;
        } catch (error) {
            console.error("Erreur d'exécution de l'attaque :", error);
            return null;
        }
    }

    update(delta) {
        this.activeAttacks.forEach((attack, index) => {
            if (!attack.active) {
                this.activeAttacks.splice(index, 1);
            } else if (attack.update) {
                attack.update(delta);
            }
        });
    }
}
