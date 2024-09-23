// global constants
const EPSILON = 1e-6; // small value to avoid floating-point precision issues
const NEAR_CLIPPING_PLANE = 1; // distance to the near clipping plane
const FAR_CLIPPING_PLANE = 10; // distance to the far clipping plane
const FOV = Math.PI * 0.5; // field of view in radians (90 degrees)
const SCREEN_WIDTH = 200; // number of vertical strips to render
const PLAYER_STEP_LEN = 0.5; // player movement step length

class Vector2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  // static methods for creating vectors
  static zero() {
    return new Vector2D(0, 0);
  }

  static fromAngle(angle: number): Vector2D {
    return new Vector2D(Math.cos(angle), Math.sin(angle));
  }

  // vector arithmetic methods
  add(that: Vector2D): Vector2D {
    return new Vector2D(this.x + that.x, this.y + that.y);
  }

  subtract(that: Vector2D): Vector2D {
    return new Vector2D(this.x - that.x, this.y - that.y);
  }

  multiply(that: Vector2D): Vector2D {
    return new Vector2D(this.x * that.x, this.y * that.y);
  }

  divide(that: Vector2D): Vector2D {
    return new Vector2D(this.x / that.x, this.y / that.y);
  }

  // vector operations
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  scale(value: number): Vector2D {
    return new Vector2D(this.x * value, this.y * value);
  }
  rotate90(): Vector2D {
    return new Vector2D(-this.y, this.x);
  }

  distanceTo(that: Vector2D): number {
    return that.subtract(this).length();
  }

  normalize(): Vector2D {
    const l = this.length();
    if (l === 0) return new Vector2D(0, 0);

    return new Vector2D(this.x / l, this.y / l);
  }

  // linear interpolation between two vectors
  lerp(that: Vector2D, t: number): Vector2D {
    return that.subtract(this).scale(t).add(this);
  }

  dot(that: Vector2D): number {
    return this.x * that.x + this.y * that.y;
  }

  // converts the vector to an array for use with canvas methods
  coordsToArray(): [number, number] {
    return [this.x, this.y];
  }
}

// helper functions for canvas operations
function canvasSize(ctx: CanvasRenderingContext2D): Vector2D {
  return new Vector2D(ctx.canvas.width, ctx.canvas.height);
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  center: Vector2D,
  radius: number
): void {
  ctx.beginPath();
  ctx.arc(...center.coordsToArray(), radius, 0, 2 * Math.PI);
  ctx.fill();
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  p1: Vector2D,
  p2: Vector2D
): void {
  ctx.beginPath();
  ctx.moveTo(...p1.coordsToArray());
  ctx.lineTo(...p2.coordsToArray());
  ctx.stroke();
}

// helper functions for raycasting calculations
function snapToNeighbor(x: number, dx: number): number {
  if (dx > 0) return Math.ceil(x + Math.sign(dx) * EPSILON);
  if (dx < 0) return Math.floor(x + Math.sign(dx) * EPSILON);
  return x;
}

function hittingCell(p1: Vector2D, p2: Vector2D): Vector2D {
  const delta = p2.subtract(p1);
  return new Vector2D(
    Math.floor(p2.x + Math.sign(delta.x) * EPSILON),
    Math.floor(p2.y + Math.sign(delta.y) * EPSILON)
  );
}

// calculate the next step in the ray's path
function rayStep(p1: Vector2D, p2: Vector2D): Vector2D {
  // find the slop of the ray-casted line
  const delta = p2.subtract(p1);

  let p3 = p2;

  if (delta.x !== 0) {
    const k = delta.y / delta.x;
    const c = p1.y - k * p1.x;

    {
      const x3 = snapToNeighbor(p2.x, delta.x);
      const y3 = x3 * k + c;
      p3 = new Vector2D(x3, y3);
    }

    if (k !== 0) {
      const y3 = snapToNeighbor(p2.y, delta.y);
      const x3 = (y3 - c) / k;
      const p3temp = new Vector2D(x3, y3);
      if (p2.distanceTo(p3temp) < p2.distanceTo(p3)) p3 = p3temp;
    }
  } else {
    const y3 = snapToNeighbor(p2.y, delta.y);
    const x3 = p2.x;
    p3 = new Vector2D(x3, y3);
  }

  return p3;
}

type Scene = Array<Array<string | null>>;

// check if a point is inside the scene
function insideScene(scene: Scene, p: Vector2D): boolean {
  const size = sceneSize(scene);
  return 0 <= p.x && p.x < size.x && 0 <= p.y && p.y < size.y;
}

// cast a ray from p1 to p2 in the scene
function castRay(scene: Scene, p1: Vector2D, p2: Vector2D): Vector2D {
  let start = p1;

  while (start.distanceTo(p1) < FAR_CLIPPING_PLANE) {
    // check if the ray (which is denoted by 2 points) is hitting a particular cell
    const c = hittingCell(p1, p2);
    // if you are inside the scene, and this thing is not null only then break
    if (insideScene(scene, c) && scene[c.y][c.x] !== null) break;

    // if you have 2 points p1, p2 find the next point for the ray casted
    const p3 = rayStep(p1, p2);
    p1 = p2;
    p2 = p3;
  }

  return p2;
}

