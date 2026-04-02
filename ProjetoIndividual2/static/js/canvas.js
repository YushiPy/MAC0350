import { Vector2 } from "./vector2.js";
import { tppSolve } from "./utpp.js";
import * as settings from "./settings.js";

const floatToString = (integerPart, exponent) => {
	if (Math.abs(exponent) >= 5) {
		return `${integerPart}e${exponent}`;
	}
	return (integerPart * Math.pow(10, exponent))
		.toFixed(6)
		.replace(/\.?0+$/, "");
};

class Canvas {

	constructor() {
		this.camera = new Camera(settings.INITIAL_CAMERA_POSITION, settings.INITIAL_UNITS_TO_PIXELS);

		const canvas = document.getElementById(settings.CANVAS_ELEMENT_ID);
		const ctx = canvas.getContext("2d");

		const resizeObserver = new ResizeObserver(() => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = canvas.offsetWidth * dpr;
			canvas.height = canvas.offsetHeight * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			this.canvasCenter = new Vector2(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
		});

		resizeObserver.observe(canvas);

		this.canvas = canvas;
		this.ctx = ctx;
		this.canvasCenter = new Vector2(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
	}

	canvasToWorld(x, y) {
		if (x instanceof Vector2) { y = x.y; x = x.x; }
		return new Vector2(
			(x - this.canvasCenter.x) * this.camera.pixelsToUnits + this.camera.x,
			-(y - this.canvasCenter.y) * this.camera.pixelsToUnits + this.camera.y
		);
	}

	worldToCanvas(x, y = null) {

		if (x instanceof Object) { y = x.y; x = x.x; }
		
		return new Vector2(
			(x - this.camera.x) * this.camera.unitsToPixels + this.canvasCenter.x,
			-(y - this.camera.y) * this.camera.unitsToPixels + this.canvasCenter.y
		);
	}

	_drawLine(startCanvas, endCanvas, color, lineWidth = 1) {
		const ctx = this.ctx;
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;
		ctx.beginPath();
		ctx.moveTo(startCanvas.x, startCanvas.y);
		ctx.lineTo(endCanvas.x, endCanvas.y);
		ctx.stroke();
	}

	_drawLineGlow(startCanvas, endCanvas, color, lineWidth = 1) {
		const ctx = this.ctx;
		ctx.save();
		ctx.shadowColor = color;
		ctx.shadowBlur = lineWidth * 20;
		for (let i = 0; i < 3; i++) {
			this._drawLine(startCanvas, endCanvas, color, lineWidth);
		}
		ctx.restore();
	}

	_drawLineDashed(startCanvas, endCanvas, color, lineWidth = 1, dashLength = 5, glow = false) {
		const ctx = this.ctx;
		if (glow) {
			ctx.save();
			ctx.shadowColor = color;
			ctx.shadowBlur = lineWidth * 10;
			for (let i = 0; i < 3; i++) {
				this._drawLineDashed(startCanvas, endCanvas, color, lineWidth, dashLength, false);
			}
			ctx.restore();
		} else {
			ctx.save();
			ctx.setLineDash([dashLength, dashLength]);
			this._drawLine(startCanvas, endCanvas, color, lineWidth);
			ctx.restore();
		}
	}

	drawLine(startCanvas, endCanvas, color, lineWidth = 1, dashLength = 0, glow = false) {
		if (dashLength > 0) {
			this._drawLineDashed(startCanvas, endCanvas, color, lineWidth, dashLength, glow);
		} else if (glow) {
			this._drawLineGlow(startCanvas, endCanvas, color, lineWidth);
		} else {
			this._drawLine(startCanvas, endCanvas, color, lineWidth);
		}
	}

	drawLineWorld(startWorld, endWorld, color, lineWidth = 1, dashLength = 0, glow = false) {
		this.drawLine(
			this.worldToCanvas(startWorld),
			this.worldToCanvas(endWorld),
			color, lineWidth, dashLength, glow
		);
	}

	drawPoint(canvasPos, color, radius = 5, glow = false) {
		const ctx = this.ctx;
		
		ctx.save();
		ctx.fillStyle = color;

		if (glow) {
			ctx.shadowColor = color;
			ctx.shadowBlur = radius * 5;
		}
		
		ctx.beginPath();
		ctx.arc(canvasPos.x, canvasPos.y, radius, 0, 2 * Math.PI);
		ctx.fill();
	
		ctx.restore();
	}

	drawPointWorld(worldPos, color, radius, glow = false) {
		this.drawPoint(this.worldToCanvas(worldPos), color, radius, glow);
	}

	drawPolygon(pointsWorld, color, lineWidth = 1, glow = false, dashLength = 0, alpha = 0.3) {

		const points = pointsWorld.map(p => this.worldToCanvas(p));
		
		if (points.length < 2) return;

		const ctx = this.ctx;

		for (let i = 0; i < points.length; i++) {
			this.drawLine(points[i], points[(i + 1) % points.length], color, lineWidth, dashLength, glow);
		}

		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	clear() {
		const { canvas, ctx } = this;
		ctx.fillStyle = settings.BACKGROUND_COLOR;
		ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
	}

	get width()  { return this.canvas.offsetWidth; }
	get height() { return this.canvas.offsetHeight; }
	get center() { return this.canvasCenter; }
}

class Polygon {

	constructor(points, color) {
		this.points = points.map(p => new Vector2(p));
		this.color = color;
	}

	*[Symbol.iterator]() {
		for (const point of this.points) yield point;
	}

	isConvex() {

		let gotNegative = false;
		let gotPositive = false;
		const n = this.points.length;

		for (let i = 0; i < n; i++) {

			const p0 = this.points[i];
			const p1 = this.points[(i + 1) % n];
			const p2 = this.points[(i + 2) % n];

			const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);

			if (cross < 0) gotNegative = true;
			else if (cross > 0) gotPositive = true;

			if (gotNegative && gotPositive) return false;
		}

		return true;
	}

	containsPoint(point) {
		let inside = false;
		const pts = this.points;
		for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
			const xi = pts[i].x, yi = pts[i].y;
			const xj = pts[j].x, yj = pts[j].y;
			const intersect = ((yi > point.y) !== (yj > point.y)) &&
				(point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
			if (intersect) inside = !inside;
		}
		return inside;
	}
}

class Camera {

