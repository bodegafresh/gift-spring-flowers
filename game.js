// ----- Configuración general -----
const W = 420,
  H = 820;
const COLS = 6,
  ROWS = 8,
  TILE = 64,
  TOP_OFFSET = 220;
const TYPES = { CAR: 0, FUEL: 1, FLOWER: 2, BLOCK: 3 }; // piezas: Paraguay, Trébol, Flores, Chile
const TYPE_KEYS = ["t_car", "t_fuel", "t_flower", "t_block"]; // sprites programáticos
const MATCH_MIN = 3;

// Progresos
const GOAL = 100; // llegar a 100% para ganar
const ADVANCE = { CAR: 6, FUEL: 4, FLOWER: 3, BLOCK: 2 }; // avance: Paraguay=6, Trébol=4, Flores=3, Chile=2
const FUEL_BONUS = 1.5; // multiplicador por match de trébol
const FLOWER_RAMOS = 1; // ramos por cada 3 flores

// ----- Configuración del fondo animado -----
const BACKGROUND_CONFIG = {
  SPRITE_COUNT: 8, // Número de sprites flotantes
  SPEED_MIN: 30, // Velocidad mínima hacia arriba
  SPEED_MAX: 80, // Velocidad máxima hacia arriba
  SCALE_MIN: 0.3, // Escala mínima
  SCALE_MAX: 0.8, // Escala máxima
  OPACITY_MIN: 0.2, // Opacidad mínima
  OPACITY_MAX: 0.6, // Opacidad máxima
};

// ----- Configuración del auto progresivo -----
const CAR_PROGRESS_CONFIG = {
  // Frames del auto (fila superior del sprite sheet)
  CAR_FRAMES: [0, 1, 2], // Frames 0, 1, 2 para los diferentes estados del auto
  // Frames de las ruedas (fila inferior del sprite sheet)
  WHEEL_FRAMES: [3, 4, 5], // Frames 3, 4, 5 para las ruedas
  // Umbrales de progreso para cambiar de frame
  PROGRESS_THRESHOLDS: [33, 66, 100], // Cambiar auto en 33%, 66%, 100%
};

// ----- Escena Boot: crea "assets" con canvas -----
class Boot extends Phaser.Scene {
  constructor() {
    super("boot");
  }
  preload() {
    // Cargar el sprite sheet desde assets para fondo
    this.load.image("background_sprites", "assets/sprite01.png");

    // Cargar el sprite sheet como atlas para el auto progresivo
    // Los autos son más anchos, ajustando dimensiones
    this.load.spritesheet("car_progress", "assets/sprite01.png", {
      frameWidth: 240,
      frameHeight: 120,
    });

    // Cargar imagen de fondo del juego
    this.load.image("game_background", "assets/background.jpg");

    // Cargar video para la pantalla de victoria (autoplay-friendly)
    console.log("Cargando video de victoria...");

    this.load.video(
      "victory_video",
      ["assets/output_loop.webm", "assets/output_loop.mp4"],
      "loadeddata", // espera a que haya datos suficientes
      false, // asBlob
      true // noAudio = true  <-- clave para autoplay
    );

    // Eventos de carga para debugging
    this.load.on("filecomplete-video-victory_video", () => {
      console.log("Video victory_video cargado exitosamente");
    });

    this.load.on("loaderror", (file) => {
      if (file.key === "victory_video") {
        console.log("Error cargando video victory_video:", file);
      }
    });
  }
  create() {
    const mk = (key, bg, glyph) => {
      const g = this.add.graphics();
      g.fillStyle(bg, 1).fillRoundedRect(0, 0, TILE - 6, TILE - 6, 10);
      g.lineStyle(4, 0x0b0f1a, 1).strokeRoundedRect(
        0,
        0,
        TILE - 6,
        TILE - 6,
        10
      );
      const rt = this.make.renderTexture({
        x: 0,
        y: 0,
        width: TILE,
        height: TILE,
        add: false,
      });
      rt.draw(g, 3, 3);
      const txt = this.add
        .text(0, 0, glyph, {
          font: `bold ${Math.floor(TILE * 0.4)}px Arial`,
          color: "#ffffff",
        })
        .setOrigin(0.5);
      // Centrar perfectamente el texto en el cuadro
      rt.draw(txt, TILE / 2, TILE / 2);
      g.destroy();
      txt.destroy();
      rt.saveTexture(key);
      rt.destroy();
    };
    mk("t_car", 0x4dabf7, "🇵🇾");
    mk("t_fuel", 0x2ec4b6, "🍀");
    mk("t_flower", 0xffd166, "🌼");
    mk("t_block", 0xff6b6b, "🇨🇱");
    this.scene.start("menu");
  }
}

