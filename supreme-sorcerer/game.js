// ========== VARIABLES GLOBALES ==========
const playerSpeed = 400;
const deadZoneRadius = 0.15;
const cameraLerpFactor = 0.1;
let playerHealth = 100;
let playerUlti = 0;
const mapWidth = 4000;
const mapHeight = 3000;
const borderThickness = 20;
let gameTime = 0;
let gameActive = true;
let trollSpawnRate = 3;
let lastTrollSpawn = 0;
let trolls = [];
let trollIdCounter = 0;

// ========== EFFETS ==========
const effects = {
    BurnEffect: class {
        constructor(troll) {
            troll.burning = true;
            const burnGraphics = troll.scene.add.graphics().setDepth(8);
            burnGraphics.lineStyle(2, 0xff0000, 0.8);
            burnGraphics.strokeCircle(troll.sprite.x, troll.sprite.y, 20);
            troll.scene.time.addEvent({
                delay: 1000,
                callback: () => {
                    troll.health -= troll.maxHealth * 0.05;
                    troll.healthBar.setScale(troll.health / troll.maxHealth, 1);
                },
                repeat: 2
            });
            troll.scene.time.delayedCall(3000, () => {
                troll.burning = false;
                burnGraphics.destroy();
            });
        }
    },
    HealEffect: class {
        constructor(troll) {
            const healGraphics = troll.scene.add.graphics().setDepth(8);
            healGraphics.lineStyle(2, 0x00ff00, 0.8);
            healGraphics.strokeCircle(troll.sprite.x, troll.sprite.y, 20);
            troll.scene.time.addEvent({
                delay: 1000,
                callback: () => {
                    troll.health = Math.min(troll.maxHealth, troll.health + troll.maxHealth * 0.05);
                    troll.healthBar.setScale(troll.health / troll.maxHealth, 1);
                },
                repeat: 2
            });
            troll.scene.time.delayedCall(3000, () => healGraphics.destroy());
        }
    },
    RepulseEffect: class {
        constructor(troll) {
            const angle = Phaser.Math.Angle.Between(
                troll.sprite.x, troll.sprite.y,
                troll.scene.player.x, troll.scene.player.y
            );
            troll.scene.tweens.add({
                targets: troll.sprite,
                x: troll.sprite.x + Math.cos(angle) * -30,
                y: troll.sprite.y + Math.sin(angle) * -30,
                duration: 200
            });
        }
    },
    DarknessEffect: class {
        constructor(troll, duration) {
            this.troll = troll;
            this.duration = duration * 1000;
            this.endTime = Date.now() + this.duration;
            this.graphics = troll.scene.add.graphics().setDepth(8);
            this.originalSpeed = troll.speed;
            troll.speed *= 0.5;
            this.draw();
        }
        draw() {
            this.graphics.clear();
            this.graphics.fillStyle(0x1A1A2E, 0.3);
            this.graphics.fillCircle(this.troll.sprite.x, this.troll.sprite.y, 15);
        }
        update(delta) {
            if (Date.now() > this.endTime) {
                this.troll.speed = this.originalSpeed;
                this.graphics.destroy();
                return;
            }
            this.draw();
        }
    },
    AttractEffect: class {
        constructor(troll, duration) {
            this.troll = troll;
            this.duration = duration * 1000;
            this.endTime = Date.now() + this.duration;
            this.graphics = troll.scene.add.graphics().setDepth(8);
            this.draw();
        }
        draw() {
            this.graphics.clear();
            this.graphics.lineStyle(2, 0xff00ff, 0.8);
            this.graphics.strokeCircle(this.troll.sprite.x, this.troll.sprite.y, 25);
        }
        update(delta) {
            if (Date.now() > this.endTime) {
                this.graphics.destroy();
                return;
            }
            const angle = Phaser.Math.Angle.Between(
                this.troll.sprite.x, this.troll.sprite.y,
                this.troll.scene.player.x, this.troll.scene.player.y
            );
            this.troll.scene.physics.moveTo(this.troll.sprite, this.troll.scene.player.x, this.troll.scene.player.y, this.troll.speed * 0.5);
            this.draw();
        }
    }
};