	constructor(position = { x: 0, y: 0 }, unitsToPixels = 1) {
		this.position = new Vector2(position);
		this.unitsToPixels = unitsToPixels;
	}

	get pixelsToUnits() { return 1 / this.unitsToPixels; }
	set pixelsToUnits(value) { this.unitsToPixels = 1 / value; }

	get x() { return this.position.x; }
	set x(value) { this.position.x = value; }

	get y() { return this.position.y; }
	set y(value) { this.position.y = value; }
}

class Scene {

	constructor() {

		this.startPoint = new Vector2(settings.INITIAL_START_POINT);
		this.targetPoint = new Vector2(settings.INITIAL_TARGET_POINT);
		this.polygons = settings.INITIAL_POLYGONS.map(points => new Polygon(points));

		this.currentPolygon = 0;
		this.currentPolygonVertex = 0;
		this.canvas = new Canvas();

		this.snapToggle = document.getElementById(settings.SNAP_BUTTON_ID);
		this.triangleButton = document.getElementById(settings.MAKE_TRIANGLE_BUTTON_ID);
		this.vertexLineToggle = document.getElementById(settings.SHOW_VERTEX_LINE_BUTTON_ID);

		this.mouseHeld = false;
		this.mouseLocation = new Vector2(0, 0);
		this.scrollSensitivity = settings.SCROLL_SENSITIVITY;
		this.dragging = null;
		this.isDraggingCanvas = false;

		this.snapping = this.snapToggle.classList.contains("active");
		this.showVertexLine = this.vertexLineToggle.classList.contains("active");

		this.selectionRect = null;
		this.selectedPoints = [];
		this.selectedPointsTotal = new Set();

		this.lastClickTime = 0;
		this.lastClickPosition = new Vector2(0, 0);
		this.lastShiftPressTime = 0;
		this.lastShiftPosition = new Vector2(0, 0);


		this._initInput();
	}

	// --- Coordinate helpers ---

	clampToCanvas(point) {
		return new Vector2(
			Math.min(Math.max(point.x, 0), this.canvas.width),
			Math.min(Math.max(point.y, 0), this.canvas.height)
		);
	}