// ----- Clase para manejar fondo animado -----
class AnimatedBackground {
  constructor(scene) {
    this.scene = scene;
    this.sprites = [];
    this.init();
  }

  init() {
    // Crear sprites flotantes
    for (let i = 0; i < BACKGROUND_CONFIG.SPRITE_COUNT; i++) {
      this.createFloatingSprite();
    }
  }

  createFloatingSprite() {
    // Posición inicial aleatoria
    const x = Phaser.Math.Between(0, W);
    const y = Phaser.Math.Between(H, H + 200); // Empezar debajo de la pantalla

    // Crear sprite con la imagen cargada
    const sprite = this.scene.add.image(x, y, "background_sprites");

    // Configurar propiedades aleatorias
    const scale = Phaser.Math.FloatBetween(
      BACKGROUND_CONFIG.SCALE_MIN,
      BACKGROUND_CONFIG.SCALE_MAX
    );
    const alpha = Phaser.Math.FloatBetween(
      BACKGROUND_CONFIG.OPACITY_MIN,
      BACKGROUND_CONFIG.OPACITY_MAX
    );
    const speed = Phaser.Math.Between(
      BACKGROUND_CONFIG.SPEED_MIN,
      BACKGROUND_CONFIG.SPEED_MAX
    );

    sprite.setScale(scale);
    sprite.setAlpha(alpha);
    sprite.setDepth(-1); // Enviar al fondo

    // Almacenar velocidad en el sprite
    sprite.moveSpeed = speed;

    // Agregar rotación suave aleatoria
    const rotationSpeed = Phaser.Math.FloatBetween(-0.5, 0.5);
    this.scene.tweens.add({
      targets: sprite,
      rotation: sprite.rotation + Math.PI * 2,
      duration: 8000 / Math.abs(rotationSpeed),
      repeat: -1,
      ease: "Linear",
    });

    this.sprites.push(sprite);
    return sprite;
  }

  update() {
    // Mover sprites hacia arriba y reciclar
    this.sprites.forEach((sprite) => {
      sprite.y -= sprite.moveSpeed * (1 / 60); // Movimiento basado en 60fps

      // Si el sprite sale por arriba, reciclarlo abajo
      if (sprite.y < -100) {
        sprite.y = H + Phaser.Math.Between(50, 200);
        sprite.x = Phaser.Math.Between(0, W);

        // Cambiar propiedades aleatorias al reciclar
        const scale = Phaser.Math.FloatBetween(
          BACKGROUND_CONFIG.SCALE_MIN,
          BACKGROUND_CONFIG.SCALE_MAX
        );
        const alpha = Phaser.Math.FloatBetween(
          BACKGROUND_CONFIG.OPACITY_MIN,
          BACKGROUND_CONFIG.OPACITY_MAX
        );
        const speed = Phaser.Math.Between(
          BACKGROUND_CONFIG.SPEED_MIN,
          BACKGROUND_CONFIG.SPEED_MAX
        );

        sprite.setScale(scale);
        sprite.setAlpha(alpha);
        sprite.moveSpeed = speed;
      }
    });
  }

  destroy() {
    this.sprites.forEach((sprite) => sprite.destroy());
    this.sprites = [];
  }
}

