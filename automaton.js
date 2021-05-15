(function(automaton, undefined) {

	// cross-browser support for requestAnimationFrame and cancelAnimationFrame
	const requestAnimFrame = window.requestAnimationFrame
		|| window.webkitRequestAnimationFrame
		|| window.msRequestAnimationFrame
		|| window.mozRequestAnimationFrame
		|| function(callback) { return window.setTimeout(callback, 1000 / 60); };
	const cancelAnimFrame = window.cancelAnimationFrame
		|| window.webkitCancelRequestAnimationFrame || window.webkitCancelAnimationFrame
		|| window.msCancelRequestAnimationFrame || window.msCancelAnimationFrame
		|| window.mozCancelRequestAnimationFrame || window.mozCancelAnimationFrame
		|| window.oCancelRequestAnimationFrame || window.oCancelAnimationFrame
		|| function(id) { clearTimeout(id); };

	const clamp = function(value, min, max) {
		if(value < min) {
			return min;
		} else if(value > max) {
			return max;
		}
		return value;
	}

	const NeighborType = {
		DIRECT : 0,
		CORNER : 1
	}

	class Settings {
		constructor(guiSettings) {
			this.blockSize = Math.floor(guiSettings.blockSize);
			this.numColors = Math.floor(guiSettings.numColors) * 2 + 1;
			this.initialPopulation = clamp(guiSettings.initialPopulation, 0.0, 1.0);
			this.apply(guiSettings);
		}
		apply(guiSettings) {
			this.borders = { "W": null, "E": -1, "U": undefined }[guiSettings.borders];
			this.neighbors = { "D": NeighborType.DIRECT, "DC": NeighborType.DIRECT|NeighborType.CORNER }[guiSettings.neighbors];
			this.initialCellLife = Math.floor(guiSettings.initialCellLife);
			this.running = guiSettings.running === true;
			this.speed = clamp(guiSettings.speed, 0.001, 2.0);
		}
	}

	class Cell {
		set(colorId, life) {
			this.colorId = colorId;
			this.life = life || settings.initialCellLife;
		}
		copy(cell) {
			this.colorId = cell.colorId;
			this.life = cell.life;
		}
		constructor(colorId, life) {
			this.set(colorId, life);
		}
	}

	let settings;

	const changedCells = new Map();
	changedCells.addCell = function(x, y, colorId) {
		const positions = changedCells.get(colorId) || [];
		positions.push({ x : x, y : y });
		changedCells.set(colorId, positions);
	}

	let data;
	let oldData;
	let width;
	let height;

	let canvas;
	let context;
	let bufferCanvas;
	let bufferContext;

	let timeUntilUpdate;
	let animFrameReqId;
	let lastFrameTime;

	function initCanvas() {
		bufferCanvas = document.createElement("canvas");

		[canvas, bufferCanvas].forEach(can => {
			can.width = window.innerWidth;
			can.height = window.innerHeight;
		});

		canvas.addEventListener("mousedown", mouseHandler, false);
		canvas.addEventListener("mousemove", mouseHandler, false);
		canvas.addEventListener("mouseup", mouseHandler, false);
		canvas.addEventListener("wheel", mouseHandler, false);

		context = canvas.getContext("2d", { alpha: false });
		bufferContext = bufferCanvas.getContext("2d", { alpha: false });

		[context, bufferContext].forEach(ctx => {
			ctx.msImageSmoothingEnabled = false;
			ctx.imageSmoothingEnabled = false;
		});
	}

	const mouseHandler = {
		mouseDown : false,
		mouseChangedCells : new Array(),
		brushSize : 1,

		handleEvent : function(event) {
			if(event.type == "mousedown" && event.buttons == 1) {
				mouseHandler.handleCellClick(event);
				mouseHandler.mouseDown = true;
			} else if(event.type == "mousemove" && mouseHandler.mouseDown) {
				mouseHandler.handleCellClick(event);
			} else if(event.type == "mouseup" && event.buttons == 0) {
				mouseHandler.mouseDown = false;
				mouseHandler.mouseChangedCells = new Array();
			} else if(event.type == "wheel" && event.deltaY != 0) {
				mouseHandler.brushSize = clamp(mouseHandler.brushSize + (event.deltaY > 0 ? -2 : 2), 1, 101);
			}
		},
		handleCellClick : function(event) {
			const baseX = Math.floor(event.pageX / settings.blockSize);
			const baseY = Math.floor(event.pageY / settings.blockSize);
			for(let offsetY = -(mouseHandler.brushSize-1)/2; offsetY <= (mouseHandler.brushSize-1)/2; offsetY++) {
				for(let offsetX = -(mouseHandler.brushSize-1)/2; offsetX <= (mouseHandler.brushSize-1)/2; offsetX++) {
					const x = baseX + offsetX;
					const y = baseY + offsetY;
					if(x < 0 || y < 0 || x >= width || y >= height || mouseHandler.mouseChangedCells.find(cell => cell.x == x && cell.y == y)) {
						continue;
					}
					if(event.shiftKey) {
						data[y][x].set(-1);
					} else {
						data[y][x].set((data[y][x].colorId + 1) % settings.numColors);
					}
					changedCells.addCell(x, y, data[y][x].colorId);
					mouseHandler.mouseChangedCells.push({ x : x, y : y });
				}
			}
		}
	}

	function initData() {
		width = Math.floor(canvas.width / settings.blockSize);
		height = Math.floor(canvas.height / settings.blockSize);
		data = new Array(height);
		oldData = new Array(height);
		changedCells.clear();
		for(let y = 0; y < height; y++) {
			data[y] = new Array(width);
			oldData[y] = new Array(width);
			for(let x = 0; x < width; x++) {
				if(Math.random() < settings.initialPopulation) {
					data[y][x] = new Cell(Math.floor(Math.random() * settings.numColors));
				} else {
					data[y][x] = new Cell(-1);
				}
				oldData[y][x] = new Cell(-1);
				changedCells.addCell(x, y, data[y][x].colorId);
			}
		}
		timeUntilUpdate = 0;
		lastFrameTime = undefined;
	}

	function getNeighbor(type, data, x, y) {
		if((settings.neighbors & type) !== type) {
			return undefined;
		}
		if(x < 0) {
			if(settings.borders === null) {
				x += width;
			} else {
				return settings.borders;
			}
		}
		if(x >= width) {
			if(settings.borders === null) {
				x -= width;
			} else {
				return settings.borders;
			}
		}
		if(y < 0) {
			if(settings.borders === null) {
				y += height;
			} else {
				return settings.borders;
			}
		}
		if(y >= height) {
			if(settings.borders === null) {
				y -= height;
			} else {
				return settings.borders;
			}
		}
		return data[y][x].colorId;
	}

	function calculateIndividualScore(own, other) {
		if(own === other) {
			return 0;
		}
		if(own === -1 || own === undefined) {
			// empty loses against anything else
			return -1;
		}
		if(other === -1 || other === undefined) {
			// anything non-empty wins against empty
			return 1;
		}
		// generalized rock-paper-scissors rules:
		// if own and other have the same parity, the larger one wins
		// if they have different parity, the smaller one wins
		// https://math.stackexchange.com/a/3229687
		if(own % 2 == other % 2) {
			return own > other ? 1 : -1;
		}
		return own < other ? 1 : -1;
	}

	function calculateCell(current, top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight) {
		let totalScore = 0;
		const allScores = new Map();
		for(let neighbor of [top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight]) {
			if(neighbor === undefined) {
				continue;
			}
			const score = calculateIndividualScore(current.colorId, neighbor);
			totalScore += score;
			allScores.set(neighbor, (allScores.get(neighbor) || 0) + score);
		}
		if(totalScore >= 0) {
			return current;
		}
		let maxNeighbor = undefined;
		let numWithMax = 0;
		allScores.forEach((neighborScore, neighbor) => {
			if(neighborScore < 0) {
				const score = calculateIndividualScore(neighbor, maxNeighbor);
				if(score > 0) {
					maxNeighbor = neighbor;
					numWithMax = 1;
				} else if(score == 0) {
					numWithMax++;
				}
			}
		});
		if(maxNeighbor !== undefined && numWithMax == 1) {
			current.life += allScores.get(maxNeighbor); // the score is negative
			if(current.life <= 0) {
				return new Cell(maxNeighbor);
			} else {
				return current;
			}
		}
		return new Cell(-1);
	}

	automaton.performStep = function() {
		for(let y = 0; y < height; y++) {
			for(let x = 0; x < width; x++) {
				oldData[y][x].copy(data[y][x]);
			}
		}
		for(let y = 0; y < height; y++) {
			for(let x = 0; x < width; x++) {
				data[y][x].copy(calculateCell(
					oldData[y][x],
					getNeighbor(NeighborType.DIRECT, oldData, x, y - 1),
					getNeighbor(NeighborType.DIRECT, oldData, x, y + 1),
					getNeighbor(NeighborType.DIRECT, oldData, x - 1, y),
					getNeighbor(NeighborType.DIRECT, oldData, x + 1, y),
					getNeighbor(NeighborType.CORNER, oldData, x - 1, y - 1),
					getNeighbor(NeighborType.CORNER, oldData, x + 1, y - 1),
					getNeighbor(NeighborType.CORNER, oldData, x - 1, y + 1),
					getNeighbor(NeighborType.CORNER, oldData, x + 1, y + 1)));
				if(data[y][x].colorId != oldData[y][x].colorId) {
					changedCells.addCell(x, y, data[y][x].colorId);
				}
			}
		}
	}

	function selectColor(colorId) {
		if(colorId < 0) {
			return "black";
		}
		return "hsl(" + (colorId * 137.508) + ", 100%, 50%)"; // golden angle approximation
	}

	function redrawChangedCells() {
		const blockSize = settings.blockSize;
		changedCells.forEach((cells, colorId) => {
			bufferContext.fillStyle = selectColor(colorId);
			cells.forEach(cell =>
				bufferContext.fillRect(
					cell.x * blockSize,
					cell.y * blockSize,
					blockSize,
					blockSize)
			);
		});
		changedCells.clear();
	}

	function updateAndDrawFrame(timestamp) {
		if(settings.running && !mouseHandler.mouseDown) {
			if(lastFrameTime === undefined) {
				lastFrameTime = timestamp;
			}
			const millisPerFrame = 1000 / 30.0;
			timeUntilUpdate += clamp(timestamp - lastFrameTime, 0.0, millisPerFrame) / millisPerFrame * settings.speed;
			while(timeUntilUpdate >= 1.0) {
				automaton.performStep();
				timeUntilUpdate -= 1.0;
			}
			lastFrameTime = timestamp;
		}
		redrawChangedCells();
		context.drawImage(bufferCanvas, 0, 0);
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	}

	automaton.setCanvas = function(canvasElement) {
		canvas = canvasElement;
	}

	automaton.start = function(guiSettings) {
		settings = new Settings(guiSettings);
		initCanvas();
		initData();

		if(animFrameReqId !== undefined) {
			cancelAnimFrame(animFrameReqId);
		}
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	}

	automaton.applySettings = function(guiSettings) {
		settings.apply(guiSettings);
	}
}(window.automaton = window.automaton || {}));