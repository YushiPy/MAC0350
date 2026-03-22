
// HTML SOURCE
// The above comment indicates that this file is referenced in an HTML file 
// and should be ran from the context of that HTML file, not directly.

const canvas = document.getElementById("drawing-canvas");
const ctx = canvas.getContext("2d");

const resize_observer = new ResizeObserver(() => {
	const dpr = window.devicePixelRatio || 1;
	canvas.width = canvas.offsetWidth * dpr;
	canvas.height = canvas.offsetHeight * dpr;
	ctx.scale(dpr, dpr);
	draw();
});

resize_observer.observe(canvas);

let camera_center = { x: 0, y: 0 };
let units_to_pixels = 300; // 1 unit = `unit_to_pixels` pixels

let mouse_held = false; // Left mouse button is held down or not
let mouse_location = { x: 0, y: 0 }; // Mouse location in screen coordinates (pixels)

let scroll_sensitivity = 0.0005; // How much the camera zooms in/out when scrolling

// Grid lines must be at least `min_grid_spacing` pixels apart, 
// we adjust the number of grid lines based on the zoom level to achieve this
let min_grid_spacing = 83; 


let startPoint = { x: 0, y: 0};
let targetPoint = { x: 1, y: 0};

let polygons = [
	[{ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 1, y: 1 }],
	[{ x: -0.5, y: -0.5 }, { x: -1.5, y: -0.5 }, { x: -1, y: -1 }],
]

function canvas_center() {
	return {
		x: canvas.offsetWidth / 2,
		y: canvas.offsetHeight / 2
	};
}

function world_to_canvas(x, y) {
	return {
		x: canvas.offsetWidth / 2 + (x - camera_center.x) * units_to_pixels,
		y: canvas.offsetHeight / 2 - (y - camera_center.y) * units_to_pixels
	};
}

function canvas_to_world(x, y) {
	return {
		x: (x - canvas.offsetWidth / 2) / units_to_pixels + camera_center.x,
		y: -(y - canvas.offsetHeight / 2) / units_to_pixels + camera_center.y
	};
}

