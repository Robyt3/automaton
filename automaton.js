(function(automaton, $, undefined) {

	// cross-browser support for requestAnimationFrame and cancelAnimationFrame
	var requestAnimFrame = window.requestAnimationFrame
		|| window.webkitRequestAnimationFrame
		|| window.msRequestAnimationFrame
		|| window.mozRequestAnimationFrame
		|| function(callback) { return window.setTimeout(callback, 1000 / 60); };
	var cancelAnimFrame = window.cancelAnimationFrame
		|| window.webkitCancelRequestAnimationFrame
		|| window.webkitCancelAnimationFrame
		|| window.mozCancelRequestAnimationFrame || window.mozCancelAnimationFrame
		|| window.oCancelRequestAnimationFrame || window.oCancelAnimationFrame
		|| window.msCancelRequestAnimationFrame || window.msCancelAnimationFrame
		|| function(id) { clearTimeout(id); };

	var Settings = function(guiSettings) {
		this.blockSize = Math.floor(guiSettings.blockSize);
		this.numColors = guiSettings.numColors * 2 + 1;
		this.borders = { "W": null, "E": -1, "U": undefined }[guiSettings.borders];
		this.initialPopulation = guiSettings.initialPopulation;
		this.neighbors = guiSettings.neighbors;
		this.initialCellLife = Math.floor(guiSettings.initialCellLife);
	}

	var settings;
	var running;
	var speed;
	var timeUntilUpdate;
	var animFrameReqId;

	var changedCells = new Map();
	changedCells.addCell = function(x, y, colorId) {
		var positions = changedCells.get(colorId) || [];
		positions.push({ x : x, y : y });
		changedCells.set(colorId, positions);
	}

	var Cell = function(colorId, life) {
		this.colorId = colorId;
		this.life = life == undefined ? settings.initialCellLife : life;
	}

	var data;
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

		canvas.addEventListener('mousedown', mouseHandler, false);
		canvas.addEventListener('mousemove', mouseHandler, false);
		canvas.addEventListener('mouseup', mouseHandler, false);
		canvas.addEventListener('wheel', mouseHandler, false);

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
			if(event.type == 'mousedown' && event.buttons == 1) {
				mouseHandler.handleCellClick(event);
				mouseHandler.mouseDown = true;
			} else if(event.type == 'mousemove' && mouseHandler.mouseDown) {
				mouseHandler.handleCellClick(event);
			} else if(event.type == 'mouseup' && event.buttons == 0) {
				mouseHandler.mouseDown = false;
				mouseHandler.mouseChangedCells = new Array();
			} else if(event.type == 'wheel' && event.deltaY != 0) {
				mouseHandler.brushSize += event.deltaY > 0 ? -2 : 2;
				if(mouseHandler.brushSize < 1) {
					mouseHandler.brushSize = 1;
				} else if(mouseHandler.brushSize > 101) {
					mouseHandler.brushSize = 101;
				}
			}
		},
		handleCellClick : function(event) {
			var baseX = Math.floor(event.pageX / settings.blockSize);
			var baseY = Math.floor(event.pageY / settings.blockSize);
			for(var offsetY = -(mouseHandler.brushSize-1)/2; offsetY <= (mouseHandler.brushSize-1)/2; offsetY++) {
				for(var offsetX = -(mouseHandler.brushSize-1)/2; offsetX <= (mouseHandler.brushSize-1)/2; offsetX++) {
					var x = baseX + offsetX;
					var y = baseY + offsetY;
					if(x < 0 || y < 0 || x >= width || y >= height || mouseHandler.mouseChangedCells.find(cell => cell.x == x && cell.y == y)) {
						continue;
					}
					if(event.shiftKey) {
						data[y][x] = new Cell(-1);
					} else {
						data[y][x] = new Cell((data[y][x].colorId + 1) % settings.numColors);
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
		changedCells.clear();
		for(var y = 0; y < height; y++) {
			data[y] = new Array(width);
			for(var x = 0; x < width; x++) {
				if(Math.random() < settings.initialPopulation) {
					data[y][x] = new Cell(Math.floor(Math.random() * settings.numColors));
				} else {
					data[y][x] = new Cell(-1);
				}
				changedCells.addCell(x, y, data[y][x].colorId);
			}
		}
	}

	function getNeighbor(type, data, x, y) {
		if(settings.neighbors.indexOf(type) == -1) {
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

	function calculateCell(current, top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight) {
		function calculateIndividualScore(own, other) {
			if(own == other) {
				return 0;
			}
			if(own == -1) {
				// empty loses against anything else
				return -1;
			}
			if(other == -1) {
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

		var totalScore = 0;
		var allScores = new Map();
		[top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight]
			.filter(neighbor => neighbor != undefined)
			.forEach(neighbor => {
				var score = calculateIndividualScore(current.colorId, neighbor);
				totalScore += score;
				allScores.set(neighbor, (allScores.get(neighbor) || 0) + score);
			});
		if(totalScore >= 0) {
			return current;
		}
		var maxKey = undefined;
		var numWithMax = 0;
		allScores.forEach((value, key) => {
			if(key != -1 && calculateIndividualScore(current.colorId, key) < 0) {
				var score = calculateIndividualScore(key, maxKey);
				if(maxKey == undefined || score > 0) {
					maxKey = key;
					numWithMax = 1;
				} else if(score == 0) {
					numWithMax++;
				}
			}
		});
		if(maxKey != undefined && numWithMax == 1) {
			current.life += allScores.get(maxKey); // the score is negative
			if(current.life <= 0) {
				return new Cell(maxKey);
			} else {
				return current;
			}
		}
		return new Cell(-1);
	}

	automaton.performStep = function() {
		var oldData = data.map(arr => arr.map(cell => new Cell(cell.colorId, cell.life)));
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
				data[y][x] = calculateCell(
					oldData[y][x],
					getNeighbor("D", oldData, x, y - 1),
					getNeighbor("D", oldData, x, y + 1),
					getNeighbor("D", oldData, x - 1, y),
					getNeighbor("D", oldData, x + 1, y),
					getNeighbor("C", oldData, x - 1, y - 1),
					getNeighbor("C", oldData, x + 1, y - 1),
					getNeighbor("C", oldData, x - 1, y + 1),
					getNeighbor("C", oldData, x + 1, y + 1));
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
		changedCells.forEach((cells, colorId) => {
			bufferContext.fillStyle = selectColor(colorId);
			cells.forEach(cell =>
				bufferContext.fillRect(
					cell.x * settings.blockSize,
					cell.y * settings.blockSize,
					settings.blockSize,
					settings.blockSize)
			);
		});
		changedCells.clear();
	}

	function drawBuffer() {
		context.fillStyle = "black";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(bufferCanvas, 0, 0);
	}

	function updateAndDrawFrame() {
		if(running && !mouseHandler.mouseDown) {
			timeUntilUpdate += speed;
			while(timeUntilUpdate >= 1.0) {
				automaton.performStep();
				timeUntilUpdate -= 1.0;
			}
		}
		redrawChangedCells();
		drawBuffer();
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	};

	automaton.start = function(guiSettings) {
		settings = new Settings(guiSettings);
		automaton.setSpeed(guiSettings.speed);
		automaton.setRunning(guiSettings.running);
		timeUntilUpdate = 0;

		initCanvas();
		initData();

		if(animFrameReqId != undefined) {
			cancelAnimFrame(animFrameReqId);
		}
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	}

	automaton.setSpeed = function(_speed) {
		if(_speed < 0.001) {
			speed = 0.001;
		} else if(_speed > 2) {
			speed = 2;
		} else {
			speed = _speed;
		}
	}

	automaton.setRunning = function(_running) {
		running = _running;
	}

	automaton.isRunning = function() {
		return running;
	}
}(window.automaton = window.automaton || {}, jQuery));