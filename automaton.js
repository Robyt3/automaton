(function(automaton, undefined) {

	// cross-browser support for requestAnimationFrame and cancelAnimationFrame
	var requestAnimFrame = window.requestAnimationFrame
		|| window.webkitRequestAnimationFrame
		|| window.msRequestAnimationFrame
		|| window.mozRequestAnimationFrame
		|| function(callback) { return window.setTimeout(callback, 1000 / 60); };
	var cancelAnimFrame = window.cancelAnimationFrame
		|| window.webkitCancelRequestAnimationFrame || window.webkitCancelAnimationFrame
		|| window.msCancelRequestAnimationFrame || window.msCancelAnimationFrame
		|| window.mozCancelRequestAnimationFrame || window.mozCancelAnimationFrame
		|| window.oCancelRequestAnimationFrame || window.oCancelAnimationFrame
		|| function(id) { clearTimeout(id); };

	const NeighborType = {
		DIRECT : 0,
		CORNER : 1
	}

	class Settings {
		constructor(guiSettings) {
			this.blockSize = Math.floor(guiSettings.blockSize);
			this.numColors = guiSettings.numColors * 2 + 1;
			this.initialPopulation = Math.min(Math.max(guiSettings.initialPopulation, 0.0), 1.0);
			this.apply(guiSettings);
		}
		apply(guiSettings) {
			this.borders = { "W": null, "E": -1, "U": undefined }[guiSettings.borders];
			this.neighbors = { "D": NeighborType.DIRECT, "DC": NeighborType.DIRECT|NeighborType.CORNER }[guiSettings.neighbors];
			this.initialCellLife = Math.floor(guiSettings.initialCellLife);
			this.running = guiSettings.running === true;
			this.speed = Math.min(Math.max(guiSettings.speed, 0.001), 2.0);
		}
	}

	var settings;
	var timeUntilUpdate;
	var animFrameReqId;
	var lastFrameTime;

	var changedCells = new Map();
	changedCells.addCell = function(x, y, colorId) {
		var positions = changedCells.get(colorId) || [];
		positions.push({ x : x, y : y });
		changedCells.set(colorId, positions);
	}

	class Cell {
		set(colorId, life) {
			this.colorId = colorId;
			this.life = life == undefined ? settings.initialCellLife : life;
		}
		copy(cell) {
			this.colorId = cell.colorId;
			this.life = cell.life;
		}
		constructor(colorId, life) {
			this.set(colorId, life);
		}
	}

	var data;
	var oldData;
	var width;
	var height;

	var canvas;
	var context;
	var bufferCanvas;
	var bufferContext;

	function initCanvas() {
		canvas = document.getElementById("canvas");
		bufferCanvas = document.createElement("canvas");

		[canvas, bufferCanvas].forEach(can => {
			can.mozOpaque = true;
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
			ctx.webkitImageSmoothingEnabled = false;
			ctx.mozImageSmoothingEnabled = false;
			ctx.imageSmoothingEnabled = false;
		});
	}

	var mouseHandler = {
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
				mouseHandler.brushSize += event.deltaY > 0 ? -2 : 2;
				if(mouseHandler.brushSize < 1) {
					mouseHandler.brushSize = 1;
				} else if(mouseHandler.brushSize > 101) {
					mouseHandler.brushSize = 101;
				}
			}
		},
		handleCellClick : function(event) {
			const baseX = Math.floor(event.pageX / settings.blockSize);
			const baseY = Math.floor(event.pageY / settings.blockSize);
			for(var offsetY = -(mouseHandler.brushSize-1)/2; offsetY <= (mouseHandler.brushSize-1)/2; offsetY++) {
				for(var offsetX = -(mouseHandler.brushSize-1)/2; offsetX <= (mouseHandler.brushSize-1)/2; offsetX++) {
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
		for(var y = 0; y < height; y++) {
			data[y] = new Array(width);
			oldData[y] = new Array(width);
			for(var x = 0; x < width; x++) {
				if(Math.random() < settings.initialPopulation) {
					data[y][x] = new Cell(Math.floor(Math.random() * settings.numColors));
				} else {
					data[y][x] = new Cell(-1);
				}
				oldData[y][x] = new Cell(-1);
				changedCells.addCell(x, y, data[y][x].colorId);
			}
		}
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
		var totalScore = 0;
		var allScores = new Map();
		for(let neighbor of [top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight]) {
			if(neighbor === undefined) {
				continue;
			}
			var score = calculateIndividualScore(current.colorId, neighbor);
			totalScore += score;
			allScores.set(neighbor, (allScores.get(neighbor) || 0) + score);
		}
		if(totalScore >= 0) {
			return current;
		}
		var maxNeighbor = undefined;
		var numWithMax = 0;
		allScores.forEach((neighborScore, neighbor) => {
			if(neighborScore < 0) {
				var score = calculateIndividualScore(neighbor, maxNeighbor);
				if(score > 0) {
					maxNeighbor = neighbor;
					numWithMax = 1;
				} else if(score == 0) {
					numWithMax++;
				}
			}
		});
		if(maxNeighbor != undefined && numWithMax == 1) {
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
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
				oldData[y][x].copy(data[y][x]);
			}
		}
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
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

	function drawBuffer() {
		context.fillStyle = "black";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(bufferCanvas, 0, 0);
	}

	function updateAndDrawFrame(timestamp) {
		if(settings.running && !mouseHandler.mouseDown) {
			if(lastFrameTime === undefined) {
				lastFrameTime = timestamp;
			}
			const baseFPS = 30.0;
			timeUntilUpdate += Math.min(Math.max(timestamp - lastFrameTime, 0.0), 1000/baseFPS) / (1000/baseFPS) * settings.speed;
			while(timeUntilUpdate >= 1.0) {
				automaton.performStep();
				timeUntilUpdate -= 1.0;
			}
			lastFrameTime = timestamp;
		}
		redrawChangedCells();
		drawBuffer();
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	}

	automaton.start = function(guiSettings) {
		settings = new Settings(guiSettings);
		timeUntilUpdate = 0;

		initCanvas();
		initData();

		if(animFrameReqId != undefined) {
			cancelAnimFrame(animFrameReqId);
		}
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	}

	automaton.applySettings = function(guiSettings) {
		settings.apply(guiSettings);
	}
}(window.automaton = window.automaton || {}));