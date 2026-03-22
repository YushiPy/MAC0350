
// HTML SOURCE SERVER
// The above comment indicates that this file is referenced in an HTML file 
// and should be ran from the context of that HTML file, not directly.

// import { tppSolve } from "tpp.js";
import { tppSolve } from "./tpp.js";

const canvas = document.getElementById("drawing-canvas");
const ctx = canvas.getContext("2d");

const resize_observer = new ResizeObserver(() => {
	const dpr = window.devicePixelRatio || 1;
	canvas.width = canvas.offsetWidth * dpr;
	canvas.height = canvas.offsetHeight * dpr;
	ctx.scale(dpr, dpr);
	
});

const POLYGON_COLOR_COUNT = 6; // however many you have


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
	[{ x: -0.5, y: 0.0 }, { x: -1.5, y: -0.5 }, { x: -1, y: -1 }, { x: -0.5, y: -1 }, { x: 0.5, y: -0.5 }],
]

let selected_points = []
// Set of all points that have ever been selected, 
// allows for multiple selection without losing previously 
// selected points.
let selected_points_total = new Set(); 

// { start: {x, y}, end: {x, y} } in canvas coordinates, or null if not selecting
let selection_rect = null; 

// Index of the polygon being edited, 
// or -1 if not editing any polygon (e.g. dragging the whole polygon)
let current_polygon = 0;

function copy_point(point) {
	return { x: point.x, y: point.y };
}

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

function draw_polygon_glowing(points, color) {
	ctx.save();
	ctx.shadowColor = color;
	ctx.shadowBlur = 20;
	// Draw the stroke multiple times to intensify the glow
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		const first = world_to_canvas(points[0].x, points[0].y);
		ctx.moveTo(first.x, first.y);
		for (let j = 1; j < points.length; j++) {
			const p = world_to_canvas(points[j].x, points[j].y);
			ctx.lineTo(p.x, p.y);
		}
		ctx.closePath();
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	ctx.restore();
}

function draw_polygon_outline_dashed(points, color) {
	ctx.save();
	ctx.beginPath();
	const first = world_to_canvas(points[0].x, points[0].y);
	ctx.moveTo(first.x, first.y);
	for (let i = 1; i < points.length; i++) {
		const p = world_to_canvas(points[i].x, points[i].y);
		ctx.lineTo(p.x, p.y);
	}
	ctx.closePath();
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.setLineDash([8, 4]);
	ctx.stroke();
	ctx.restore();
}

