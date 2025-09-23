// Efecto de pestañeo para la chica del auto en el HUD

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

    // La hoja real es 704×1472 con 3 filas de autos (704×368 cada uno)
    this.load.spritesheet("car_progress", "assets/sprite01.png", {
      frameWidth: 690,
      frameHeight: 435,
    });

    // Cargar imagen de fondo del juego
    this.load.image("game_background", "assets/background.jpg");
    // Cargar imagen de fondo para el camino
    this.load.image("road_background", "assets/background_stg.png");

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
    mk("t_fuel", 0xb42ec4, "🍀");
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
  constructor(scene, startX, roadCenterY, roadHeight = 90) {
    this.scene = scene;
    this.startX = startX;
    this.endX = W - 60;
    this.y = roadCenterY; // centro de la carretera
    this.h = roadHeight; // alto visible de la carretera
    this.currentProgress = 0;
    this.currentCarFrame = 0;
    this.currentX = startX;
    this.TOP_TRIM = [34, 10, 10]; // recorte arriba (px en el frame original 704x368)
    this.BASELINE = [12, 12, 12]; // px desde la base del frame hasta el “piso” real

    // sprite del coche anclado a la BASE
    this.carSprite = this.scene.add
      .image(startX, 0, "car_progress", 0)
      .setOrigin(0.5, 1); // bottom-center

    // acolchados para que quepa sin comerse ruedas ni techo
    const maxTrim = Math.max(...this.TOP_TRIM);
    const usableFrameHeight = 368 - maxTrim - Math.max(...this.BASELINE); // alto útil
    const scaleToRoad = (this.h - 4) / usableFrameHeight; // -4 de aire
    const scaleToWidth = (W - 60) / 704;
    const scale = Math.min(scaleToRoad, scaleToWidth);
    this.carSprite.setScale(scale);

    this.baseY = this.y + this.h / 2; // borde inferior del rect
    this.applyFrame(0, false);

    // máscara: todo lo que salga del rectángulo de carretera NO se ve
    const maskG = scene.add.graphics().fillStyle(0xffffff, 1);
    maskG.fillRect(W / 2 - (W - 40) / 2, this.y - this.h / 2, W - 40, this.h);
    maskG.setVisible(false);
    this.carSprite.setMask(maskG.createGeometryMask());

    // Aplica frame inicial recortado y alineado
    this.setFrameAligned(0);

    // ----- Rebote -----
    // Amplitud en píxeles (escala-aware): 3–5 px suele verse natural
    this.bounceAmp = Math.max(3, Math.round(4 * scale));
    this._bouncing = false;
    this.bounce = (amp = this.bounceAmp, upDur = 90, downDur = 120) => {
      if (this._bouncing) return;
      this._bouncing = true;
      const originalY = this.carSprite.y;
      // Primer tween: subir
      this.scene.tweens.add({
        targets: this.carSprite,
        y: originalY - amp,
        duration: upDur,
        ease: "Sine.easeOut",
        onComplete: () => {
          // Segundo tween: bajar
          this.scene.tweens.add({
            targets: this.carSprite,
            y: originalY,
            duration: downDur,
            ease: "Sine.easeIn",
            onComplete: () => (this._bouncing = false),
          });
        },
      });
    };

    // Timer de pestañeo
    this.blinkEvent = scene.time.addEvent({
      delay: 2400,
      loop: true,
      callback: () => {
        if (this.currentFrame === 0) {
          this.applyFrame(1, false);
          this.bounce();
          scene.time.delayedCall(120, () => this.applyFrame(0, false));
        }
      },
    });
  }

  applyFrame(frameIdx, withTween = false) {
    const trimTop = this.TOP_TRIM[frameIdx] || 0;
    const basePx = this.BASELINE[frameIdx] || 0;

    // 1) Aplica el frame
    this.carSprite.setFrame(frameIdx);

    // 2) Recorta por arriba sólo lo necesario para quitar la barra
    this.carSprite.setCrop(0, trimTop, 704, 368 - trimTop);

    // 3) Coloca la base: borde inferior visible = baseY
    //    pero la “suela” real del neumático está basePx por encima del borde del frame
    const baselineWorldOffset = basePx * this.scale;
    this.carSprite.y = this.baseY + baselineWorldOffset;

    this.currentFrame = frameIdx;
  }

  // Cambia el frame manteniendo la base fija
  setFrameAligned(idx) {
    this.carSprite.setFrame(idx); // sin recortes
    // la base no cambia (origin 0.5,1 ya hace el trabajo)
    this.currentCarFrame = idx;
  }

  createWheels() {
    /* ya no se usa */
  }

  updateProgress(pct) {
    const x = this.startX + (this.endX - this.startX) * (pct / 100);
    this.scene.tweens.add({
      targets: this.carSprite,
      x,
      duration: 300,
      ease: "Power2",
    });

    // Frame “flores” al 100%
    if (pct >= 100 && this.currentFrame !== 2) this.applyFrame(2, false);
    if (pct < 100 && this.currentFrame === 2) this.applyFrame(0, false);
  }

  // ...existing code...
  animateWheels() {
    /* ya no se usa */
  }

  destroy() {
    if (this.carSprite) this.carSprite.destroy();
    if (this.blinkEvent) this.blinkEvent.remove(false);
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
      "Forma líneas de 3+ para avanzar.";
    this.add
      .text(W / 2, 280, how, {
        font: "18px Arial",
        color: "#eaeaea",
        align: "center",
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(W / 2, 360, 220, 50, 0xffd166)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(W / 2, 360, "Comenzar", { font: "bold 20px Arial", color: "#000" })
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
    this.add
      .text(W / 2, 12, "La Ruta de la Reina Ydalina", {
        font: "bold 20px Arial",
        color: "#ffd166",
      })
      .setOrigin(0.5, 0);
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

    // Fondo del HUD de Ramos
    const hudX = 20;
    const hudY = 90;
    const hudW = W - 40;
    const hudH = 110;
    const hudBg = this.add
      .image(hudX + hudW / 2, hudY + hudH / 2, "road_background")
      .setOrigin(0.5)
      .setDepth(-2);
    hudBg.setScale(hudW / hudBg.width, hudH / hudBg.height);

    this.add.text(20, 98, "Ramos 🌼:", {
      font: "16px Arial",
      color: "#ffd166",
    });
    // Imagen del vehículo en el HUD, inicia más atrás y avanza según el progreso
    const carMargin = 60; // margen para que el auto no salga del borde
    this.ramosCarStartX = hudX + carMargin;
    this.ramosCarEndX = hudX + hudW - carMargin;
    this.ramosCarY = hudY + hudH - 10;
    this.ramosCar = this.add
      .image(this.ramosCarStartX, this.ramosCarY, "car_progress", 0)
      .setScale(0.22)
      .setOrigin(0.5, 1);
    // Pestañeo: cambiar al frame 1 (ojos cerrados) y volver al 0
    this.time.addEvent({
      delay: 2400, // cada 2.4 s
      loop: true,
      callback: () => {
        if (!this.ramosCar) return;
        this.ramosCar.setFrame(1); // frame con ojos cerrados
        this.time.delayedCall(120, () => {
          // 120 ms de pestaña
          if (this.ramosCar) this.ramosCar.setFrame(0); // volver a normal
        });
      },
    });
    // Animación de rebote para el auto del HUD (dentro de create)
    this.tweens.add({
      targets: this.ramosCar,
      y: this.ramosCar.y - 8,
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
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

    // Carretera estética con imagen de fondo
    // ...elimina el rectángulo oscuro, solo deja la imagen si es necesario en el tablero...

    // Auto progresivo en lugar del estático (empieza desde la derecha)
    // roadRect es tu contenedor/rectángulo gris oscuro bajo "Meta"
    const roadCenterY = TOP_OFFSET - 80;
    const roadHeight = 90;

    this.progressiveCar = new ProgressiveCar(this, 60, roadCenterY, roadHeight);

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
        // Usar siempre el sprite programático
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
          // Usar siempre el sprite programático
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

    // Actualizar el auto progresivo principal
    if (this.progressiveCar) {
      this.progressiveCar.updateProgress(pct);
    }
    // Efecto de avance del auto en el HUD de Ramos
    if (this.ramosCar) {
      const x =
        this.ramosCarStartX +
        (this.ramosCarEndX - this.ramosCarStartX) * (pct / 100);
      this.ramosCar.x = x;
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

    // Re-colocar UI cuando cambie el alto real del canvas
    this.scale.on("resize", this.layoutVictory, this);
    this.layoutVictory(); // primera vez
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
    this.textBox = this.add.rectangle(
      W / 2,
      H - 200,
      W - 20,
      240,
      0x000000,
      0.8
    );
    this.textBox.setDepth(10);

    // Array de mensajes emotivos que se muestran aleatoriamente
    const messages = [
      // Mensaje original sobre su fortaleza
      "Para ti, Ydalina 👑\n\n" +
        "Mujer valiente que a los 16 años se convirtió en madre\n" +
        "y desde entonces ha luchado incansablemente por sus hijas.\n" +
        "Que dejó Paraguay buscando un mejor futuro en Chile,\n" +
        "que cada día maneja por las calles dando lo mejor de sí.\n\n" +
        "Admiro tu fortaleza, tu amor incondicional hacia tu familia,\n" +
        "y cada sacrificio que has hecho por ellas.\n" +
        "Eres inspiración pura, una mujer ejemplar,\n" +
        "y me siento afortunado de conocerte 💛",

      // Mensaje sobre cómo se conocieron en septiembre 2016
      "Para ti, Ydalina ✨\n\n" +
        "Septiembre del 2016... un año difícil para ti por la partida de tu papá, " +
        "pero fue cuando la vida decidió que nuestros caminos se cruzaran. " +
        "En medio de tu dolor, el destino nos regaló conocernos, " +
        "como si el universo supiera que nos íbamos a apoyar mutuamente.\n\n" +
        "Han pasado años desde aquel septiembre que cambió nuestras vidas, " +
        "y cada día agradezco haber tenido la oportunidad de conocerte. " +
        "Tu fe, tu fortaleza y tu dedicación me inspiran cada día. " +
        "Eres una persona muy especial 🙏💛",
    ];

    // Seleccionar mensaje aleatorio
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    console.log("Mensaje seleccionado aleatoriamente para Ydalina");

    this.message = this.add
      .text(W / 2, H - 200, randomMessage, {
        font: "12px Arial",
        color: "#ffffff",
        align: "center",
        lineSpacing: 3,
        wordWrap: { width: W - 60 },
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.retryBtn = this.add
      .rectangle(W / 2, H - 50, 220, 40, 0xffd166)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);
    this.retryLbl = this.add
      .text(W / 2, H - 50, "Volver a jugar", {
        font: "bold 18px Arial",
        color: "#000",
      })
      .setOrigin(0.5)
      .setDepth(12);
    this.retryBtn.on("pointerdown", () => this.scene.start("game"));
  }

  layoutVictory() {
    // tamaño real del canvas
    const cam = this.cameras.main;
    const Wreal = cam.width;
    const Hreal = cam.height;

    // recolocar elementos "al borde inferior"
    if (this.textBox) {
      this.textBox.setPosition(Wreal / 2, Hreal - 200);
      this.textBox.setSize(Wreal - 20, 240);
    }
    if (this.message) {
      this.message.setPosition(Wreal / 2, Hreal - 200);
      this.message.setWordWrapWidth(Wreal - 60);
    }
    if (this.retryBtn) this.retryBtn.setPosition(Wreal / 2, Hreal - 50);
    if (this.retryLbl) this.retryLbl.setPosition(Wreal / 2, Hreal - 50);
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