// ========== CLASSES D'ATTAQUES PRÉDÉFINIES (Fallback) ==========
class Fireball {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.damagePercent = 0.25;
        this.speed = 500;
        this.radius = 20;
        this.graphics = scene.add.graphics({x: x, y: y}).setDepth(6);
        this.effect = "Burn";
        this.color1 = 0xFF4500;
        this.color2 = 0xFFA500;
    }
    draw() {
        this.graphics.fillStyle(this.color1, 0.8);
        this.graphics.fillCircle(0, 0, this.radius);
        this.graphics.fillStyle(this.color2, 0.5);
        this.graphics.fillCircle(5, 5, this.radius * 0.3);
        this.graphics.fillCircle(-5, -5, this.radius * 0.3);
    }
}

class DarkSword {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.damagePercent = 0.3;
        this.speed = 400;
        this.length = 60;
        this.width = 8;
        this.graphics = scene.add.graphics({x: x, y: y}).setDepth(6);
        this.effect = "Darkness";
        this.color1 = 0x1A1A2E;
        this.color2 = 0x9B5FC0;
    }
    draw() {
        const gradient = this.graphics.createLinearGradient(
            -this.length/2, -this.width/2,
            this.length/2, this.width/2
        );
        gradient.addColorStop(0, '#1A1A2E');
        gradient.addColorStop(1, '#4A1A4A');
        this.graphics.fillStyle(gradient);
        this.graphics.fillRect(-this.length/2, -this.width/2, this.length, this.width);
        this.graphics.lineStyle(1, this.color2);
        this.graphics.lineBetween(-this.length/2 + 10, 0, this.length/2 - 10, 0);
    }
}

class HealingPotion {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.damagePercent = -0.3;
        this.speed = 300;
        this.radius = 15;
        this.graphics = scene.add.graphics({x: x, y: y}).setDepth(6);
        this.effect = "Heal";
        this.color1 = 0x00FF00;
        this.color2 = 0x00AA00;
    }
    draw() {
        this.graphics.fillStyle(this.color1, 0.7);
        this.graphics.fillCircle(0, 0, this.radius);
        this.graphics.lineStyle(1, this.color2);
        this.graphics.strokeCircle(0, 0, this.radius * 0.8);
    }
}

class RepulseWave {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.damagePercent = 0;
        this.speed = 600;
        this.radius = 0;
        this.graphics = scene.add.graphics({x: x, y: y}).setDepth(6);
        this.effect = "Repulse";
        this.color1 = 0x0000FF;
    }
    draw() {
        this.graphics.lineStyle(3, this.color1, 0.7);
        this.graphics.strokeCircle(0, 0, this.radius);
    }
}

// ========== SCÈNES ==========
class PreloadScene extends Phaser.Scene {
    constructor() { super({ key: 'PreloadScene' }); }
    preload() {
        const { width, height } = this.cameras.main;
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0, 0);
        this.add.text(width/2, height/2 - 50, 'Chargement...', {
            fontSize: '32px', fill: '#fff'
        }).setOrigin(0.5);
        const progressBar = this.add.rectangle(width/2, height/2, width*0.5, 20, 0x333333).setOrigin(0.5);
        const progressFill = this.add.rectangle(width/2 - width*0.25, height/2 - 10, 0, 20, 0x00ff00).setOrigin(0, 0.5);
        this.load.on('progress', (value) => { progressFill.width = width*0.5*value; });
        this.load.image('player', 'https://via.placeholder.com/32x32/00ff00/000000?text=P');
        this.load.image('troll', 'https://via.placeholder.com/32x32/ff0000/000000?text=T');
    }
    create() { this.scene.start('MenuScene'); }
}

class MenuScene extends Phaser.Scene {
    constructor() { super({ key: 'MenuScene' }); }
    create() {
        const { width, height } = this.cameras.main;
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0, 0);
        this.add.text(width/2, height/2 - 100, 'Invasion de Trolls', {
            fontSize: '48px', fill: '#fff'
        }).setOrigin(0.5);
        const playButton = this.add.rectangle(width/2, height/2, 200, 60, 0x00aa00)
            .setOrigin(0.5).setInteractive();
        this.add.text(width/2, height/2, 'Jouer', {
            fontSize: '32px', fill: '#fff'
        }).setOrigin(0.5);
        playButton.on('pointerdown', () => {
            gameTime = 0;
            playerHealth = 100;
            playerUlti = 0;
            trolls = [];
            gameActive = true;
            this.scene.start('GameScene');
        });
    }
}