	snapPoint(point) {
		if (!this.snapping) return point;
		const s = this.getSubgridSpacing();
		return new Vector2(
			Math.round(point.x / s) * s,
			Math.round(point.y / s) * s
		);
	}

	movePoint(point, movement) {
		const snapped = this.snapPoint(new Vector2(point.x + movement.x, point.y + movement.y));
		point.x = snapped.x;
		point.y = snapped.y;
	}

	getSubgridSpacing() {
		const decisionValue = settings.MINIMUM_GRID_SPACING / this.canvas.camera.unitsToPixels;
		let exponent = Math.ceil(Math.log10(decisionValue)) | 0;
		let multiplier = 1;
		let subGridCount = 4;
		const gridScale = Math.pow(10, exponent);
		if (gridScale / 5 > decisionValue) { subGridCount = 3; exponent--; multiplier = 2; }
		else if (gridScale / 2 > decisionValue) { exponent--; multiplier = 5; }
		return Math.pow(10, exponent) * multiplier / (subGridCount + 1);
	}

	changeZoom(scale, fixedCanvasPoint) {
		const camera = this.canvas.camera;
		const fixedWorld = this.canvas.canvasToWorld(fixedCanvasPoint);
		camera.position.x = fixedWorld.x - (fixedWorld.x - camera.x) / scale;
		camera.position.y = fixedWorld.y - (fixedWorld.y - camera.y) / scale;
		camera.unitsToPixels *= scale;
	}

	// --- Hit testing ---

	findDraggablePoint(canvasX, canvasY, candidates = null) {
		if (candidates === null) {
			candidates = [this.startPoint, this.targetPoint];
			for (const poly of this.polygons) candidates.push(...poly.points);
		}
		for (const candidate of candidates) {
			const cp = this.canvas.worldToCanvas(candidate);
			if (Math.hypot(cp.x - canvasX, cp.y - canvasY) <= settings.HIT_RADIUS) return candidate;
		}
		return null;
	}

	findDraggablePolygon(canvasX, canvasY) {
		const world = this.canvas.canvasToWorld(canvasX, canvasY);
		for (let i = 0; i < this.polygons.length; i++) {
			if (this.polygons[i].containsPoint(world)) return i;
		}
		return -1;
	}

	dragObjects(mousePosition) {
		if (!this.dragging) return;
		const { referencePoint, pointsDragged } = this.dragging;
		const clamped = this.clampToCanvas(mousePosition);
		const world = this.canvas.canvasToWorld(clamped);
		const movement = new Vector2(world.x - referencePoint.x, world.y - referencePoint.y);
		this.movePoint(referencePoint, movement);
		for (const point of pointsDragged) {
			if (point !== referencePoint) this.movePoint(point, movement);
		}
	}

	// --- Selection ---

	updateSelectionRect(start, end) {
		if (!this.selectionRect) {
			this.selectionRect = { start: start ?? new Vector2(0, 0), end: end ?? new Vector2(0, 0) };
		} else {
			if (start) this.selectionRect.start = start.clone();
			if (end)   this.selectionRect.end   = end.clone();
		}
		this._findSelectedPoints();
	}

	unselectRect() {
		for (const p of this.selectedPoints) this.selectedPointsTotal.add(p);
		this.selectionRect = null;
		this.selectedPoints = [];
	}

	_findSelectedPoints() {
		this.selectedPoints = [];
		const candidates = [this.startPoint, this.targetPoint];
		for (const poly of this.polygons) candidates.push(...poly.points);

		const { start, end } = this.selectionRect;
		const left   = Math.min(start.x, end.x);
		const right  = Math.max(start.x, end.x);
		const top    = Math.min(start.y, end.y);
		const bottom = Math.max(start.y, end.y);

		for (const candidate of candidates) {
			const cp = this.canvas.worldToCanvas(candidate);
			if (cp.x >= left && cp.x <= right && cp.y >= top && cp.y <= bottom) {
				this.selectedPoints.push(candidate);
			}
		}
	}

	// --- Drawing ---

