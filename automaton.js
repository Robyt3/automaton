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

	var Settings = function(blockSize, numColors, borderWrap, initialPopulation, neighbors) {
		this.blockSize = blockSize;
		this.numColors = numColors * 2 + 1;
		this.borderWrap = borderWrap;
		this.initialPopulation = initialPopulation;
		this.neighbors = neighbors;
	}

	var settings;
	var speed;
	var timeUntilUpdate = 0;
	var running;
	var changedCells;
	var animFrameReqId;

	var data;
	var width;
	var height;

	var canvas;
	var context;
	var bufferCanvas;
	var bufferContext;

	function initCanvas() {
		canvas = document.getElementById("canvas");
		canvas.mozOpaque = true;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		context = canvas.getContext("2d");
		canvas.addEventListener('mousedown', mouseHandler, false);
		canvas.addEventListener('mousemove', mouseHandler, false);
		canvas.addEventListener('mouseup', mouseHandler, false);
		canvas.addEventListener('wheel', mouseHandler, false);

		bufferCanvas = document.createElement("canvas");
		bufferCanvas.width = canvas.width;
		bufferCanvas.height = canvas.height;
		bufferContext = bufferCanvas.getContext("2d");
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
						data[y][x] = -1;
					} else {
						data[y][x] = (data[y][x] + 1) % settings.numColors;
					}
					changedCells.push({ x : x, y : y });
					mouseHandler.mouseChangedCells.push({ x : x, y : y });
				}
			}
		}
	}

	function initData() {
		width = Math.floor(canvas.width / settings.blockSize);
		height = Math.floor(canvas.height / settings.blockSize);

		data = new Array(height);
		changedCells = new Array();
		for(var y = 0; y < height; y++) {
			data[y] = new Array(width);
			for(var x = 0; x < width; x++) {
				if(Math.random() < settings.initialPopulation) {
					data[y][x] = Math.floor(Math.random() * settings.numColors);
				} else {
					data[y][x] = -1;
				}
				changedCells.push({ x : x, y : y });
			}
		}
	}

	function getCell(data, x, y) {
		if(x < 0) {
			if(settings.borderWrap) {
				x += width;
			} else {
				return -1;
			}
		}
		if(x >= width) {
			if(settings.borderWrap) {
				x -= width;
			} else {
				return -1;
			}
		}
		if(y < 0) {
			if(settings.borderWrap) {
				y += height;
			} else {
				return -1;
			}
		}
		if(y >= height) {
			if(settings.borderWrap) {
				y -= height;
			} else {
				return -1;
			}
		}
		return data[y][x];
	}

	function calculateBattleScore(own, other) {
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

	function calculateNewColor(current, top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight) {
		var totalScore = 0;
		var allScores = new Map();
		var neighbors = [top, bottom, left, right];
		if(settings.neighbors == "DC") {
			neighbors = neighbors.concat([topLeft, topRight, bottomLeft, bottomRight]);
		}
		neighbors.forEach(neighbor => {
			var score = calculateBattleScore(current, neighbor);
			totalScore += score;
			allScores.set(neighbor, (allScores.get(neighbor) || 0) + score);
		});
		if(totalScore >= 0) {
			return current;
		}
		var maxKey = undefined;
		var numWithMax = 0;
		allScores.forEach((value, key) => {
			if(key != -1 && calculateBattleScore(current, key) < 0) {
				var score = calculateBattleScore(key, maxKey);
				if(maxKey == undefined || score > 0) {
					maxKey = key;
					numWithMax = 1;
				} else if(score == 0) {
					numWithMax++;
				}
			}
		});
		if(maxKey != undefined && numWithMax == 1) {
			return maxKey;
		}
		return -1;
	}

	function performStepImpl() {
		var oldData = data.map(arr => arr.slice());
		for(var y = 0; y < height; y++) {
			for(var x = 0; x < width; x++) {
				var oldColor = data[y][x];
				data[y][x] = calculateNewColor(
					getCell(oldData, x, y),
					getCell(oldData, x, y - 1),
					getCell(oldData, x, y + 1),
					getCell(oldData, x - 1, y),
					getCell(oldData, x + 1, y),
					getCell(oldData, x - 1, y - 1),
					getCell(oldData, x + 1, y - 1),
					getCell(oldData, x - 1, y + 1),
					getCell(oldData, x + 1, y + 1));
				if(data[y][x] != oldColor) {
					changedCells.push({ x : x, y : y });
				}
			}
		}
	}

	function selectColor(value) {
		if(value < 0) {
			return "black";
		}
		return "hsl(" + (value * 137.508) + ", 100%, 50%)"; // golden angle approximation
	}

	function redrawChangedCells() {
		changedCells.forEach(cell => {
			bufferContext.fillStyle = selectColor(data[cell.y][cell.x]);
			bufferContext.fillRect(
				cell.x * settings.blockSize,
				cell.y * settings.blockSize,
				settings.blockSize,
				settings.blockSize);
		});
		changedCells = new Array();
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
				performStepImpl();
				timeUntilUpdate -= 1.0;
			}
		}
		redrawChangedCells();
		drawBuffer();
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	};

	automaton.start = function(blockSize, numColors, borderWrap, initialPopulation, neighbors, _running, _speed) {
		settings = new Settings(blockSize, numColors, borderWrap, initialPopulation, neighbors);
		automaton.setSpeed(_speed);
		automaton.setRunning(_running);

		initCanvas();
		initData();

		if(animFrameReqId != undefined) {
			cancelAnimFrame(animFrameReqId);
		}
		animFrameReqId = requestAnimFrame(updateAndDrawFrame);
	}

	automaton.performStep = function() {
		if(running) {
			return;
		}
		performStepImpl();
		redrawChangedCells();
		drawBuffer();
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