// ----- Clase para el auto progresivo -----
class ProgressiveCar {
  constructor(scene, startX, y) {
    this.scene = scene;
    this.startX = startX; // Posición inicial (derecha)
    this.endX = W - 60; // Posición final (cerca de "Meta")
    this.y = y;
    this.currentProgress = 0;
    this.currentCarFrame = 0;
    this.currentX = startX; // Posición actual del auto

    // Crear el sprite del auto con mayor tamaño
    this.carSprite = this.scene.add.image(
      startX,
      y,
      "car_progress",
      CAR_PROGRESS_CONFIG.CAR_FRAMES[0]
    );
    this.carSprite.setScale(0.5); // Ajustar tamaño para las nuevas dimensiones

    // Crear las ruedas (inicialmente invisibles)
    this.wheelSprites = [];
    this.createWheels();
  }

  createWheels() {
    // Posiciones aproximadas de las ruedas relativas al auto
    const wheelPositions = [
      { x: this.currentX - 30, y: this.y + 35 }, // Rueda trasera
      { x: this.currentX + 30, y: this.y + 35 }, // Rueda delantera
    ];

    wheelPositions.forEach((pos, index) => {
      const wheel = this.scene.add.image(
        pos.x,
        pos.y,
        "car_progress",
        CAR_PROGRESS_CONFIG.WHEEL_FRAMES[0]
      );
      wheel.setScale(0.3); // Ruedas más pequeñas para las nuevas dimensiones
      wheel.setVisible(false); // Inicialmente invisibles
      this.wheelSprites.push(wheel);
    });
  }

  updateProgress(progressPercent) {
    this.currentProgress = progressPercent;

    // Calcular nueva posición X basada en el progreso (de derecha a izquierda)
    const progressRatio = progressPercent / 100;
    this.currentX = this.startX + (this.endX - this.startX) * progressRatio;

    // Mover el auto suavemente a la nueva posición
    this.scene.tweens.add({
      targets: this.carSprite,
      x: this.currentX,
      duration: 300,
      ease: "Power2",
    });

    // Determinar qué frame del auto usar basado en el progreso
    let carFrameIndex = 0;
    for (let i = 0; i < CAR_PROGRESS_CONFIG.PROGRESS_THRESHOLDS.length; i++) {
      if (progressPercent >= CAR_PROGRESS_CONFIG.PROGRESS_THRESHOLDS[i]) {
        carFrameIndex = i;
      }
    }

    // Cambiar frame del auto si es necesario
    if (carFrameIndex !== this.currentCarFrame) {
      this.currentCarFrame = carFrameIndex;
      this.carSprite.setFrame(CAR_PROGRESS_CONFIG.CAR_FRAMES[carFrameIndex]);

      // Mostrar ruedas cuando el auto empiece a moverse (progreso > 0)
      if (progressPercent > 0) {
        this.wheelSprites.forEach((wheel, index) => {
          wheel.setVisible(true);
          wheel.setFrame(CAR_PROGRESS_CONFIG.WHEEL_FRAMES[carFrameIndex]);

          // Mover ruedas junto con el auto
          const wheelX = index === 0 ? this.currentX - 30 : this.currentX + 30;
          this.scene.tweens.add({
            targets: wheel,
            x: wheelX,
            duration: 300,
            ease: "Power2",
          });
        });

        // Animar ruedas girando
        this.animateWheels();
      }
    } else if (progressPercent > 0) {
      // Solo mover las ruedas si ya están visibles
      this.wheelSprites.forEach((wheel, index) => {
        if (wheel.visible) {
          const wheelX = index === 0 ? this.currentX - 30 : this.currentX + 30;
          this.scene.tweens.add({
            targets: wheel,
            x: wheelX,
            duration: 300,
            ease: "Power2",
          });
        }
      });
    }
  }

  animateWheels() {
    // Hacer que las ruedas giren cuando hay progreso
    if (this.currentProgress > 0) {
      this.wheelSprites.forEach((wheel) => {
        // Detener animación anterior si existe
        this.scene.tweens.killTweensOf(wheel);

        // Crear nueva animación de rotación
        this.scene.tweens.add({
          targets: wheel,
          rotation: wheel.rotation + Math.PI * 2,
          duration: 1000 - this.currentProgress * 8, // Más rápido con más progreso
          repeat: -1,
          ease: "Linear",
        });
      });
    }
  }

  destroy() {
    if (this.carSprite) this.carSprite.destroy();
    this.wheelSprites.forEach((wheel) => wheel.destroy());
    this.wheelSprites = [];
  }
}