	drawGrid() {
		const { canvas, camera, ctx } = this.canvas;
		const { position: cameraCenter, unitsToPixels } = camera;

		const decisionValue = settings.MINIMUM_GRID_SPACING / unitsToPixels;
		let exponent = Math.ceil(Math.log10(decisionValue)) | 0;
		let multiplier = 1;
		let subGridCount = 4;

		const gridScale = Math.pow(10, exponent);
		if (gridScale / 5 > decisionValue) { subGridCount = 3; exponent--; multiplier = 2; }
		else if (gridScale / 2 > decisionValue) { exponent--; multiplier = 5; }

		const gridSpacing = Math.pow(10, exponent) * multiplier;
		const halfWidth  = canvas.offsetWidth  / 2 / unitsToPixels;
		const halfHeight = canvas.offsetHeight / 2 / unitsToPixels;

		const bounds = {
			left:   cameraCenter.x - halfWidth,
			right:  cameraCenter.x + halfWidth,
			bottom: cameraCenter.y - halfHeight,
			top:    cameraCenter.y + halfHeight,
		};

		const origin = this.canvas.worldToCanvas(0, 0);
		const { GRID_NUMBER_FONT: font, GRID_NUMBER_COLOR: color, GRID_NUMBER_LIGHT_COLOR: lightColor } = settings;

		const clampTextAnchor = (raw, lo, hi) => {
			if (raw < lo) return { pos: lo, dimmed: true };
			if (raw > hi) return { pos: hi, dimmed: true };
			return { pos: raw, dimmed: false };
		};

		const xAnchor = clampTextAnchor(origin.x - 8, -1, canvas.offsetWidth  - 8);
		const yAnchor = clampTextAnchor(origin.y + 3,  0, canvas.offsetHeight - 20);
		const pow = (e) => Math.pow(10, e);

		const drawAxis = (horizontal) => {
			const [rangeStart, count, lo, hi] = horizontal
				? [Math.floor((cameraCenter.y - halfHeight) / gridSpacing) * multiplier, Math.ceil(halfHeight * 2 / gridSpacing), bounds.left,   bounds.right ]
				: [Math.floor((cameraCenter.x - halfWidth)  / gridSpacing) * multiplier, Math.ceil(halfWidth  * 2 / gridSpacing), bounds.bottom, bounds.top   ];

			for (let i = 0; i <= count; i++) {
				const integerPart = rangeStart + i * multiplier;
				const world = integerPart * pow(exponent);

				const a = horizontal ? new Vector2(lo, world) : new Vector2(world, lo);
				const b = horizontal ? new Vector2(hi, world) : new Vector2(world, hi);
				this.canvas.drawLineWorld(a, b, settings.GRID_COLOR, settings.GRID_WIDTH);

				for (let j = 0; j < subGridCount; j++) {
					const sub = world + gridSpacing * (j + 1) / (subGridCount + 1);
					const sa = horizontal ? new Vector2(lo, sub) : new Vector2(sub, lo);
					const sb = horizontal ? new Vector2(hi, sub) : new Vector2(sub, hi);
					this.canvas.drawLineWorld(sa, sb, settings.SUB_GRID_COLOR, settings.SUB_GRID_WIDTH);
				}

				if (Math.abs(world) <= 1e-12) continue;

				const anchor = horizontal ? xAnchor : yAnchor;
				const screenPos = horizontal
					? this.canvas.worldToCanvas(0, world).y
					: this.canvas.worldToCanvas(world, 0).x;

				ctx.font      = font;
				ctx.fillStyle = anchor.dimmed ? lightColor : color;

				if (horizontal) {
					ctx.textAlign    = anchor.pos === -1 ? "left" : "right";
					ctx.textBaseline = "middle";
					ctx.fillText(floatToString(integerPart, exponent), anchor.pos === -1 ? 10 : anchor.pos, screenPos);
				} else {
					ctx.textAlign    = "center";
					ctx.textBaseline = "top";
					ctx.fillText(floatToString(integerPart, exponent), screenPos, anchor.pos);
				}
			}
		};

		drawAxis(false);
		drawAxis(true);

		ctx.fillStyle    = color;
		ctx.font         = font;
		ctx.textAlign    = "right";
		ctx.textBaseline = "top";
		ctx.fillText("0", origin.x - 8, origin.y + 3);

		this.canvas.drawLineWorld(new Vector2(bounds.left,   0), new Vector2(bounds.right, 0), settings.MAIN_AXIS_COLOR, settings.MAIN_AXIS_WIDTH);
		this.canvas.drawLineWorld(new Vector2(0, bounds.bottom), new Vector2(0, bounds.top),   settings.MAIN_AXIS_COLOR, settings.MAIN_AXIS_WIDTH);
	}