function clamp_number(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function clamp_point(point, min, max) {
	return {
		x: clamp_number(point.x, min.x, max.x),
		y: clamp_number(point.y, min.y, max.y)
	};
}

function clamp_to_canvas(point) {
	return clamp_point(point, { x: 0, y: 0 }, { x: canvas.offsetWidth, y: canvas.offsetHeight });
}

function fix_coordinates(x, y) {

	if (!isFinite(x)) {
		if (x > 0) {
			x = camera_center.x + canvas.offsetWidth / 2 / units_to_pixels;
		} else {
			x = camera_center.x - canvas.offsetWidth / 2 / units_to_pixels;
		}
	}

	if (!isFinite(y)) {
		if (y > 0) {
			y = camera_center.y + canvas.offsetHeight / 2 / units_to_pixels;
		} else {
			y = camera_center.y - canvas.offsetHeight / 2 / units_to_pixels;
		}
	}

	return [x, y];
}

function draw_line(x1, y1, x2, y2, color = "black", lineWidth = 1) {

	ctx.beginPath();

	[x1, y1] = fix_coordinates(x1, y1);
	[x2, y2] = fix_coordinates(x2, y2);

	const p1 = world_to_canvas(x1, y1);
	const p2 = world_to_canvas(x2, y2);

	ctx.moveTo(p1.x, p1.y);
	ctx.lineTo(p2.x, p2.y);
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.stroke();
}

function draw_point(x, y, radius, color = "black") {

	ctx.beginPath();

	const p = world_to_canvas(x, y);

	ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();
}

function draw_polygon(points, color = "black") {
	// Draws a filled polygon with the given vertices (in world coordinates) and color.
	// The polygon's inside is partially transparent so that the grid lines can be seen through it.
	// The polygon's border is solid and has the same color as the inside, but fully opaque.

	ctx.beginPath();
	
	const first_point = world_to_canvas(points[0].x, points[0].y);
	ctx.moveTo(first_point.x, first_point.y);

	for (let i = 1; i < points.length; i++) {
		const p = world_to_canvas(points[i].x, points[i].y);
		ctx.lineTo(p.x, p.y);
	}

	ctx.closePath();
	ctx.fillStyle = color;
	ctx.globalAlpha = 0.4;
	ctx.fill();
	ctx.globalAlpha = 1.0;
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.stroke();
}

function get_grid_scale(minimum_grid_spacing = min_grid_spacing) {
	/*
	Returns `scale` such that every grid line is drawn at integer multiples of `scale`, 
	and the distance between grid lines is at least `min_grid_spacing` pixels.

	The value of `scale` is always a power of 10 multiplied by 1, 2 or 5, so that 
	the grid lines are drawn at "nice" numbers (e.g. 0.1, 0.2, 0.5, 1, 2, 5, 10, etc.)
	*/


	// x is a valid grid scale if (canvas_width / units_to_pixels) / x < (canvas_width / min_grid_spacing)
	// -> x is a valid grid scale if x > min_grid_spacing / units_to_pixels
	// -> 10 ^ e is a valid if e > \log_{10}(min_grid_spacing / units_to_pixels)

	let decision_value = minimum_grid_spacing / units_to_pixels;

	let exponent = Math.ceil(Math.log10(decision_value));
	let base_scale = Math.pow(10, exponent);

	if (base_scale / 5 > decision_value) {
		return base_scale / 5;
	} else if (base_scale / 2 > decision_value) {
		return base_scale / 2;
	} else {
		return base_scale;
	}	
}

function draw_grid(minimum_grid_spacing, grid_color, sub_grid_color) {

	const decision_value = minimum_grid_spacing / units_to_pixels;

	const exponent = Math.ceil(Math.log10(decision_value));
	let grid_scale = Math.pow(10, exponent);

	let sub_grid_count = 4;

	if (grid_scale / 5 > decision_value) {
		grid_scale /= 5;
		sub_grid_count = 3;
	} else if (grid_scale / 2 > decision_value) {
		grid_scale /= 2;
	}

	const half_width = canvas.offsetWidth / 2 / units_to_pixels;
	const half_height = canvas.offsetHeight / 2 / units_to_pixels;

	// Get font from css
	const style = getComputedStyle(document.documentElement);

	const number_text_font = style.getPropertyValue("--number-text-font").trim();
	const number_text_color = style.getPropertyValue("--number-text-color").trim();
	const number_text_light_color = style.getPropertyValue("--number-text-light-color").trim();

	const canvas_right = camera_center.x + half_width;
	const canvas_left = camera_center.x - half_width;
	const canvas_top = camera_center.y + half_height;
	const canvas_bottom = camera_center.y - half_height;

	let x_start = Math.floor((camera_center.x - half_width) / grid_scale) * grid_scale;
	
	let text_fixed_y = world_to_canvas(0, 0).y + 3;
	let text_horizontal_color = number_text_color;

	if (text_fixed_y < 0) {
		text_fixed_y = 2;
		text_horizontal_color = number_text_light_color;
	} else if (text_fixed_y > canvas.offsetHeight - 20) {
		text_fixed_y = canvas.offsetHeight - 20;
		text_horizontal_color = number_text_light_color;
	} else {
		text_fixed_y += 2;
	}

	while (x_start < camera_center.x + half_width) {

		draw_line(x_start, canvas_bottom, x_start, canvas_top, grid_color);

		// Write number next to the grid line
		if (Math.abs(x_start) > 1e-10) {

			const text_x = world_to_canvas(x_start, 0).x;
			ctx.fillStyle = text_horizontal_color;
			ctx.font = number_text_font;
			ctx.textAlign = "center";
			ctx.textBaseline = "top";
			ctx.fillText(x_start.toString(), text_x, text_fixed_y);
		}

		for (let i = 0; i < sub_grid_count; i++) {
			const sub_grid_x = x_start + grid_scale * (i + 1) / (sub_grid_count + 1);
			draw_line(sub_grid_x, canvas_bottom, sub_grid_x, canvas_top, sub_grid_color);
		}

		x_start += grid_scale;
	}

	let text_fixed_x = world_to_canvas(0, 0).x - 8;
	let text_vertical_color = number_text_color;

	if (text_fixed_x < 20) {
		text_fixed_x = -1;
		text_vertical_color = number_text_light_color;
	} else if (text_fixed_x > canvas.offsetWidth - 8) {
		text_fixed_x = canvas.offsetWidth - 8;
		text_vertical_color = number_text_light_color;
	} else {
		text_fixed_x += 2;
	}
	
	let y_start = Math.floor((camera_center.y - half_height) / grid_scale) * grid_scale;
	
	while (y_start < camera_center.y + half_height) {

		draw_line(canvas_left, y_start, canvas_right, y_start, grid_color);

		// Write number next to the grid line
		if (Math.abs(y_start) > 1e-10) {

			const text_y = world_to_canvas(0, y_start).y;
			ctx.fillStyle = text_vertical_color;
			ctx.font = number_text_font;
			ctx.textAlign = "right";
			let text_x = text_fixed_x;
			if (text_fixed_x == -1) {
				ctx.textAlign = "left";
				text_x = 10;
			}
			ctx.textBaseline = "middle";
			ctx.fillText(y_start.toString(), text_x, text_y);
		}

		for (let i = 0; i < sub_grid_count; i++) {
			const sub_grid_y = y_start + grid_scale * (i + 1) / (sub_grid_count + 1);
			draw_line(canvas_left, sub_grid_y, canvas_right, sub_grid_y, sub_grid_color);
		}

		y_start += grid_scale;
	}

	// Draw 0 on bottom left corner:

	let zero_position = world_to_canvas(0, 0);

	let zero_x = zero_position.x - 8;
	let zero_y = zero_position.y + 3;

	ctx.fillStyle = number_text_color;
	ctx.font = number_text_font;
	ctx.textAlign = "right";
	ctx.textBaseline = "top";
	ctx.fillText("0", zero_x, zero_y);
}

function draw() {

	ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

	const style = getComputedStyle(document.documentElement);
	const axisColor = style.getPropertyValue("--axis-color").trim();
	const gridColor = style.getPropertyValue("--grid-color").trim();
	const subGridColor = style.getPropertyValue("--sub-grid-color").trim();

	draw_grid(min_grid_spacing, gridColor, subGridColor);

	// Draw main axis
	draw_line(0, Number.NEGATIVE_INFINITY, 0, Number.POSITIVE_INFINITY, axisColor, 1.5);
	draw_line(Number.NEGATIVE_INFINITY, 0, Number.POSITIVE_INFINITY, 0, axisColor, 1.5);

	const startPointColor = style.getPropertyValue("--start-point-color").trim();
	const targetPointColor = style.getPropertyValue("--target-point-color").trim();

	const pointRadius = parseFloat(style.getPropertyValue("--point-radius"));

	draw_point(startPoint.x, startPoint.y, pointRadius, startPointColor);
	draw_point(targetPoint.x, targetPoint.y, pointRadius, targetPointColor);

	let polygonColors = style.getPropertyValue("--polygon-colors").trim().split(",").map(s => s.trim());

	for (let i = 0; i < polygons.length; i++) {

		const polygonColor = polygonColors[i % polygonColors.length];

		draw_polygon(polygons[i], polygonColor);

		for (let j = 0; j < polygons[i].length; j++) {
			const vertex = polygons[i][j];
			draw_point(vertex.x, vertex.y, pointRadius * 0.6, polygonColor);
		}
	}
}


function change_zoom(scale, fixed_canvas_point) {

	let fixed_point_world = canvas_to_world(fixed_canvas_point.x, fixed_canvas_point.y);
	
	camera_center.x = fixed_point_world.x - (fixed_point_world.x - camera_center.x) / scale;
	camera_center.y = fixed_point_world.y - (fixed_point_world.y - camera_center.y) / scale;

	units_to_pixels *= scale;
}

let manualOverride = false;

const mq = window.matchMedia('(prefers-color-scheme: dark)');
let isDark = mq.matches;

function applyTheme() {
	document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

function parse_color(str) {
	const tmp = document.createElement("div");
	tmp.style.color = str;
	document.body.appendChild(tmp);
	const computed = getComputedStyle(tmp).color;
	document.body.removeChild(tmp);
	const [r, g, b] = computed.match(/\d+/g).map(Number);
	return { r, g, b };
}

function lerp_color(a, b, t) {
	return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

function ease_in_out(t) {
	return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

const CANVAS_VARS = [
	"--background-color",
	"--axis-color",
	"--grid-color",
	"--sub-grid-color",
	"--number-text-color",
	"--number-text-light-color",
	"--start-point-color",
];

let toggleAnimationId = null;
let currentT = 1; // 1 = fully settled, 0 = just started

function toggleTheme() {

	if (toggleAnimationId !== null) {
		cancelAnimationFrame(toggleAnimationId);
		CANVAS_VARS.forEach(v => document.documentElement.style.removeProperty(v));
		toggleAnimationId = null;
	}

	const root = document.documentElement;
	const from = Object.fromEntries(CANVAS_VARS.map(v => [v, parse_color(getComputedStyle(root).getPropertyValue(v).trim())]));

	isDark = !isDark;
	manualOverride = true;
	applyTheme();

	const styleAfter = getComputedStyle(root);
	const to = Object.fromEntries(CANVAS_VARS.map(v => [v, parse_color(styleAfter.getPropertyValue(v).trim())]));

	const duration = parseFloat(styleAfter.getPropertyValue("--background-transition-duration")) * 1000 || 300;

	// Start from the mirror of where we were (e.g. interrupted at t=0.25 → start new at t=0.75)
	const startT = 1 - currentT;
	const startTime = performance.now() - startT * duration;

	function redrawLoop(now) {
		currentT = ease_in_out(Math.min((now - startTime) / duration, 1));
		CANVAS_VARS.forEach(v => root.style.setProperty(v, lerp_color(from[v], to[v], currentT)));
		draw();
		if (currentT < 1) {
			toggleAnimationId = requestAnimationFrame(redrawLoop);
		} else {
			CANVAS_VARS.forEach(v => root.style.removeProperty(v));
			toggleAnimationId = null;
			currentT = 1;
			draw();
		}
	}

	toggleAnimationId = requestAnimationFrame(redrawLoop);
}

mq.addEventListener('change', e => {
	if (!manualOverride) {
		isDark = e.matches;
		applyTheme();
	}
});

applyTheme();


let dragging = null; // { obj, key } — the object and key being dragged

const HIT_RADIUS = 10; // pixels

function find_draggable_point(canvas_x, canvas_y) {

	const candidates = [
		{ obj: startPoint,  key: null, ref: "startPoint"  },
		{ obj: targetPoint, key: null, ref: "targetPoint" },
	];

	for (let i = 0; i < polygons.length; i++) {
		for (let j = 0; j < polygons[i].length; j++) {
			candidates.push({ obj: polygons[i], key: j });
		}
	}

	for (const candidate of candidates) {
		const pt = candidate.key !== null ? candidate.obj[candidate.key] : candidate.obj;
		const cp = world_to_canvas(pt.x, pt.y);
		const dx = cp.x - canvas_x;
		const dy = cp.y - canvas_y;
		if (Math.sqrt(dx*dx + dy*dy) <= HIT_RADIUS) return candidate;
	}

	return null;
}

window.addEventListener("blur", () => {
    mouse_held = false;
    dragging = null;
});

document.addEventListener("mouseleave", () => {
    mouse_held = false;
    dragging = null;
});

document.addEventListener("mousedown", (e) => {
	const bounds = canvas.getBoundingClientRect();
	const cx = e.clientX - bounds.left;
	const cy = e.clientY - bounds.top;

	dragging = find_draggable_point(cx, cy);
	if (!dragging) mouse_held = true;
});

document.addEventListener("mouseup", () => {
	mouse_held = false;
	dragging = null;
});

document.addEventListener("mousemove", (e) => {

	const bounds = canvas.getBoundingClientRect();
	mouse_location.x = e.clientX - bounds.left;
	mouse_location.y = e.clientY - bounds.top;

	if (dragging) {
		const clamped_mouse = clamp_to_canvas(mouse_location);
		const world = canvas_to_world(clamped_mouse.x, clamped_mouse.y);
		const pt = dragging.key !== null ? dragging.obj[dragging.key] : dragging.obj;

		pt.x = world.x;
		pt.y = world.y;
		draw();
		return;
	}

	canvas.style.cursor = find_draggable_point(mouse_location.x, mouse_location.y) ? "pointer" : "default";

	if (mouse_held) {
		camera_center.x -= e.movementX / units_to_pixels;
		camera_center.y += e.movementY / units_to_pixels;
		draw();
	}	
});


canvas.addEventListener("wheel", (e) => {
	
	let scale = 1 - e.deltaY * scroll_sensitivity;

	change_zoom(scale, mouse_location);
	
	draw();
});

document.addEventListener("keydown", (e) => {
	if (e.key === "w") {camera_center.y += 0.1; draw();};
	if (e.key === "s") {camera_center.y -= 0.1; draw();};
	if (e.key === "a") {camera_center.x -= 0.1; draw();};
	if (e.key === "d") {camera_center.x += 0.1; draw();};

	if (e.key === "=") {
		change_zoom(1.1, canvas_center());
		draw();
	}

	if (e.key === "-") {
		change_zoom(1 / 1.1, canvas_center());
		draw();
	}

	if (e.key === "t") {
		toggleTheme();
	}
});