function sceneSize(scene: Scene): Vector2D {
  const y = scene.length;
  let x = Number.MIN_VALUE;
  for (let row of scene) {
    x = Math.max(x, row.length);
  }
  return new Vector2D(x, y);
}

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  player: Player,
  position: Vector2D,
  size: Vector2D,
  scene: Scene
): void {
  // reset context to its default state each time its rendered
  ctx.save();

  const gridSize = sceneSize(scene);

  ctx.translate(...position.coordsToArray());
  ctx.scale(...size.divide(gridSize).coordsToArray());

  // draw the background and grid
  ctx.strokeStyle = "#303030";
  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ...gridSize.coordsToArray());
  ctx.lineWidth = 0.1;

  // draw the cells
  for (let y = 0; y < gridSize.y; ++y) {
    for (let x = 0; x < gridSize.x; ++x) {
      const color = scene[y][x];
      if (color !== null) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // draw the grid as a set of vectors
  for (let x = 0; x <= gridSize.x; ++x) {
    strokeLine(ctx, new Vector2D(x, 0), new Vector2D(x, gridSize.y));
  }
  for (let y = 0; y <= gridSize.y; ++y) {
    strokeLine(ctx, new Vector2D(0, y), new Vector2D(gridSize.x, y));
  }

  // draw the player
  const lineStrokeColor = "#ea250c";
  ctx.fillStyle = lineStrokeColor;
  ctx.strokeStyle = lineStrokeColor;

  fillCircle(ctx, player.position, 0.2);

  // draw the FOV
  const [p1, p2] = player.fovRange();

  strokeLine(ctx, p1, p2);
  strokeLine(ctx, player.position, p1);
  strokeLine(ctx, player.position, p2);

  ctx.restore();
}

// player class to handle player position and direction
class Player {
  position: Vector2D;
  direction: number;

  constructor(position: Vector2D, direction: number) {
    this.position = position;
    this.direction = direction;
  }

  // calculate the range of the player's field of view
  fovRange(): [Vector2D, Vector2D] {
    const l = Math.tan(FOV * 0.5) * NEAR_CLIPPING_PLANE;
    const p = this.position.add(
      Vector2D.fromAngle(this.direction).scale(NEAR_CLIPPING_PLANE)
    );

    let p1 = p.subtract(
      p.subtract(this.position).rotate90().normalize().scale(l)
    );
    let p2 = p.add(p.subtract(this.position).rotate90().normalize().scale(l));
    return [p1, p2];
  }
}

// render the 3D scene using raycasting
function renderScene(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  const strip_width = Math.ceil(ctx.canvas.width / SCREEN_WIDTH);
  const [r1, r2] = player.fovRange();

  for (let x = 0; x < SCREEN_WIDTH; ++x) {
    const p = castRay(scene, player.position, r1.lerp(r2, x / SCREEN_WIDTH));
    const c = hittingCell(player.position, p);
    if (insideScene(scene, c)) {
      const color = scene[c.y][c.x];
      if (color !== null) {
        const v = p.subtract(player.position);
        const d = Vector2D.fromAngle(player.direction);
        let strip_height = ctx.canvas.height / v.dot(d);

        ctx.fillStyle = color;
        ctx.fillRect(
          x * strip_width,
          (ctx.canvas.height - strip_height) * 0.5,
          strip_width,
          strip_height
        );
      }
    }
  }
}

// main rendering function
function renderGame(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  const minimapPosition = Vector2D.zero().add(canvasSize(ctx).scale(0.03));
  const cellSize = ctx.canvas.width * 0.03;
  const minimapSize = sceneSize(scene).scale(cellSize);

  // clear the canvas
  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // render the 3d scene and minimap
  renderScene(ctx, player, scene);
  renderMinimap(ctx, player, minimapPosition, minimapSize, scene);
}

// immediately call this function when the html element has been rendered
(() => {
  const game = document.getElementById("game") as HTMLCanvasElement | null;

  if (game === null) {
    throw new Error("No canvas element found with id `game`.");
  }

  // set canvas size
  const factor = 50;
  game.width = 16 * factor;
  game.height = 9 * factor;

  // disable right click context menu
  game.oncontextmenu = function (event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  };

  const ctx = game.getContext("2d");
  if (ctx === null) throw new Error("2D context is not supported.");

  // prettier-ignore
  // define the scene
  const scene = [
    [null, null,  "cyan",  "purple", null, null, null, null],
    [null, null,  null,    "yellow",  null, null, null, null],
    [null, "red", "green", "blue",    null, null, null, null],
    [null, null,  null,    null,      null, null, null, null],
    [null, null,  null,    null,      null, null, null, null],
    [null, null,  null,    null,      null, null, null, null],
    [null, null,  null,    null,      null, null, null, null],
  ];

  // define the player, at its initial start
  const player = new Player(
    sceneSize(scene).multiply(new Vector2D(0.63, 0.63)),
    Math.PI * 1.25
  );

  // handle keyboard input
  // prettier-ignore
  window.addEventListener("keydown", (event) => {
    if (!event.repeat) {
      switch (event.code) {
        case "KeyW": {
            player.position = player.position.add(
              Vector2D.fromAngle(player.direction).scale(PLAYER_STEP_LEN)
            );
            renderGame(ctx, player, scene);
          }
          break;
        case "KeyA": {
            player.direction -= Math.PI * 0.1;
            renderGame(ctx, player, scene);
          }
          break;
        case "KeyS": {
            player.position = player.position.subtract(
              Vector2D.fromAngle(player.direction).scale(PLAYER_STEP_LEN)
            );
            renderGame(ctx, player, scene);
          }
          break;
        case "KeyD": {
            player.direction += Math.PI * 0.1;
            renderGame(ctx, player, scene);
          }
          break;
      }
    }
  });

  // initial render
  renderGame(ctx, player, scene);
})();