	drawSolution() {
		for (const poly of this.polygons) {
			if (!poly.isConvex()) return;
		}

		const start  = [this.startPoint.x,  this.startPoint.y];
		const target = [this.targetPoint.x, this.targetPoint.y];
		const polys  = this.polygons.map(poly => poly.points.map(v => [v.x, v.y]));

		let path;
		try {
			path = tppSolve(start, target, polys, true);
		} catch (e) {
			console.error("Error solving TPP:", e, [start, target, polys]);
			return;
		}

		for (let i = 0; i < path.length - 1; i++) {
			const p1 = new Vector2(path[i].x,     path[i].y);
			const p2 = new Vector2(path[i + 1].x, path[i + 1].y);
			this.canvas.drawLineWorld(p1, p2, settings.SOLUTION_COLOR, 3);
			this.canvas.drawPointWorld(p1, settings.SOLUTION_COLOR, 6);
		}
	}

	drawPolygons() {
		
		const ctx = this.canvas.ctx;

		for (let i = 0; i < this.polygons.length; i++) {
			
			const poly = this.polygons[i];
			const color = settings.POLYGON_COLORS[i % settings.POLYGON_COLORS.length];
			const isSelected = this.currentPolygon % this.polygons.length === i;

			for (const vertex of poly.points) {
				this.canvas.drawPointWorld(vertex, color, settings.POINT_RADIUS * 0.6, isSelected);
			}

			if (!poly.isConvex()) {
				const center = poly.points.reduce(
					(acc, p) => new Vector2(acc.x + p.x / poly.points.length, acc.y + p.y / poly.points.length),
					new Vector2(0, 0)
				);
				const cp = this.canvas.worldToCanvas(center);
				ctx.font         = "16px sans-serif";
				ctx.fillStyle    = "red";
				ctx.textAlign    = "center";
				ctx.textBaseline = "middle";
				ctx.fillText("NOT CONVEX", cp.x, cp.y);
			}

			this.canvas.drawPolygon(poly.points, color, 2, isSelected, 0, 0.25);
			// this.canvas.drawPolygon(poly.points, settings.MAIN_AXIS_COLOR, settings.GRID_WIDTH, false, 8, 0);
		}
	}

	drawVertexLine() {

		if (!this.showVertexLine || this.polygons.length === 0) return;

		const poly = this.polygons[this.currentPolygon % this.polygons.length];
		const n = poly.points.length;
		const v1 = poly.points[((this.currentPolygonVertex - 1) % n + n) % n];
		const v2 = poly.points[this.currentPolygonVertex % n];
		const mouseWorld = this.canvas.canvasToWorld(this.mouseLocation);
		const color = settings.POLYGON_COLORS[this.currentPolygon % settings.POLYGON_COLORS.length];

		this.canvas.drawLineWorld(new Vector2(v1.x, v1.y), mouseWorld, color, 2, 0, true);
		this.canvas.drawLineWorld(new Vector2(v2.x, v2.y), mouseWorld, color, 2, 0, true);
	}

	drawSelectionRect() {
		if (!this.selectionRect) return;
		const ctx = this.canvas.ctx;
		const { start, end } = this.selectionRect;
		const left   = Math.min(start.x, end.x);
		const top    = Math.min(start.y, end.y);
		const width  = Math.abs(start.x - end.x);
		const height = Math.abs(start.y - end.y);

		ctx.strokeStyle = settings.MAIN_AXIS_COLOR;
		ctx.lineWidth   = 1.5;
		ctx.setLineDash([5, 3]);
		ctx.strokeRect(left, top, width, height);
		ctx.fillStyle = settings.MAIN_AXIS_COLOR + "66";
		ctx.fillRect(left, top, width, height);
		ctx.setLineDash([]);
	}

