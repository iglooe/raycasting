class Vector2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  static zero() {
    return new Vector2D(0, 0);
  }

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

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  scale(value: number): Vector2D {
    return new Vector2D(this.x * value, this.y * value);
  }

  distanceTo(that: Vector2D): number {
    return that.subtract(this).length();
  }

  normalize(): Vector2D {
    const l = this.length();
    if (l === 0) return new Vector2D(0, 0);

    return new Vector2D(this.x / l, this.y / l);
  }

  // converts the client mouse position on the canvas to an array
  coordsToArray(): [number, number] {
    return [this.x, this.y];
  }
}

const EPSILON = 1e-3;

function canvasSize(ctx: CanvasRenderingContext2D): Vector2D {
  return new Vector2D(ctx.canvas.width, ctx.canvas.height);
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  center: Vector2D,
  radius: number
) {
  ctx.beginPath();
  ctx.arc(...center.coordsToArray(), radius, 0, 2 * Math.PI);
  ctx.fill();
}

function strokeLine(ctx: CanvasRenderingContext2D, p1: Vector2D, p2: Vector2D) {
  ctx.beginPath();
  ctx.moveTo(...p1.coordsToArray());
  ctx.lineTo(...p2.coordsToArray());
  ctx.stroke();
}

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

function rayStep(p1: Vector2D, p2: Vector2D) {
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

type Scene = Array<Array<number>>;

function sceneSize(scene: Scene): Vector2D {
  const y = scene.length;
  let x = Number.MIN_VALUE;
  for (let row of scene) {
    x = Math.max(x, row.length);
  }
  return new Vector2D(x, y);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  p1: Vector2D,
  p2: Vector2D | undefined,
  position: Vector2D,
  size: Vector2D,
  scene: Scene
) {
  // reset context to its default state each time its rendered
  ctx.reset();

  // canvas background properties
  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const gridSize = sceneSize(scene);

  ctx.translate(...position.coordsToArray());
  ctx.scale(...size.divide(gridSize).coordsToArray());

  ctx.strokeStyle = "#303030";
  ctx.lineWidth = 0.02;

  for (let y = 0; y < gridSize.y; ++y) {
    for (let x = 0; x < gridSize.x; ++x) {
      if (scene[y][x] !== 0) {
        ctx.fillStyle = "#303030";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // draw the grid as a set of vectors
  for (let x = 0; x <= gridSize.x; ++x) {
    strokeLine(ctx, new Vector2D(x, 0), new Vector2D(x, gridSize.x));
  }
  for (let y = 0; y <= gridSize.y; ++y) {
    strokeLine(ctx, new Vector2D(0, y), new Vector2D(gridSize.y, y));
  }

  // orange
  const lineStrokeColor = "#ea250c";

  ctx.fillStyle = lineStrokeColor;
  fillCircle(ctx, p1, 0.2);

  // client has moved mouse if `p2 !== undefined`
  if (p2 !== undefined) {
    for (;;) {
      fillCircle(ctx, p2, 0.2);
      ctx.strokeStyle = lineStrokeColor;
      strokeLine(ctx, p1, p2);

      const c = hittingCell(p1, p2);

      // dont render past grid boundaries
      if (
        c.x < 0 ||
        c.x >= gridSize.x + 1 ||
        c.y < 0 ||
        c.y >= gridSize.y ||
        scene[c.y][c.x] === 1
      ) {
        break;
      }

      const p3 = rayStep(p1, p2);
      p1 = p2;
      p2 = p3;
    }
  }
}

// immediately call this fxn when the html element has been rendered
(() => {
  let scene = [
    [0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ];
  const game = document.getElementById("game") as HTMLCanvasElement | null;

  if (game === null) {
    throw new Error("No canvas element found with id `game`.");
  }

  // canvas properties
  game.width = 800;
  game.height = 800;

  // disable right click context menu
  game.oncontextmenu = function (event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  };

  const ctx = game.getContext("2d");
  if (ctx === null) {
    throw new Error("2D context is not supported.");
  }

  // todo:
  // document.addEventListener("keydown", (event: KeyboardEvent) => {
  //   switch (event.key.toLowerCase()) {
  //     case "w":
  //       console.log("W key pressed");
  //       break;
  //     case "a":
  //       console.log("A key pressed");
  //       break;
  //     case "s":
  //       console.log("S key pressed");
  //       break;
  //     case "d":
  //       console.log("D key pressed");
  //       break;
  //     // do nothing
  //     default:
  //       break;
  //   }
  // });
  let p1 = sceneSize(scene).multiply(new Vector2D(0.7, 0.93));
  let p2: Vector2D | undefined = undefined;
  let minimapPosition = Vector2D.zero();
  let minimapSize = canvasSize(ctx);

  game.addEventListener("mousemove", (event: MouseEvent) => {
    p2 = new Vector2D(event.offsetX, event.offsetY)
      .subtract(minimapPosition)
      .divide(minimapSize)
      .multiply(sceneSize(scene));
    // redraw the grid each time the mouse moves
    drawGrid(ctx, p1, p2, minimapPosition, minimapSize, scene);
  });

  // draw initial grid
  drawGrid(ctx, p1, p2, minimapPosition, minimapSize, scene);
})();