class GameOverScene extends Phaser.Scene {
    constructor() { super({ key: 'GameOverScene' }); }
    create() {
        const { width, height } = this.cameras.main;
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0, 0);
        this.add.text(width/2, height/2 - 100, 'GAME OVER', {
            fontSize: '64px', fill: '#ff0000'
        }).setOrigin(0.5);
        this.add.text(width/2, height/2 - 20, `Score: ${Math.floor(gameTime)} secondes`, {
            fontSize: '32px', fill: '#ffffff'
        }).setOrigin(0.5);
        const replayButton = this.add.rectangle(width/2, height/2 + 50, 200, 60, 0x00aa00)
            .setOrigin(0.5).setInteractive();
        this.add.text(width/2, height/2 + 50, 'Rejouer', {
            fontSize: '32px', fill: '#fff'
        }).setOrigin(0.5);
        replayButton.on('pointerdown', () => {
            gameTime = 0;
            playerHealth = 100;
            playerUlti = 0;
            trolls = [];
            gameActive = true;
            this.scene.start('GameScene');
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.effects = effects;
        this.activeEffects = [];
        this.recording = false;
        this.microIndicator = null;
        this.trolls = [];
    }

    init() {
        this.healthBarBg = null;
        this.healthBar = null;
        this.healthText = null;
        this.ultiCircleBg = null;
        this.ultiText = null;
        this.ultiGraphics = null;
        this.timeText = null;
        this.player = null;
        this.trollGroup = null;
        this.walls = null;
    }

    create() {
        try {
            // Configuration de la map et caméra
            this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
            this.cameras.main.setZoom(1);
            this.cameras.main.scrollX = this.cameras.main.width / 2;
            this.cameras.main.scrollY = this.cameras.main.height / 2;

            // Fond et bordures
            this.add.rectangle(0, 0, mapWidth, mapHeight, 0x006400).setOrigin(0, 0).setDepth(0);
            const graphicsGrid = this.add.graphics().setDepth(1);
            graphicsGrid.lineStyle(1, 0x000000, 0.2);
            for (let x = 0; x < mapWidth; x += 64) {
                graphicsGrid.moveTo(x, 0);
                graphicsGrid.lineTo(x, mapHeight);
            }
            for (let y = 0; y < mapHeight; y += 64) {
                graphicsGrid.moveTo(0, y);
                graphicsGrid.lineTo(mapWidth, y);
            }
            graphicsGrid.strokePath();

            const borderGraphics = this.add.graphics().setDepth(2);
            borderGraphics.lineStyle(borderThickness, 0x0000ff, 1);
            borderGraphics.strokeRect(borderThickness/2, borderThickness/2,
                                      mapWidth - borderThickness, mapHeight - borderThickness);

            // Murs invisibles
            this.walls = [
                this.physics.add.staticGroup(),
                this.physics.add.staticGroup(),
                this.physics.add.staticGroup(),
                this.physics.add.staticGroup()
            ];
            this.walls[0].create(mapWidth/2, borderThickness/2, null).setSize(mapWidth - borderThickness, borderThickness).setVisible(false);
            this.walls[1].create(mapWidth - borderThickness/2, mapHeight/2, null).setSize(borderThickness, mapHeight - borderThickness).setVisible(false);
            this.walls[2].create(mapWidth/2, mapHeight - borderThickness/2, null).setSize(mapWidth - borderThickness, borderThickness).setVisible(false);
            this.walls[3].create(borderThickness/2, mapHeight/2, null).setSize(borderThickness, mapHeight - borderThickness).setVisible(false);

            // Joueur
            // Sprite du joueur (rond bleu texturé)
const playerGraphics = this.add.graphics().setDepth(5);
playerGraphics.fillStyle(0x0000FF, 1);
playerGraphics.fillCircle(0, 0, 16);
playerGraphics.lineStyle(2, 0x00AAFF, 1);
playerGraphics.strokeCircle(0, 0, 16);
playerGraphics.lineStyle(1, 0x0055AA, 1);
playerGraphics.beginPath();
playerGraphics.arc(0, 0, 12, 0, Math.PI * 2);
playerGraphics.stroke();
playerGraphics.setPosition(this.cameras.main.width / 2, this.cameras.main.height / 2);

this.player = this.physics.add.sprite(
    this.cameras.main.width / 2,
    this.cameras.main.height / 2,
    null
).setDepth(5);
this.player.setTexture(playerGraphics.generateTexture('player', 32, 32));
this.player.setCircle(16);

            this.player.body.setCollideWorldBounds(false);

            // Timer
            this.timeText = this.add.text(this.cameras.main.width - 10, 10, `Temps: ${Math.floor(gameTime)}s`, {
                fontSize: '20px', fill: '#fff', backgroundColor: '#00000080'
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

            // UI
            this.createUI();
            this.scale.on('resize', this.resizeUI, this);

            // Inputs
            this.cursors = this.input.keyboard.createCursorKeys();
            this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
            this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
            this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
            this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
            this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

            this.input.on('pointermove', (pointer) => {
                this.mouseX = pointer.x;
                this.mouseY = pointer.y;
            });

            // Groupe de trolls
            this.trollGroup = this.physics.add.group({ collideWorldBounds: false, immovable: false });

            // Collisions
            this.physics.add.collider(this.player, this.trollGroup);
            this.physics.add.collider(this.trollGroup, this.trollGroup);
            this.physics.add.collider(this.trollGroup, this.walls);
            this.physics.add.collider(this.player, this.walls);

            // Indicateur micro
            this.microIndicator = this.add.text(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2,
                "🎤 Parle maintenant !",
                { fontSize: '24px', fill: '#ff0000', backgroundColor: '#00000080' }
            ).setOrigin(0.5).setDepth(10).setVisible(false);

            // Configuration de la reconnaissance vocale
            this.setupVoiceControl();

            // Premier spawn de troll
            this.spawnTroll();

        } catch (error) {
            console.error("Erreur dans GameScene.create:", error);
            this.scene.start('MenuScene');
        }
    }

    createUI() {
    const { width, height } = this.cameras.main;
    // Barre de vie du joueur (simplifiée)
    this.healthBarBg = this.add.rectangle(width*0.05, height*0.05, width*0.2, height*0.03, 0x333333)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    this.healthBar = this.add.rectangle(width*0.05, height*0.05, width*0.2*(playerHealth/100), height*0.03, 0xff0000)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    this.healthText = this.add.text(width*0.02, height*0.04, "PV:", {
        fontSize: '20px', fill: '#fff'
    }).setScrollFactor(0).setDepth(10);
}


    resizeUI() {
        if (!this.healthBarBg) return;
        const { width, height } = this.cameras.main;
        this.healthBarBg.setPosition(width*0.05, height*0.05).setSize(width*0.15, height*0.03);
        this.healthBar.setPosition(width*0.05, height*0.05).setSize(width*0.15*(playerHealth/100), height*0.03);
        this.healthText.setPosition(width*0.02, height*0.04);
        this.timeText.setPosition(width - 10, 10);
        this.ultiCircleBg.setPosition(width/2, height*0.9);
        this.ultiText.setPosition(width/2, height*0.85);
        this.updateUltiCircle();
    }

    updateUltiCircle() {
        if (!this.ultiGraphics) return;
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height * 0.9;
        const radius = width * 0.03;
        this.ultiGraphics.clear();
        this.ultiGraphics.fillStyle(0xffff00, 1);
        this.ultiGraphics.beginPath();
        this.ultiGraphics.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * (playerUlti / 100)), false);
        this.ultiGraphics.lineTo(centerX, centerY);
        this.ultiGraphics.closePath();
        this.ultiGraphics.fillPath();
    }

    spawnTroll() {
    const { width, height } = this.cameras.main;
    const cameraX = this.cameras.main.scrollX;
    const cameraY = this.cameras.main.scrollY;
    const spawnDistance = 500;
    let x, y;
    const side = Phaser.Math.Between(0, 3);
    switch (side) {
        case 0: x = Phaser.Math.Between(cameraX, cameraX + width); y = cameraY - spawnDistance; break;
        case 1: x = cameraX + width + spawnDistance; y = Phaser.Math.Between(cameraY, cameraY + height); break;
        case 2: x = Phaser.Math.Between(cameraX, cameraX + width); y = cameraY + height + spawnDistance; break;
        case 3: x = cameraX - spawnDistance; y = Phaser.Math.Between(cameraY, cameraY + height); break;
    }
    x = Phaser.Math.Clamp(x, borderThickness, mapWidth - borderThickness);
    y = Phaser.Math.Clamp(y, borderThickness, mapHeight - borderThickness);

    // Sprite du troll (rond vert texturé)
    const trollGraphics = this.add.graphics().setDepth(4);
    trollGraphics.fillStyle(0x00FF00, 1);
    trollGraphics.fillCircle(0, 0, 16);
    trollGraphics.lineStyle(2, 0x00AA00, 1);
    trollGraphics.strokeCircle(0, 0, 16);
    trollGraphics.lineStyle(1, 0x005500, 1);
    trollGraphics.beginPath();
    trollGraphics.arc(0, 0, 12, 0, Math.PI * 2);
    trollGraphics.stroke();
    trollGraphics.setPosition(x, y);

    const troll = this.physics.add.sprite(x, y, null).setDepth(4);
    troll.setCircle(16);
    troll.setTexture(trollGraphics.generateTexture('troll' + trollIdCounter, 32, 32));
    this.trollGroup.add(troll);

    // Barre de vie
    const healthBarBg = this.add.rectangle(x, y - 20, 30, 4, 0x333333).setOrigin(0.5).setDepth(5);
    const healthBar = this.add.rectangle(x - 15, y - 20, 30, 4, 0xff0000).setOrigin(0).setDepth(5);

    const gameProgress = Math.min(1, gameTime / 60);
    const trollData = {
        id: trollIdCounter++,
        sprite: troll,
        health: Phaser.Math.FloatBetween(20 + gameProgress*10, 30 + gameProgress*10),
        maxHealth: Phaser.Math.FloatBetween(20 + gameProgress*10, 30 + gameProgress*10),
        speed: Phaser.Math.FloatBetween(100 + gameProgress*50, 150 + gameProgress*50),
        damagePerSecond: Phaser.Math.FloatBetween(1 + gameProgress*2, 3 + gameProgress*2),
        lastDamageTime: 0,
        healthBarBg: healthBarBg,
        healthBar: healthBar
    };
    this.trolls.push(trollData);

    return trollData;
}


    setupVoiceControl() {
        this.input.keyboard.on('keydown-SPACE', async () => {
            if (!this.recording) {
                this.recording = true;
                this.microIndicator.setVisible(true);
                try {
                    const transcription = await this.recordAndTranscribe();
                    this.microIndicator.setVisible(false);
                    if (transcription) {
                        console.log("Transcription :", transcription);
                        const attackCode = await this.generateAttackWithMistral(transcription);
                        if (attackCode) {
                            const angle = Phaser.Math.Angle.Between(
                                this.player.x, this.player.y,
                                this.input.mousePointer.worldX,
                                this.input.mousePointer.worldY
                            );
                            const targetX = this.player.x + Math.cos(angle) * 300;
                            const targetY = this.player.y + Math.sin(angle) * 300;
                            this.executeDynamicAttack(attackCode, this.player.x, this.player.y, targetX, targetY);
                        }
                    }
                } catch (error) {
                    console.error("Erreur dans setupVoiceControl:", error);
                } finally {
                    this.recording = false;
                }
            }
        });
    }

    async recordAndTranscribe() {
        return new Promise((resolve) => {
            try {
                const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                if (!recognition) {
                    alert("La reconnaissance vocale n'est pas supportée. Utilise Chrome ou Firefox.");
                    resolve(null);
                    return;
                }

                recognition.lang = 'fr-FR';
                recognition.interimResults = false;

                recognition.onerror = (event) => {
                    console.error("Erreur de reconnaissance :", event.error);
                    if (event.error === 'no-speech') {
                        alert("Aucun son détecté. Parle clairement après avoir appuyé sur ESPACE !");
                    } else if (event.error === 'not-allowed') {
                        alert("Micro bloqué. Autorise-le dans les paramètres du navigateur.");
                    }
                    resolve(null);
                };

                recognition.onresult = (event) => resolve(event.results[0][0].transcript);
                recognition.onstart = () => console.log("Reconnaissance démarrée. Parle !");
                recognition.start();

            } catch (error) {
                console.error("Erreur dans recordAndTranscribe:", error);
                resolve(null);
            }
        });
    }

    // Appel à l'API Mistral via Ngrok
async generateAttackWithMistral(userRequest) {
    try {
        const response = await fetch('http://localhost:5000/api/attack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user_request: userRequest })
        });

        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status}`);
        }

        // On récupère le texte brut (pas du JSON)
        const attackCode = await response.text();
        return attackCode;

    } catch (error) {
        console.error("Erreur avec l'API locale:", error);
        throw error;
    }
}


   executeDynamicAttack(attackCode, x, y, targetX, targetY) {
    try {
        const cleanCode = attackCode.replace(/`/g, '').trim();
        const classNameMatch = cleanCode.match(/class (\w+)/);
        if (!classNameMatch) throw new Error("Nom de classe introuvable.");
        const className = classNameMatch[1];
        const AttackClass = window.Function(`${cleanCode}\nreturn ${className};`)();
        const attack = new AttackClass(this, x, y);

