"use strict";
// global constants
const EPSILON = 1e-6; // small value to avoid floating-point precision issues
const NEAR_CLIPPING_PLANE = 0.25; // distance to the near clipping plane
const FAR_CLIPPING_PLANE = 10; // distance to the far clipping plane
const FOV = Math.PI * 0.5; // field of view in radians (90 degrees)
const SCREEN_WIDTH = 200; // number of vertical strips to render
const PLAYER_STEP_LEN = 0.5; // player movement step length
const PLAYER_SPEED = 2;
class Color {
    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    static red() {
        return new Color(1, 0, 0, 1);
    }
    static green() {
        return new Color(0, 1, 0, 1);
    }
    static blue() {
        return new Color(0, 0, 1, 1);
    }
    static yellow() {
        return new Color(1, 1, 0, 1);
    }
    static purple() {
        return new Color(1, 0, 1, 1);
    }
    static cyan() {
        return new Color(0, 1, 1, 1);
    }
    brightness(factor) {
        return new Color(factor * this.r, factor * this.g, factor * this.b, this.a);
    }
    toStyle() {
        return `rgba(
      ` + ` ${Math.floor(this.r * 255)}, 
      ` + ` ${Math.floor(this.g * 255)},
      ` + ` ${Math.floor(this.b * 255)},
      ` + ` ${(this.a)})`;
    }
}
class Vector2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    // static methods for creating vectors
    static zero() {
        return new Vector2D(0, 0);
    }
    static fromAngle(angle) {
        return new Vector2D(Math.cos(angle), Math.sin(angle));
    }
    // vector arithmetic methods
    add(that) {
        return new Vector2D(this.x + that.x, this.y + that.y);
    }
    subtract(that) {
        return new Vector2D(this.x - that.x, this.y - that.y);
    }
    multiply(that) {
        return new Vector2D(this.x * that.x, this.y * that.y);
    }
    divide(that) {
        return new Vector2D(this.x / that.x, this.y / that.y);
    }
    // vector operations
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    sqrLength() {
        return this.x * this.x + this.y * this.y;
    }
    scale(value) {
        return new Vector2D(this.x * value, this.y * value);
    }
    rotate90() {
        return new Vector2D(-this.y, this.x);
    }
    normalize() {
        const l = this.length();
        if (l === 0)
            return new Vector2D(0, 0);
        return new Vector2D(this.x / l, this.y / l);
    }
    // linear interpolation between two vectors
    lerp(that, t) {
        return that.subtract(this).scale(t).add(this);
    }
    sqrDistanceTo(that) {
        return that.subtract(this).sqrLength();
    }
    dot(that) {
        return this.x * that.x + this.y * that.y;
    }
    // converts the vector to an array for use with canvas methods
    coordsToArray() {
        return [this.x, this.y];
    }
}
// helper functions for canvas operations
function canvasSize(ctx) {
    return new Vector2D(ctx.canvas.width, ctx.canvas.height);
}
function fillCircle(ctx, center, radius) {
    ctx.beginPath();
    ctx.arc(...center.coordsToArray(), radius, 0, 2 * Math.PI);
    ctx.fill();
}
function strokeLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(...p1.coordsToArray());
    ctx.lineTo(...p2.coordsToArray());
    ctx.stroke();
}
// helper functions for raycasting calculations
function snapToNeighbor(x, dx) {
    if (dx > 0)
        return Math.ceil(x + Math.sign(dx) * EPSILON);
    if (dx < 0)
        return Math.floor(x + Math.sign(dx) * EPSILON);
    return x;
}
function hittingCell(p1, p2) {
    const delta = p2.subtract(p1);
    return new Vector2D(Math.floor(p2.x + Math.sign(delta.x) * EPSILON), Math.floor(p2.y + Math.sign(delta.y) * EPSILON));
}
// calculate the next step in the ray's path
function rayStep(p1, p2) {
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
            if (p2.sqrDistanceTo(p3temp) < p2.sqrDistanceTo(p3))
                p3 = p3temp;
        }
    }
    else {
        const y3 = snapToNeighbor(p2.y, delta.y);
        const x3 = p2.x;
        p3 = new Vector2D(x3, y3);
    }
    return p3;
}
// check if a point is inside the scene
function insideScene(scene, p) {
    const size = sceneSize(scene);
    return 0 <= p.x && p.x < size.x && 0 <= p.y && p.y < size.y;
}
// cast a ray from p1 to p2 in the scene
function castRay(scene, p1, p2) {
    let start = p1;
    while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE * FAR_CLIPPING_PLANE) {
        // check if the ray (which is denoted by 2 points) is hitting a particular cell
        const c = hittingCell(p1, p2);
        // if you are inside the scene, and this thing is not null only then break
        if (insideScene(scene, c) && scene[c.y][c.x] !== null)
            break;
        // if you have 2 points p1, p2 find the next point for the ray casted
        const p3 = rayStep(p1, p2);
        p1 = p2;
        p2 = p3;
    }
    return p2;
}
function sceneSize(scene) {
    const y = scene.length;
    let x = Number.MIN_VALUE;
    for (let row of scene) {
        x = Math.max(x, row.length);
    }
    return new Vector2D(x, y);
}
function renderMinimap(ctx, player, position, size, scene) {
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
                ctx.fillStyle = color.toStyle();
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
    constructor(position, direction) {
        this.position = position;
        this.direction = direction;
    }
    // calculate the range of the player's field of view
    fovRange() {
        const l = Math.tan(FOV * 0.5) * NEAR_CLIPPING_PLANE;
        const p = this.position.add(Vector2D.fromAngle(this.direction).scale(NEAR_CLIPPING_PLANE));
        let p1 = p.subtract(p.subtract(this.position).rotate90().normalize().scale(l));
        let p2 = p.add(p.subtract(this.position).rotate90().normalize().scale(l));
        return [p1, p2];
    }
}
// render the 3D scene using raycasting
function renderScene(ctx, player, scene) {
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
                ctx.fillStyle = color.brightness(1 / v.dot(d)).toStyle();
                ctx.fillRect(x * strip_width, (ctx.canvas.height - strip_height) * 0.5, strip_width, strip_height);
            }
        }
    }
}
// main rendering function
function renderGame(ctx, player, scene) {
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
// define the scene
const scene = [
    [null, null, Color.cyan(), Color.purple(), null, null, null, null],
    [null, null, null, Color.yellow(), null, null, null, null],
    [null, Color.red(), Color.green(), Color.blue(), null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
];
// immediately call this function when the html element has been rendered
(() => {
    const game = document.getElementById("game");
    if (game === null) {
        throw new Error("No canvas element found with id `game`.");
    }
    // set canvas size
    const factor = 50;
    game.width = 16 * factor;
    game.height = 9 * factor;
    // disable right click context menu
    game.oncontextmenu = function (event) {
        event.preventDefault();
        event.stopPropagation();
    };
    const ctx = game.getContext("2d");
    if (ctx === null)
        throw new Error("2D context is not supported.");
    // prettier-ignore
    // define the player, at its initial start
    const player = new Player(sceneSize(scene).multiply(new Vector2D(0.63, 0.63)), Math.PI * 1.25);
    let movingForward = false;
    let movingBackward = false;
    let turningLeft = false;
    let turningRight = false;
    // handle keyboard input
    window.addEventListener("keydown", (event) => {
        if (!event.repeat) {
            switch (event.code) {
                case "KeyW":
                    movingForward = true;
                    break;
                case "KeyS":
                    movingBackward = true;
                    break;
                case "KeyA":
                    turningLeft = true;
                    break;
                case "KeyD":
                    turningRight = true;
                    break;
            }
        }
    });
    window.addEventListener("keyup", (event) => {
        if (!event.repeat) {
            switch (event.code) {
                case "KeyW":
                    movingForward = false;
                    break;
                case "KeyS":
                    movingBackward = false;
                    break;
                case "KeyA":
                    turningLeft = false;
                    break;
                case "KeyD":
                    turningRight = false;
                    break;
            }
        }
    });
    let prevTimestamp = 0;
    const frame = (timestamp) => {
        const deltaTime = (timestamp - prevTimestamp) / 1000;
        prevTimestamp = timestamp;
        let velocity = Vector2D.zero();
        let angularVelocity = 0.0;
        if (movingForward) {
            velocity = velocity
                .add(Vector2D.fromAngle(player.direction)
                .scale(PLAYER_SPEED));
        }
        if (movingBackward) {
            velocity = velocity
                .subtract(Vector2D.fromAngle(player.direction)
                .scale(PLAYER_SPEED));
        }
        if (turningLeft) {
            angularVelocity -= Math.PI * .65;
        }
        if (turningRight) {
            angularVelocity += Math.PI * .65;
        }
        player.direction = player.direction + angularVelocity * deltaTime;
        player.position = player.position.add(velocity.scale(deltaTime));
        renderGame(ctx, player, scene);
        window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame((timestamp) => {
        prevTimestamp = timestamp;
        window.requestAnimationFrame(frame);
    });
    // initial render
})();