// ----- Menú -----
class Menu extends Phaser.Scene {
  constructor() {
    super("menu");
  }
  create() {
    this.cameras.main.setBackgroundColor("#0f1522");

    // Agregar imagen de fondo
    const background = this.add.image(W / 2, H / 2, "game_background");
    // Escalar la imagen para cubrir toda la pantalla manteniendo proporción
    const scaleX = W / background.width;
    const scaleY = H / background.height;
    const scale = Math.max(scaleX, scaleY);
    background.setScale(scale);
    background.setDepth(-10); // Enviar al fondo más profundo
    const title = this.add
      .text(W / 2, 70, "Ruta de Flores", {
        font: "bold 32px Arial",
        color: "#ffd166",
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 120, "Match & Merge para la conductora favorita", {
        font: "18px Arial",
        color: "#cfe7ff",
      })
      .setOrigin(0.5);

    // Auto "progreso"
    const car = this.add.image(60, 180, "t_car").setScale(1.1).setOrigin(0.5);
    this.tweens.add({
      targets: car,
      x: W - 60,
      yoyo: true,
      repeat: -1,
      duration: 1600,
      ease: "sine.inOut",
    });

    const how =
      "Toca y arrastra para intercambiar piezas adyacentes.\n" +
      "Forma líneas de 3+ para avanzar.\n" +
      "🇵🇾 Paraguay = gran avance, 🍀 Trébol = turbo,\n🌼 Flores = suma ramos, 🇨🇱 Chile = progreso";
    this.add
      .text(W / 2, 240, how, {
        font: "18px Arial",
        color: "#eaeaea",
        align: "center",
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(W / 2, 320, 220, 50, 0xffd166)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(W / 2, 320, "Comenzar", { font: "bold 20px Arial", color: "#000" })
      .setOrigin(0.5);
    btn.on("pointerdown", () => this.scene.start("game"));
  }

  update() {
    // El fondo ahora es una imagen estática, no necesita actualización
  }
}

// ----- Juego principal -----
class Game extends Phaser.Scene {
  constructor() {
    super("game");
  }
  init() {
    this.board = [];
    this.sprites = [];
    this.inputEnabled = true;
    this.progress = 0;
    this.ramos = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor("#0f1522");

    // Agregar imagen de fondo
    const background = this.add.image(W / 2, H / 2, "game_background");
    // Escalar la imagen para cubrir toda la pantalla manteniendo proporción
    const scaleX = W / background.width;
    const scaleY = H / background.height;
    const scale = Math.max(scaleX, scaleY);
    background.setScale(scale);
    background.setDepth(-10); // Enviar al fondo más profundo

    // HUD
    this.add.text(20, 12, "La Ruta de la Reina Ydalina", {
      font: "bold 20px Arial",
      color: "#ffd166",
    });
    this.progressBar = this.add
      .rectangle(20, 50, W - 40, 14, 0x1a2a3a)
      .setOrigin(0);
    this.progressFill = this.add
      .rectangle(20, 50, 0, 14, 0x4dabf7)
      .setOrigin(0);
    this.progressText = this.add.text(20, 70, "Meta: 0%", {
      font: "16px Arial",
      color: "#cfe7ff",
    });

    this.add.text(20, 98, "Ramos 🌼:", {
      font: "16px Arial",
      color: "#ffd166",
    });
    this.ramosText = this.add.text(110, 98, "0", {
      font: "bold 18px Arial",
      color: "#ffffff",
    });

    // Línea de meta gráfica
    this.add.text(W - 100, 70, "Meta", {
      font: "16px Arial",
      color: "#ffd166",
    });

    // Carretera estética
    const road = this.add
      .rectangle(W / 2, TOP_OFFSET - 80, W - 40, 90, 0x182235)
      .setStrokeStyle(3, 0x2d3a52);

    // Auto progresivo en lugar del estático (empieza desde la derecha)
    this.progressiveCar = new ProgressiveCar(this, 60, TOP_OFFSET - 80);

    // Crear tablero y sprites
    for (let r = 0; r < ROWS; r++) {
      this.board[r] = [];
      this.sprites[r] = [];
    }
    this.fillBoardNoMatchStart();

    // Input táctil / mouse - configuración mejorada
    this.input.on("pointerdown", this.onDown, this);
    this.input.on("pointermove", this.onMove, this);
    this.input.on("pointerup", this.onUp, this);

    // Eventos táctiles adicionales para mejor compatibilidad móvil
    this.input.on("gameobjectdown", this.onDown, this);
    this.input.on("gameobjectup", this.onUp, this);

    this.selected = null;
    this.swapped = false;

    // Resolver si hay matches iniciales
    this.resolveMatchesLoop();
  }

  // ----- Tablero -----
  randomType() {
    // Distribución simple (ajusta si quieres balancear)
    const pool = [TYPES.CAR, TYPES.FUEL, TYPES.FLOWER, TYPES.BLOCK];
    return Phaser.Utils.Array.GetRandom(pool);
  }
  tileAt(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? this.board[r][c] : null;
  }

  fillBoardNoMatchStart() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let t;
        do {
          t = this.randomType();
        } while (this.createsImmediateMatch(r, c, t));
        this.board[r][c] = t;
        const spr = this.add
          .image(
            c * TILE + TILE / 2 + (W - COLS * TILE) / 2,
            r * TILE + TILE / 2 + TOP_OFFSET,
            TYPE_KEYS[t]
          )
          .setScale(1)
          .setInteractive({ useHandCursor: true });

        // Almacenar coordenadas del tablero en el sprite para fácil acceso
        spr.boardRow = r;
        spr.boardCol = c;

        this.sprites[r][c] = spr;
      }
    }
  }
  createsImmediateMatch(r, c, t) {
    // Evitar triples horizontales/verticales en spawn
    return (
      (c >= 2 && this.board[r][c - 1] === t && this.board[r][c - 2] === t) ||
      (r >= 2 && this.board[r - 1][c] === t && this.board[r - 2][c] === t)
    );
  }