        if (typeof attack.draw !== 'function') {
            attack.draw = function() {
                this.graphics.fillStyle(0xFF4500, 0.8);
                this.graphics.fillCircle(0, 0, this.radius || 20);
            };
        }
        attack.draw();

        const distance = Phaser.Math.Distance.Between(x, y, targetX, targetY);
        const duration = distance / (attack.speed || 500);
        const scene = this;
        const trolls = this.trolls; // Utilise this.trolls directement

        if (!trolls) {
            console.error("ERREUR : this.trolls est undefined !");
            return;
        }

        this.tweens.add({
            targets: attack.graphics,
            x: targetX,
            y: targetY,
            duration: duration * 1000,
            onUpdate: () => {
                attack.graphics.clear();
                attack.draw();
                trolls.forEach(troll => {
                    if (!troll || !troll.sprite || troll.health <= 0) return;
                    const dist = Phaser.Math.Distance.Between(
                        attack.graphics.x, attack.graphics.y,
                        troll.sprite.x, troll.sprite.y
                    );
                    if (dist < (attack.radius || 30)) {
                        const damage = troll.maxHealth * (attack.damagePercent || 0.25);
                        troll.health = Math.max(0, troll.health - damage);
                        if (troll.healthBar) {
                            troll.healthBar.setScale(troll.health / troll.maxHealth, 1);
                        }
                        if (troll.health <= 0) {
                            troll.sprite.destroy();
                            if (troll.healthBarBg) troll.healthBarBg.destroy();
                            if (troll.healthBar) troll.healthBar.destroy();
                            const index = trolls.indexOf(troll);
                            if (index > -1) trolls.splice(index, 1);
                        }
                    }
                });
            },
            onComplete: () => {
                if (attack.graphics) attack.graphics.destroy();
            }
        });
    } catch (error) {
        console.error("Erreur :", error);
    }
}






    update(time, delta) {
        if (!gameActive) return;

        gameTime += delta / 1000;
        this.timeText.setText(`Temps: ${Math.floor(gameTime)}s`);

        if (time > lastTrollSpawn + trollSpawnRate * 1000) {
            this.spawnTroll();
            lastTrollSpawn = time;
            trollSpawnRate = Math.max(0.3, 3 - gameTime * 0.02);
        }

        trolls.forEach(troll => {
            const angle = Phaser.Math.Angle.Between(
                troll.sprite.x, troll.sprite.y,
                this.player.x, this.player.y
            );
            this.physics.moveTo(troll.sprite, this.player.x, this.player.y, troll.speed);
            troll.healthBarBg.setPosition(troll.sprite.x, troll.sprite.y - 20);
            troll.healthBar.setPosition(troll.sprite.x - 15, troll.sprite.y - 20);
            troll.healthBar.setScale(troll.health / troll.maxHealth, 1);

            if (Phaser.Math.Distance.Between(troll.sprite.x, troll.sprite.y, this.player.x, this.player.y) < 34) {
                if (time > troll.lastDamageTime + 1000) {
                    playerHealth = Math.max(0, playerHealth - troll.damagePerSecond);
                    this.healthBar.setSize(this.healthBarBg.width * (playerHealth / 100), this.healthBarBg.height);
                    troll.lastDamageTime = time;
                    if (playerHealth <= 0) {
                        gameActive = false;
                        this.scene.pause();
                        this.scene.launch('GameOverScene');
                    }
                }
            }

            troll.effects.forEach(effect => {
                if (effect.update) effect.update(delta);
            });
        });

        this.player.setVelocity(0);
        if (this.keyW.isDown || this.keyZ.isDown) this.player.setVelocityY(-playerSpeed);
        else if (this.keyS.isDown) this.player.setVelocityY(playerSpeed);
        if (this.keyA.isDown || this.keyQ.isDown) this.player.setVelocityX(-playerSpeed);
        else if (this.keyD.isDown) this.player.setVelocityX(playerSpeed);

        if (this.mouseX !== undefined) {
            const worldMouseX = this.cameras.main.scrollX + this.mouseX;
            const worldMouseY = this.cameras.main.scrollY + this.mouseY;
            this.player.rotation = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldMouseX, worldMouseY);
        }

        const { width, height } = this.cameras.main;
        this.healthBar.setSize(width * 0.15 * (playerHealth / 100), height * 0.03);
        this.updateUltiCircle();

        const cameraCenterX = this.cameras.main.scrollX + this.cameras.main.width / 2;
        const cameraCenterY = this.cameras.main.scrollY + this.cameras.main.height / 2;
        const dx = this.player.x - cameraCenterX;
        const dy = this.player.y - cameraCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const currentDeadZoneRadius = Math.min(
            this.cameras.main.width * deadZoneRadius,
            this.cameras.main.height * deadZoneRadius
        );

        if (distance > currentDeadZoneRadius) {
            const angle = Math.atan2(dy, dx);
            const targetX = this.player.x - Math.cos(angle) * currentDeadZoneRadius;
            const targetY = this.player.y - Math.sin(angle) * currentDeadZoneRadius;
            this.cameras.main.scrollX = Phaser.Math.Linear(
                this.cameras.main.scrollX, targetX - this.cameras.main.width / 2, cameraLerpFactor
            );
            this.cameras.main.scrollY = Phaser.Math.Linear(
                this.cameras.main.scrollY, targetY - this.cameras.main.height / 2, cameraLerpFactor
            );
        }

        if (this.keyE.isDown) {
            playerUlti = Math.min(100, playerUlti + 0.5);
            this.updateUltiCircle();
        }
    }
}

// ========== CONFIGURATION ET INITIALISATION ==========
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container',
        width: '100%',
        height: '100%',
        expandParent: true,
        min: { width: 400, height: 300 },
        max: { width: 1600, height: 1200 }
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [PreloadScene, MenuScene, GameScene, GameOverScene]
};

// Modification pour +5% d'ulti par troll tué
const originalSpawnTroll = GameScene.prototype.spawnTroll;
GameScene.prototype.spawnTroll = function() {
    const troll = originalSpawnTroll.call(this);
    const originalHealth = troll.health;
    const checkHealth = () => {
        if (troll.health <= 0 && troll.health !== originalHealth) {
            playerUlti = Math.min(100, playerUlti + 5);
            this.updateUltiCircle();
            troll.sprite.off('destroy', checkHealth);
        }
    };
    troll.sprite.on('destroy', checkHealth);
    return troll;
};

// Initialisation du jeu
const game = new Phaser.Game(config);