function color_add_alpha(color, alpha) {
	// Adds alpha to a color string in any format (e.g. "red", "#ff0000", "rgb(255, 0, 0)", etc.)
	// Returns the color in rgba format (e.g. "rgba(255, 0, 0, 0.5)")

	const tmp = document.createElement("div");
	tmp.style.color = color;
	document.body.appendChild(tmp);
	const computed = getComputedStyle(tmp).color;
	document.body.removeChild(tmp);
	const [r, g, b] = computed.match(/\d+/g).map(Number);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function draw_selection_rect(rect, color = "black") {
	
	const p1 = rect.start;
	const p2 = rect.end;

	const left = Math.min(p1.x, p2.x);
	const top = Math.min(p1.y, p2.y);
	const width = Math.abs(p1.x - p2.x);
	const height = Math.abs(p1.y - p2.y);

	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([5, 3]);
	ctx.strokeRect(left, top, width, height);
	
	ctx.fillStyle = color_add_alpha(color, 0.4);
	ctx.fillRect(left, top, width, height);

	ctx.setLineDash([]);
}

function float_to_string(integer_part, exponent) {

	if (Math.abs(exponent) >= 5) {
		return integer_part.toString() + "e" + exponent.toString();
	}

	let string = (integer_part * Math.pow(10, exponent)).toFixed(6);

	// Split string into integer and decimal parts
	let [integer_str, decimal_str] = string.split(".");

	if (!decimal_str) {
		decimal_str = "";
	}

	decimal_str = decimal_str.replace(/\.?0+$/, ""); // Remove trailing zeros and optional decimal point

	return integer_str + (decimal_str ? "." + decimal_str : "");
}

function draw_grid(minimum_grid_spacing, grid_color, sub_grid_color) {

	const decision_value = minimum_grid_spacing / units_to_pixels;

	let exponent = Math.ceil(Math.log10(decision_value)) | 0;
	let multiplier = 1;
	let grid_scale = Math.pow(10, exponent);

	let sub_grid_count = 4;

	if (grid_scale / 5 > decision_value) {
		sub_grid_count = 3;
		exponent--;
		multiplier = 2;
	} else if (grid_scale / 2 > decision_value) {
		exponent--;
		multiplier = 5;
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

	// let x_start = Math.floor((camera_center.x - half_width) / grid_scale) * grid_scale;
	
	const grid_spacing = Math.pow(10, exponent) * multiplier

	const integer_part_start_x = Math.floor((camera_center.x - half_width) / grid_spacing) * multiplier;
	const grid_count_x = Math.ceil(half_width * 2 / grid_spacing);

	const integer_part_start_y = Math.floor((camera_center.y - half_height) / grid_spacing) * multiplier;
	const grid_count_y = Math.ceil(half_height * 2 / grid_spacing);

	// offset pixels for text
	const y_offset = +3; 
	const x_offset = -8;

	let text_fixed_y = world_to_canvas(0, 0).y + y_offset;
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

	let text_fixed_x = world_to_canvas(0, 0).x + x_offset;
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

	for (let i = 0; i <= grid_count_x; i++) {
		
		const integer_part = integer_part_start_x + i * multiplier;
		const x_world = integer_part * Math.pow(10, exponent);

		draw_line(x_world, canvas_bottom, x_world, canvas_top, grid_color);

		for (let j = 0; j < sub_grid_count; j++) {
			const sub_grid_x = x_world + grid_spacing * (j + 1) / (sub_grid_count + 1);
			draw_line(sub_grid_x, canvas_bottom, sub_grid_x, canvas_top, sub_grid_color);
		}

		// Write number next to the grid line
		if (Math.abs(x_world) > 1e-12) {
			
			const text_x_position = world_to_canvas(x_world, 0).x;
			const text = float_to_string(integer_part, exponent);
			
			ctx.fillStyle = text_horizontal_color;
			ctx.font = number_text_font;
			ctx.textAlign = "center";
			ctx.textBaseline = "top";
			ctx.fillText(text, text_x_position, text_fixed_y);
		}
	}

	for (let i = 0; i <= grid_count_y; i++) {
		
		const integer_part = integer_part_start_y + i * multiplier;
		const y_world = integer_part * Math.pow(10, exponent);

		draw_line(canvas_left, y_world, canvas_right, y_world, grid_color);

		for (let j = 0; j < sub_grid_count; j++) {
			const sub_grid_y = y_world + grid_spacing * (j + 1) / (sub_grid_count + 1);
			draw_line(canvas_left, sub_grid_y, canvas_right, sub_grid_y, sub_grid_color);
		}

		// Write number next to the grid line
		if (Math.abs(y_world) > 1e-12) {

			const text_y_position = world_to_canvas(0, y_world).y;
			const text = float_to_string(integer_part, exponent);
			
			ctx.fillStyle = text_vertical_color;
			ctx.font = number_text_font;
			ctx.textAlign = "right";

			let text_x = text_fixed_x;

			if (text_fixed_x === -1) {
				ctx.textAlign = "left";
				text_x = 10;
			}

			ctx.textBaseline = "middle";
			ctx.fillText(text, text_x, text_y_position);
		}
	}

	// Draw 0 on bottom left corner:

	let zero_position = world_to_canvas(0, 0);

	let zero_x = zero_position.x + x_offset;
	let zero_y = zero_position.y + y_offset;

	ctx.fillStyle = number_text_color;
	ctx.font = number_text_font;
	ctx.textAlign = "right";
	ctx.textBaseline = "top";
	ctx.fillText("0", zero_x, zero_y);
}

function polygon_is_convex(polygon) {

	let got_negative = false;
	let got_positive = false;

	for (let i = 0; i < polygon.length; i++) {
		const p0 = polygon[i];
		const p1 = polygon[(i + 1) % polygon.length];
		const p2 = polygon[(i + 2) % polygon.length];

		const cross_product = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);

		if (cross_product < 0) {
			got_negative = true;
		} else if (cross_product > 0) {
			got_positive = true;
		}

		if (got_negative && got_positive) {
			return false;
		}
	}

	return true;
}

function draw_solution() {

	for (let polygon of polygons) {
		if (!polygon_is_convex(polygon)) {
			return;
		}
	}

	const style = getComputedStyle(document.documentElement);
	const solution_color = style.getPropertyValue("--solution-color").trim();

	const start = [startPoint.x, startPoint.y];
	const target = [targetPoint.x, targetPoint.y];
	const polys = polygons.map(polygon => polygon.map(vertex => [vertex.x, vertex.y]));

	let path;

	try {
		path = tppSolve(start, target, polys, true);
	}
	catch (e) {
		console.error("Error solving TPP:", e);
		console.error([start, target, polys]);
		return;
	}

	// Draw the path as a series of line segments between the points in the path
	for (let i = 0; i < path.length - 1; i++) {
		const p1 = path[i];
		const p2 = path[i + 1];
		draw_line(p1.x, p1.y, p2.x, p2.y, solution_color, 3);
		draw_point(p1.x, p1.y, 6, solution_color);
	}
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

	draw_solution();

	const startPointColor = style.getPropertyValue("--start-point-color").trim();
	const targetPointColor = style.getPropertyValue("--target-point-color").trim();

	const pointRadius = parseFloat(style.getPropertyValue("--point-radius"));

	draw_point(startPoint.x, startPoint.y, pointRadius, startPointColor);
	draw_point(targetPoint.x, targetPoint.y, pointRadius, targetPointColor);

	// instead of splitting --polygon-colors:
	const polygonColors = Array.from({length: POLYGON_COLOR_COUNT}, (_, i) =>
		style.getPropertyValue(`--polygon-color-${i+1}`).trim()
	);


	for (let i = 0; i < polygons.length; i++) {

		const polygonColor = polygonColors[i % polygonColors.length];

		draw_polygon(polygons[i], polygonColor);

		for (let j = 0; j < polygons[i].length; j++) {
			const vertex = polygons[i][j];
			draw_point(vertex.x, vertex.y, pointRadius * 0.6, polygonColor);
		}

		if (!polygon_is_convex(polygons[i])) {

			ctx.font = "16px sans-serif";
			ctx.fillStyle = "red";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			const center = polygons[i].reduce((acc, p) => ({ x: acc.x + p.x / polygons[i].length, y: acc.y + p.y / polygons[i].length }), { x: 0, y: 0 });
			const canvas_center_point = world_to_canvas(center.x, center.y);

			ctx.fillText("NOT CONVEX", canvas_center_point.x, canvas_center_point.y);
		}

		if (current_polygon % polygons.length === i) {
			draw_polygon_glowing(polygons[i], polygonColor);
			const backgroundColor = style.getPropertyValue("--axis-color").trim();
			draw_polygon_outline_dashed(polygons[i], backgroundColor);
		}
	}

	if (selection_rect !== null) {
		const rect = {
			start: selection_rect.start,
			end: selection_rect.end
		}
		draw_selection_rect(rect, axisColor);
	}

	for (let point of [...selected_points, ...selected_points_total]) {
		// Draw a highlight around the point as a dashed circle
		// that rotates based on the current time, to indicate that it's selected and can be dragged

		const highlight_radius = pointRadius * 1.5;
		const canvas_point = world_to_canvas(point.x, point.y);
		const rotation_speed = 0.002; // radians per millisecond
		const time = performance.now();
		const angle = time * rotation_speed;

		ctx.beginPath();
		ctx.arc(canvas_point.x, canvas_point.y, highlight_radius, angle, angle + Math.PI * 2.0);
		ctx.strokeStyle = axisColor;
		ctx.lineWidth = 2;
		ctx.setLineDash([5, 3]);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

function change_zoom(scale, fixed_canvas_point) {

	let fixed_point_world = canvas_to_world(fixed_canvas_point.x, fixed_canvas_point.y);
	
	camera_center.x = fixed_point_world.x - (fixed_point_world.x - camera_center.x) / scale;
	camera_center.y = fixed_point_world.y - (fixed_point_world.y - camera_center.y) / scale;

	units_to_pixels *= scale;
}

function point_in_polygon(point, polygon) {
	// Ray-casting algorithm to determine if the point is inside the polygon
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].x, yi = polygon[i].y;
		const xj = polygon[j].x, yj = polygon[j].y;

		const intersect = ((yi > point.y) !== (yj > point.y)) &&
			(point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
}

let manualOverride = false;

const mq = window.matchMedia('(prefers-color-scheme: dark)');
let isDark = mq.matches;

function applyTheme() {
	document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

function toggleTheme() {
	isDark = !isDark;
	manualOverride = true;
	applyTheme();
}

mq.addEventListener('change', e => {
	if (!manualOverride) {
		isDark = e.matches;
		applyTheme();
	}
});

applyTheme();


// dragging = [reference_point, reference_current, points_begin_dragged],
// The first element is the reference point that is used to determine the offset of the drag,
// and the second element is an array of points that are being dragged 
// (e.g. a polygon vertex, or the start/target point, or all vertices of a polygon if dragging the whole polygon)
let dragging = [null, []];

const HIT_RADIUS = 15; // pixels

function find_draggable_point(canvas_x, canvas_y, candidates = null) {

	if (candidates === null) {
		
		candidates = [
			startPoint, targetPoint,
		];
	
		for (let i = 0; i < polygons.length; i++) {
			for (let j = 0; j < polygons[i].length; j++) {
				candidates.push(polygons[i][j]);
			}
		}
	}

	for (const candidate of candidates) {
		const cp = world_to_canvas(candidate.x, candidate.y);
		const dx = cp.x - canvas_x;
		const dy = cp.y - canvas_y;

		if (Math.sqrt(dx*dx + dy*dy) <= HIT_RADIUS) {
			return candidate;
		};
	}

	return null;
}

function find_draggable_polygon(canvas_x, canvas_y) {

	for (let i = 0; i < polygons.length; i++) {
		if (point_in_polygon(canvas_to_world(canvas_x, canvas_y), polygons[i])) {
			return i; // Drag the whole polygon
		}
	}

	return -1;
}

function drag_objects(dragging, mouse_position) {

	if (!dragging[0]) return;

	// Check if dragging a point or a whole polygon
	const clamped_mouse = clamp_to_canvas(mouse_position);
	const world = canvas_to_world(clamped_mouse.x, clamped_mouse.y);

	const reference_point = dragging[0];
	const points_being_dragged = dragging[1];

	const relative_movement = {
		x: world.x - reference_point.x,
		y: world.y - reference_point.y
	}

	reference_point.x += relative_movement.x;
	reference_point.y += relative_movement.y;

	for (let point of points_being_dragged) {
		point.x += relative_movement.x;
		point.y += relative_movement.y;
	}
}

function find_selected_points() {

	selected_points = [];

	const candidates = [
		startPoint, targetPoint,
	];

	for (let i = 0; i < polygons.length; i++) {
		for (let j = 0; j < polygons[i].length; j++) {
			candidates.push(polygons[i][j]);
		}
	}

	const rect_left = Math.min(selection_rect.start.x, selection_rect.end.x);
	const rect_right = Math.max(selection_rect.start.x, selection_rect.end.x);
	const rect_top = Math.min(selection_rect.start.y, selection_rect.end.y);
	const rect_bottom = Math.max(selection_rect.start.y, selection_rect.end.y);

	for (const candidate of candidates) {
		const cp = world_to_canvas(candidate.x, candidate.y);
		if (cp.x >= rect_left && cp.x <= rect_right && cp.y >= rect_top && cp.y <= rect_bottom) {
			selected_points.push(candidate);
		}
	}
}

function update_selection_rect(start_canvas, end_canvas) {

	const copy1 = start_canvas ? { x: start_canvas.x, y: start_canvas.y } : { x: selection_rect.start.x, y: selection_rect.start.y };
	const copy2 = end_canvas ? { x: end_canvas.x, y: end_canvas.y } : { x: selection_rect.end.x, y: selection_rect.end.y };

	if (!selection_rect) {
		selection_rect = {
			start: copy1,
			end: copy2
		};
	} else {
		selection_rect.start = copy1;
		selection_rect.end = copy2;
	}

	find_selected_points();
}

function unselect_rect() {
	selected_points_total = new Set([...selected_points_total, ...selected_points]);
	selection_rect = null;
}

window.addEventListener("blur", () => {
	mouse_held = false;
	dragging = null;
});

document.addEventListener("mouseleave", () => {
	mouse_held = false;
	dragging = null;
});

let last_click_time = 0;
let last_click_position = { x: 0, y: 0 };

document.addEventListener("mousedown", (e) => {

	const bounds = canvas.getBoundingClientRect();
	const cx = e.clientX - bounds.left;
	const cy = e.clientY - bounds.top;

	last_click_time = performance.now();
	last_click_position = { x: cx, y: cy };

	const selection_point = find_draggable_point(cx, cy, selected_points_total);

	if (selection_point) {
		dragging = [copy_point(selection_point), selected_points_total];
		return;
	}

	const point = find_draggable_point(cx, cy);

	if (point) {
		dragging = [copy_point(point), [point]];
	} else {
		const polygon_index = find_draggable_polygon(cx, cy);

		if (polygon_index !== -1) {
			dragging = [canvas_to_world(cx, cy), polygons[polygon_index]];
			current_polygon = polygon_index;
		}
	}

	if (!dragging) {
		mouse_held = true;
	}
});

document.addEventListener("mouseup", (e) => {
	
	mouse_held = false;
	
	if (dragging) {
		dragging = null;
		return;
	}

	const is_recent = performance.now() - last_click_time < 300;
	const is_close = Math.hypot(mouse_location.x - last_click_position.x, mouse_location.y - last_click_position.y) < HIT_RADIUS;

	if (is_recent && is_close && polygons.length > 0) {

		const clamped_mouse = clamp_to_canvas(mouse_location);
		const world = canvas_to_world(clamped_mouse.x, clamped_mouse.y);

		const polygon = polygons[current_polygon % polygons.length];

		polygon.push({ x: world.x, y: world.y });
	}
});

document.addEventListener("mousemove", (e) => {

	const bounds = canvas.getBoundingClientRect();
	mouse_location.x = e.clientX - bounds.left;
	mouse_location.y = e.clientY - bounds.top;

	if (e.shiftKey && !selection_rect) {
		update_selection_rect(mouse_location, mouse_location);
	} else if (!e.shiftKey && selection_rect) {
		unselect_rect();
	}
	
	if (selection_rect) {
		update_selection_rect(null, mouse_location);
	}

	if (dragging) {
		drag_objects(dragging, mouse_location);
		
		return;
	}

	if (find_draggable_point(mouse_location.x, mouse_location.y) || find_draggable_polygon(mouse_location.x, mouse_location.y) !== -1) {
		canvas.style.cursor = "move";
	} else {
		canvas.style.cursor = "default";
	}


	if (mouse_held) {
		camera_center.x -= e.movementX / units_to_pixels;
		camera_center.y += e.movementY / units_to_pixels;
		
	}	
});


canvas.addEventListener("wheel", (e) => {

	e.preventDefault();

	let scale = 1 - e.deltaY * scroll_sensitivity;

	change_zoom(scale, mouse_location);
	
	
	
}, { passive: false });

let last_shift_press_time = 0;
let last_shift_press_position = { x: 0, y: 0 };

document.addEventListener("keydown", (e) => {
	if (e.key === "w") {camera_center.y += 0.1;};
	if (e.key === "s") {camera_center.y -= 0.1;};
	if (e.key === "a") {camera_center.x -= 0.1;};
	if (e.key === "d") {camera_center.x += 0.1;};

	if (e.key === "=") {
		change_zoom(1.1, canvas_center());
		
	}

	if (e.key === "-") {
		change_zoom(1 / 1.1, canvas_center());
		
	}

	if (e.key === "t") {
		toggleTheme();
	}

	if (e.key === "Shift") {
		update_selection_rect(mouse_location, mouse_location);
	}

	if (e.key === "ArrowUp") {current_polygon++;}
	if (e.key === "ArrowDown") {current_polygon--;}

	if (e.key === "Backspace" || e.key === "Delete" || e.key === "x") {

		console.log("Deleting points:", selected_points_total);
		if (selected_points_total.size > 0) {
			// Check if all vertices are in selected_points_total, if so, remove the whole polygon
			polygons = polygons.filter(polygon => !polygon.every(vertex => selected_points_total.has(vertex)));

			for (let point of selected_points_total) {
				for (let i = 0; i < polygons.length; i++) {

					const polygon = polygons[i];

					if (polygon.length <= 3) {
						continue;
					}

					const index = polygons[i].indexOf(point);
					if (index !== -1) {
						polygons[i] = polygons[i].filter(p => p !== point);
						break;
					}
				}
			}

			selected_points_total = new Set();
			selected_points = [];
		}
	}
});

document.addEventListener("keyup", (e) => {
	if (e.key === "Shift") {
		// capture points here before clearing
		unselect_rect();

		const is_recent = last_shift_press_time && (performance.now() - last_shift_press_time < 300);
		const is_close = Math.hypot(mouse_location.x - last_shift_press_position.x, mouse_location.y - last_shift_press_position.y) < HIT_RADIUS;

		if (is_recent && is_close) {
			// Clear total selection if shift was just tapped
			selected_points_total = new Set(); 
			selected_points = [];
		}

		last_shift_press_time = performance.now();
		last_shift_press_position = { x: mouse_location.x, y: mouse_location.y };
	}
});

function loop() {
	draw();
	requestAnimationFrame(loop);
}

requestAnimationFrame(loop);