  // ----- Conversión de coordenadas -----
  coordsFromPointer(pointer) {
    // Convertir coordenadas del pointer a coordenadas del tablero
    const boardStartX = (W - COLS * TILE) / 2;
    const boardStartY = TOP_OFFSET;

    const localX = pointer.x - boardStartX;
    const localY = pointer.y - boardStartY;

    const c = Math.floor(localX / TILE);
    const r = Math.floor(localY / TILE);

    // Verificar que esté dentro del tablero
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      return { r, c };
    }
    return null;
  }

  // ----- Input swap -----
  onDown(p, gameObject) {
    if (!this.inputEnabled) return;
    this.startPos = { x: p.x, y: p.y };

    // Si se hizo clic en un sprite del juego, usar sus coordenadas directamente
    if (
      gameObject &&
      gameObject.boardRow !== undefined &&
      gameObject.boardCol !== undefined
    ) {
      this.selected = { r: gameObject.boardRow, c: gameObject.boardCol };
    } else {
      // Fallback: convertir coordenadas del pointer
      this.selected = this.coordsFromPointer(p);
    }
  }
  onMove(p) {
    if (!this.inputEnabled || !this.selected || this.swapped) return;
    const dx = p.x - this.startPos.x,
      dy = p.y - this.startPos.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    let dir = null;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
    else dir = dy > 0 ? "down" : "up";
    const { r, c } = this.selected;
    let r2 = r,
      c2 = c;
    if (dir === "right") c2++;
    if (dir === "left") c2--;
    if (dir === "down") r2++;
    if (dir === "up") r2--;
    if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return;
    this.trySwap(r, c, r2, c2);
    this.swapped = true;
  }
  onUp() {
    this.selected = null;
    this.swapped = false;
  }

  trySwap(r1, c1, r2, c2) {
    if (!this.inputEnabled) return;
    this.inputEnabled = false;

    this.swapTiles(r1, c1, r2, c2);
    this.tweenSwap(r1, c1, r2, c2);

    this.time.delayedCall(160, () => {
      const matches = this.findMatches();
      if (matches.length === 0) {
        // deshacer
        this.swapTiles(r1, c1, r2, c2);
        this.tweenSwap(r1, c1, r2, c2);
        this.time.delayedCall(160, () => {
          this.inputEnabled = true;
        });
      } else {
        this.resolveMatchesLoop(matches);
      }
    });
  }

  swapTiles(r1, c1, r2, c2) {
    const t = this.board[r1][c1];
    this.board[r1][c1] = this.board[r2][c2];
    this.board[r2][c2] = t;
    const s = this.sprites[r1][c1];
    this.sprites[r1][c1] = this.sprites[r2][c2];
    this.sprites[r2][c2] = s;
  }
  tweenSwap(r1, c1, r2, c2) {
    const s1 = this.sprites[r1][c1],
      s2 = this.sprites[r2][c2];
    this.tweens.add({
      targets: s1,
      x: this.xFor(c1),
      y: this.yFor(r1),
      duration: 140,
    });
    this.tweens.add({
      targets: s2,
      x: this.xFor(c2),
      y: this.yFor(r2),
      duration: 140,
    });
  }
  xFor(c) {
    return c * TILE + TILE / 2 + (W - COLS * TILE) / 2;
  }
  yFor(r) {
    return r * TILE + TILE / 2 + TOP_OFFSET;
  }

  // ----- Detección de matches -----
  findMatches() {
    const matched = [];

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      let count = 1;
      for (let c = 1; c < COLS; c++) {
        if (this.board[r][c] === this.board[r][c - 1]) count++;
        else {
          if (count >= MATCH_MIN)
            matched.push({ r, cEnd: c - 1, cStart: c - count });
          count = 1;
        }
      }
      if (count >= MATCH_MIN)
        matched.push({ r, cEnd: COLS - 1, cStart: COLS - count });
    }

    // Vertical
    const vmatched = [];
    for (let c = 0; c < COLS; c++) {
      let count = 1;
      for (let r = 1; r < ROWS; r++) {
        if (this.board[r][c] === this.board[r - 1][c]) count++;
        else {
          if (count >= MATCH_MIN)
            vmatched.push({ c, rEnd: r - 1, rStart: r - count });
          count = 1;
        }
      }
      if (count >= MATCH_MIN)
        vmatched.push({ c, rEnd: ROWS - 1, rStart: ROWS - count });
    }

    // Convertir a set de celdas
    const cells = new Set();
    const add = (r, c) => cells.add(r + "," + c);
    matched.forEach((m) => {
      for (let c = m.cStart; c <= m.cEnd; c++) add(m.r, c);
    });
    vmatched.forEach((m) => {
      for (let r = m.rStart; r <= m.rEnd; r++) add(r, m.c);
    });

    // lista de objetos {r,c}
    return Array.from(cells).map((s) => {
      const [r, c] = s.split(",").map(Number);
      return { r, c };
    });
  }

  resolveMatchesLoop(precomputed) {
    const cells = precomputed || this.findMatches();
    if (cells.length === 0) {
      this.inputEnabled = true;
      return;
    }

    // Contabilizar por tipo
    const typeCount = { 0: 0, 1: 0, 2: 0, 3: 0 };
    cells.forEach(({ r, c }) => {
      typeCount[this.board[r][c]]++;
    });

    // Avance según tipo (Paraguay, Trébol, Flores, Chile)
    const adv =
      typeCount[TYPES.CAR] * ADVANCE.CAR +
      typeCount[TYPES.FUEL] * ADVANCE.FUEL * FUEL_BONUS +
      typeCount[TYPES.FLOWER] * ADVANCE.FLOWER +
      typeCount[TYPES.BLOCK] * ADVANCE.BLOCK;
    this.progress = Math.min(GOAL, this.progress + Math.round(adv / 3));
    this.updateProgressUI();

    // Ramos por flores
    if (typeCount[TYPES.FLOWER] >= 3) {
      this.ramos += Math.floor(typeCount[TYPES.FLOWER] / 3) * FLOWER_RAMOS;
      this.ramosText.setText(String(this.ramos));
    }

    // Animación eliminar
    cells.forEach(({ r, c }) => {
      const spr = this.sprites[r][c];
      this.tweens.add({
        targets: spr,
        scale: 0,
        duration: 120,
        onComplete: () => spr.destroy(),
      });
      this.board[r][c] = null;
      this.sprites[r][c] = null;
    });

    // Caer y rellenar
    this.time.delayedCall(140, () => {
      // Drop
      for (let c = 0; c < COLS; c++) {
        let ptr = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (this.board[r][c] !== null) {
            if (r !== ptr) {
              this.board[ptr][c] = this.board[r][c];
              this.sprites[ptr][c] = this.sprites[r][c];
              this.tweens.add({
                targets: this.sprites[ptr][c],
                y: this.yFor(ptr),
                duration: 140,
              });
              this.board[r][c] = null;
              this.sprites[r][c] = null;
            }
            ptr--;
          }
        }
        for (let r = ptr; r >= 0; r--) {
          const t = this.randomType();
          this.board[r][c] = t;
          const spr = this.add
            .image(this.xFor(c), this.yFor(r) - H * 0.25, TYPE_KEYS[t])
            .setInteractive({ useHandCursor: true });

          // Almacenar coordenadas del tablero en el sprite
          spr.boardRow = r;
          spr.boardCol = c;

          this.sprites[r][c] = spr;
          this.tweens.add({ targets: spr, y: this.yFor(r), duration: 150 });
        }
      }

      // ¿Ganó?
      if (this.progress >= GOAL) {
        this.win();
      } else {
        // Buscar nuevas combinaciones tras la cascada
        this.time.delayedCall(170, () => this.resolveMatchesLoop());
      }
    });
  }

  updateProgressUI() {
    const pct = Math.round(this.progress);
    const w = (W - 40) * (pct / 100);
    this.progressFill.width = w;
    this.progressText.setText(`Meta: ${pct}%`);

    // Actualizar el auto progresivo
    if (this.progressiveCar) {
      this.progressiveCar.updateProgress(pct);
    }
  }

  win() {
    // Confetti bonito
    confetti.create(null, { resize: true })({
      particleCount: 200,
      spread: 70,
      origin: { y: 0.1 },
      colors: ["#ffd166", "#fff3bf", "#ffe066"],
    });
    this.scene.start("victory", { ramos: this.ramos });
  }

  update() {
    // El fondo ahora es una imagen estática, no necesita actualización
  }
}

