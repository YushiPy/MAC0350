
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
let units_to_pixels = 100; // 1 unit = `unit_to_pixels` pixels

let mouse_held = false; // Left mouse button is held down or not
let mouse_location = { x: 0, y: 0 }; // Mouse location in screen coordinates (pixels)

let scroll_sensitivity = 0.0005; // How much the camera zooms in/out when scrolling

// Grid lines must be at least `min_grid_spacing` pixels apart, 
// we adjust the number of grid lines based on the zoom level to achieve this
let min_grid_spacing = 83; 

let points = [
	{ x: 0, y: 0 },
	{ x: 1, y: 0 },
	{ x: 0, y: 1 },
	{ x: 1, y: 2 },
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

function draw_line(x1, y1, x2, y2, color = "black") {

	ctx.beginPath();

	[x1, y1] = fix_coordinates(x1, y1);
	[x2, y2] = fix_coordinates(x2, y2);

	const p1 = world_to_canvas(x1, y1);
	const p2 = world_to_canvas(x2, y2);

	ctx.moveTo(p1.x, p1.y);
	ctx.lineTo(p2.x, p2.y);
	ctx.strokeStyle = color;
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

	let x_start = Math.floor((camera_center.x - half_width) / grid_scale) * grid_scale;
	
	const canvas_right = camera_center.x + half_width;
	const canvas_left = camera_center.x - half_width;
	const canvas_top = camera_center.y + half_height;
	const canvas_bottom = camera_center.y - half_height;

	while (x_start < camera_center.x + half_width) {

		draw_line(x_start, canvas_bottom, x_start, canvas_top, grid_color);

		for (let i = 0; i < sub_grid_count; i++) {
			const sub_grid_x = x_start + grid_scale * (i + 1) / (sub_grid_count + 1);
			draw_line(sub_grid_x, canvas_bottom, sub_grid_x, canvas_top, sub_grid_color);
		}

		x_start += grid_scale;
	}
	
	let y_start = Math.floor((camera_center.y - half_height) / grid_scale) * grid_scale;
	
	while (y_start < camera_center.y + half_height) {

		draw_line(canvas_left, y_start, canvas_right, y_start, grid_color);

		for (let i = 0; i < sub_grid_count; i++) {
			const sub_grid_y = y_start + grid_scale * (i + 1) / (sub_grid_count + 1);
			draw_line(canvas_left, sub_grid_y, canvas_right, sub_grid_y, sub_grid_color);
		}

		y_start += grid_scale;
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
	draw_line(0, Number.NEGATIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
	draw_line(Number.NEGATIVE_INFINITY, 0, Number.POSITIVE_INFINITY, 0, axisColor);

	for (const point of points) {

		const x = point.x;
		const y = point.y;

		ctx.beginPath();
		ctx.arc(
			canvas.offsetWidth / 2 + (x - camera_center.x) * units_to_pixels,
			canvas.offsetHeight / 2 - (y - camera_center.y) * units_to_pixels,
			5, 0, Math.PI * 2
		);

		ctx.fillStyle = "red";
		ctx.fill();
	}
}


function change_zoom(scale, fixed_canvas_point) {

	let fixed_point_world = canvas_to_world(fixed_canvas_point.x, fixed_canvas_point.y);
	
	camera_center.x = fixed_point_world.x - (fixed_point_world.x - camera_center.x) / scale;
	camera_center.y = fixed_point_world.y - (fixed_point_world.y - camera_center.y) / scale;

	units_to_pixels *= scale;
}

canvas.addEventListener("mousedown", () => mouse_held = true);
canvas.addEventListener("mouseup", () => mouse_held = false);

canvas.addEventListener("mousemove", (e) => {

	let bounds = canvas.getBoundingClientRect();

	mouse_location.x = e.clientX - bounds.left;
	mouse_location.y = e.clientY - bounds.top;

	if (!mouse_held) {
		return;
	}

	const relx = e.movementX / units_to_pixels;
	const rely = -e.movementY / units_to_pixels;

	camera_center.x -= relx;
	camera_center.y -= rely;

	draw();
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
});