	drawSelectedPoints() {
		const ctx = this.canvas.ctx;
		const r = settings.POINT_RADIUS * 1.5;
		const speed = 0.002;
		const angle = performance.now() * speed;

		for (const point of [...this.selectedPoints, ...this.selectedPointsTotal]) {
			const cp = this.canvas.worldToCanvas(point);
			ctx.beginPath();
			ctx.arc(cp.x, cp.y, r, angle, angle + Math.PI * 2);
			ctx.strokeStyle = settings.MAIN_AXIS_COLOR;
			ctx.lineWidth   = 2;
			ctx.setLineDash([5, 3]);
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}

	draw() {
		this.canvas.clear();
		this.drawGrid();
		this.drawSolution();
		this.drawPolygons();
		this.drawVertexLine();
		this.drawSelectionRect();
		this.drawSelectedPoints();
		this.canvas.drawPointWorld(this.startPoint,  settings.START_POINT_COLOR,  settings.POINT_RADIUS, true);
		this.canvas.drawPointWorld(this.targetPoint, settings.TARGET_POINT_COLOR, settings.POINT_RADIUS, true);
	}

	// --- Input ---

	_initInput() {
		const canvas = this.canvas.canvas;

		window.addEventListener("blur", () => {
			this.mouseHeld = false;
			this.dragging = null;
		});

		document.addEventListener("mouseleave", () => {
			this.mouseHeld = false;
			this.dragging = null;
		});

		document.addEventListener("mousedown", (e) => this._onMouseDown(e));
		document.addEventListener("mouseup",   (e) => this._onMouseUp(e));
		document.addEventListener("mousemove", (e) => this._onMouseMove(e));
		document.addEventListener("keydown",   (e) => this._onKeyDown(e));
		document.addEventListener("keyup",     (e) => this._onKeyUp(e));

		canvas.addEventListener("wheel", (e) => {
			e.preventDefault();
			this.changeZoom(1 - e.deltaY * this.scrollSensitivity, this.mouseLocation);
		}, { passive: false });

		this.snapToggle.addEventListener("click", () => {
			this.snapping = !this.snapping;
		});

		this.triangleButton.addEventListener("click", () => {

			const screenCenter = this.canvas.center;

			const points = [0, 1, 2].map(i => {
				const angle = i * 2 * Math.PI / 3 - Math.PI / 2;
				const radius = 50;
				const offset = new Vector2(Math.cos(angle), Math.sin(angle)).mul(radius);
				return this.canvas.canvasToWorld(screenCenter.add(offset));
			});

			const color = settings.POLYGON_COLORS[this.polygons.length % settings.POLYGON_COLORS.length];

			const newPoly = new Polygon(points, color);
			this.polygons.push(newPoly);
			this.currentPolygon = this.polygons.length - 1;
		});

		this.vertexLineToggle.addEventListener("click", () => {
			this.showVertexLine = !this.showVertexLine;
		});
	}

	_getCanvasPos(e) {
		const bounds = this.canvas.canvas.getBoundingClientRect();
		return new Vector2(e.clientX - bounds.left, e.clientY - bounds.top);
	}

	_isInCanvas(pos) {
		return pos.x >= 0 && pos.x <= this.canvas.width && pos.y >= 0 && pos.y <= this.canvas.height;
	}

	_onMouseDown(e) {
		const pos = this._getCanvasPos(e);

		this.lastClickTime     = performance.now();
		this.lastClickPosition = pos;

		const selectionPoint = this.findDraggablePoint(pos.x, pos.y, [...this.selectedPointsTotal]);
		if (selectionPoint) {
			this.dragging = { referencePoint: selectionPoint.clone(), pointsDragged: [...this.selectedPointsTotal] };
			return;
		}

		const point = this.findDraggablePoint(pos.x, pos.y);
		if (point) {
			this.dragging = { referencePoint: point.clone(), pointsDragged: [point] };
			return;
		}

		const polyIndex = this.findDraggablePolygon(pos.x, pos.y);
		if (polyIndex !== -1) {
			this.dragging = {
				referencePoint: this.canvas.canvasToWorld(pos),
				pointsDragged: this.polygons[polyIndex].points,
			};
			this.currentPolygon = polyIndex;
			return;
		}

		if (this._isInCanvas(pos)) this.isDraggingCanvas = true;
	}

	_onMouseUp(e) {
		this.isDraggingCanvas = false;

		if (this.dragging) {
			this.dragging = null;
			return;
		}

		const pos = this._getCanvasPos(e);
		if (!this._isInCanvas(pos)) return;

		const isRecent = performance.now() - this.lastClickTime < 300;
		const isClose  = this.mouseLocation.distanceTo(this.lastClickPosition) < settings.HIT_RADIUS;

		if (isRecent && isClose && this.polygons.length > 0) {
			const clamped    = this.clampToCanvas(this.mouseLocation);
			const world      = this.canvas.canvasToWorld(clamped);
			const poly       = this.polygons[this.currentPolygon % this.polygons.length];
			poly.points.push(world);
		}
	}

	_onMouseMove(e) {
		const bounds = this.canvas.canvas.getBoundingClientRect();
		this.mouseLocation = new Vector2(e.clientX - bounds.left, e.clientY - bounds.top);

		if (e.shiftKey && !this.selectionRect) {
			this.updateSelectionRect(this.mouseLocation, this.mouseLocation);
		} else if (!e.shiftKey && this.selectionRect) {
			this.unselectRect();
		}

		if (this.selectionRect) this.updateSelectionRect(null, this.mouseLocation);

		if (this.dragging) {
			this.dragObjects(this.mouseLocation);
			return;
		}

		const hovering = this.findDraggablePoint(this.mouseLocation.x, this.mouseLocation.y) ||
			this.findDraggablePolygon(this.mouseLocation.x, this.mouseLocation.y) !== -1;
		this.canvas.canvas.style.cursor = hovering ? "move" : "default";

		if (this.isDraggingCanvas) {
			this.canvas.camera.position.x -= e.movementX / this.canvas.camera.unitsToPixels;
			this.canvas.camera.position.y += e.movementY / this.canvas.camera.unitsToPixels;
		}
	}

	_onKeyDown(e) {
		const cam = this.canvas.camera;

		if (e.key === "w") cam.position.y += 0.1;
		if (e.key === "s") cam.position.y -= 0.1;
		if (e.key === "a") cam.position.x -= 0.1;
		if (e.key === "d") cam.position.x += 0.1;

		if (e.key === "=") this.changeZoom(1.1,       new Vector2(this.canvas.width / 2, this.canvas.height / 2));
		if (e.key === "-") this.changeZoom(1 / 1.1,   new Vector2(this.canvas.width / 2, this.canvas.height / 2));

		if (e.key === "Shift") {
			this.updateSelectionRect(this.mouseLocation, this.mouseLocation);
			
		}

		if (e.key === "ArrowUp")   this.currentPolygon++;
		if (e.key === "ArrowDown") this.currentPolygon--;

		if (e.key === "h") this.showVertexLine = !this.showVertexLine;

		if (e.key === "Backspace" || e.key === "Delete" || e.key === "x") {
			this._deleteSelected();
		}

		if (e.key === "1") {this.snapToggle.click();}
		if (e.key === "2") {this.triangleButton.click();}
		if (e.key === "3") {this.vertexLineToggle.click();}
	}

	_onKeyUp(e) {
		if (e.key === "Shift") {
			this.unselectRect();
			
			const isRecent = this.lastShiftPressTime && (performance.now() - this.lastShiftPressTime < settings.DOUBLE_CLICK_TIME);
			const isClose = this.mouseLocation.distanceTo(this.lastShiftPosition) < settings.HIT_RADIUS;

			this.lastShiftPressTime = performance.now();
			this.lastShiftPosition = this.mouseLocation.clone();

			if (isRecent && isClose) {
				this.selectedPointsTotal = new Set();
				this.selectedPoints = [];
				this.selectionRect = null;
			}
		}
	}

	_deleteSelected() {
		if (this.selectedPointsTotal.size === 0) return;

		const lenBefore = this.polygons.length;
		this.polygons = this.polygons.filter(poly => !poly.points.every(v => this.selectedPointsTotal.has(v)));
		if (this.polygons.length !== lenBefore) this.currentPolygon = 0;

		for (const point of this.selectedPointsTotal) {
			for (const poly of this.polygons) {
				if (poly.points.length <= 3) continue;
				const idx = poly.points.indexOf(point);
				if (idx !== -1) { poly.points.splice(idx, 1); break; }
			}
		}

		this.selectedPointsTotal = new Set();
		this.selectedPoints = [];
	}
}

const scene = new Scene();

function animate() {
	scene.draw();
	requestAnimationFrame(animate);
}

animate();