// ----- Victoria -----
class Victory extends Phaser.Scene {
  constructor() {
    super("victory");
  }
  create(data) {
    this.cameras.main.setBackgroundColor("#112a1f");

    // Intentar usar video animado primero
    console.log("Intentando cargar video de victoria...");

    if (this.cache.video.exists("victory_video")) {
      console.log("Video encontrado, creando reproductor...");
      const video = this.add
        .video(W / 2, H / 2, "victory_video")
        .setOrigin(0.5)
        .setDepth(-10)
        .setMute(true)
        .setLoop(true);

      // Escalado seguro con metadata
      const el = video.video; // HTMLVideoElement
      const scaleNow = () => {
        const vw = el?.videoWidth || 640;
        const vh = el?.videoHeight || 360;
        const scaleX = W / vw;
        const scaleY = H / vh;
        video.setScale(Math.max(scaleX, scaleY));
      };
      if (el?.readyState >= 1) scaleNow();
      else el?.addEventListener("loadedmetadata", scaleNow, { once: true });
      video.once("play", scaleNow);

      // Autoplay robusto (consume la promesa si existe)
      try {
        const maybe = video.play(true); // true = ignora audio (muted)
        if (maybe && typeof maybe.then === "function") {
          maybe
            .then(() => {})
            .catch(() => {
              console.log("Autoplay bloqueado: tocar para reproducir.");
            });
        }
      } catch (_) {
        console.log("Autoplay con error sync: tocar para reproducir.");
      }

      // Click-to-play si fue bloqueado
      this.input.once("pointerdown", () => {
        if (!video.isPlaying()) {
          try {
            video.play(true);
          } catch (e) {
            console.log("Click play error:", e);
          }
        }
      });

      // Fallback NO destructivo y SIN ocultar el video
      this.time.delayedCall(2500, () => {
        const notStarted =
          !el || el.readyState < 2 || el.paused || el.currentTime === 0;

        if (notStarted) {
          console.log(
            "No reproduce aún: usando imagen estática encima (sin pausar el video)."
          );
          this.useStaticFallback(/* overVideo= */ true); // pone imagen por encima
        }
      });
    } else {
      console.log("Video no encontrado, usando imagen estática");
      this.useStaticFallback(/* overVideo= */ true);
    }

    // Configurar UI independientemente del fondo
    this.setupUI(data);
  }

  useStaticFallback(overVideo = false) {
    console.log("Usando imagen estática como fallback");

    const background = this.add.image(W / 2, H / 2, "game_background");
    const scaleX = W / background.width;
    const scaleY = H / background.height;
    const scale = Math.max(scaleX, scaleY);
    background.setScale(scale);

    // Si va encima del video, dale un depth mayor que -10
    background.setDepth(overVideo ? -9 : -10);
  }

  setupUI(data) {
    // Título y ramos en el área del cielo (parte superior)
    this.add
      .text(W / 2, 50, "¡Destino alcanzado! 🌼", {
        font: "bold 28px Arial",
        color: "#ffd166",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.add
      .text(W / 2, 85, "Ramos entregados: " + data.ramos, {
        font: "18px Arial",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(11);

    // Crear una caja semi-transparente en la parte inferior para el mensaje principal
    const textBox = this.add.rectangle(
      W / 2,
      H - 200,
      W - 20,
      240,
      0x000000,
      0.8
    );
    textBox.setDepth(10);

    // Array de mensajes emotivos que se muestran aleatoriamente
    const messages = [
      // Mensaje original sobre su fortaleza
      "Para ti, Ydalina 👑\n\n" +
        "Mujer valiente que a los 16 años se convirtió en madre\n" +
        "y desde entonces ha luchado incansablemente por sus hijas.\n" +
        "Que dejó Paraguay buscando un mejor futuro en Chile,\n" +
        "que cada día maneja por las calles dando lo mejor de sí.\n\n" +
        "Estoy orgulloso de tu fortaleza, de tu amor incondicional,\n" +
        "de cada sacrificio que has hecho por tu familia.\n" +
        "Eres inspiración pura, mi conductora favorita,\n" +
        "y me siento afortunado de conocerte y amarte 💛",

      // Mensaje sobre cómo se conocieron en septiembre 2016
      "Para ti, Ydalina ✨\n\n" +
        "Septiembre del 2016... un año difícil para ti por la partida de tu papá, " +
        "pero fue cuando Dios decidió que nuestros caminos se cruzaran. " +
        "En medio de tu dolor, la vida nos regaló este encuentro, " +
        "como si el cielo supiera que necesitábamos estar juntos.\n\n" +
        "Han pasado años desde aquel septiembre que cambió nuestras vidas, " +
        "y cada día agradezco a Dios por haberte puesto en mi camino. " +
        "Tu fe, tu fortaleza y tu amor me inspiran cada día. " +
        "Fuiste mi regalo en el momento perfecto, mi amor eterno 🙏💛",
    ];

    // Seleccionar mensaje aleatorio
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    console.log("Mensaje seleccionado aleatoriamente para Ydalina");

    this.add
      .text(W / 2, H - 200, randomMessage, {
        font: "12px Arial",
        color: "#ffffff",
        align: "center",
        lineSpacing: 3,
        wordWrap: { width: W - 60 },
      })
      .setOrigin(0.5)
      .setDepth(11);

    const btn = this.add
      .rectangle(W / 2, H - 50, 220, 40, 0xffd166)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);
    this.add
      .text(W / 2, H - 50, "Volver a jugar", {
        font: "bold 18px Arial",
        color: "#000",
      })
      .setOrigin(0.5)
      .setDepth(12);
    btn.on("pointerdown", () => this.scene.start("game"));
  }

  update() {
    // El fondo puede ser video animado o imagen estática
  }
}

// ----- Lanzar juego -----
const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: W,
  height: H,
  backgroundColor: "#0f1522",
  physics: { default: "arcade", arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Menu, Game, Victory],
};
new Phaser.Game(config);
