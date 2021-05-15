(function() {

	const settings = {
		running : true,
		speed : 1,
		performStep : automaton.performStep,
		restart : function() {
			automaton.start(settings);
		},
		blockSize : 10,
		initialPopulation : 0.01,
		initialCellLife : 1,
		numColors : 1,
		borders : "W",
		neighbors : "D",
		viewSource : function() {
			window.location.href = "https://github.com/Robyt3/automaton";
		},
		apply : function() {
			automaton.applySettings(settings);
		}
	};

	const gui = new dat.GUI({ width: 400 });

	const folderGeneration = gui.addFolder("Generation");
	folderGeneration.add(settings, "running").name("Running [Space]").listen().onChange(settings.apply);
	folderGeneration.add(settings, "speed").min(0.001).max(2).step(0.001).name("Speed [+/-]").listen().onChange(settings.apply);
	folderGeneration.add(settings, "performStep").name("Perform single step [S]");
	folderGeneration.add(settings, "restart").name("Start/Restart generation [R]");
	folderGeneration.open();

	const folderSettings = gui.addFolder("Settings");
	folderSettings.add(settings, "blockSize").min(5).max(100).step(1).name("Cell size (pixels)*");
	folderSettings.add(settings, "initialPopulation").min(0).max(1.0).step(0.001).name("Initial population*");
	folderSettings.add(settings, "initialCellLife").min(1).max(50).step(1).name("Initial cell life").onChange(settings.apply);
	// TODO: Number of colors is weird because step size 2 does not work correctly with odd minimum value to enforce odd numbers
	folderSettings.add(settings, "numColors").min(1).max(25).step(1).name("Number of colors (2 * N + 1)*");
	folderSettings.add(settings, "borders", { "Wrap around": "W", "Empty": "E", "Undefined": "U" }).name("Borders").onChange(settings.apply);
	folderSettings.add(settings, "neighbors", { "Direct": "D", "Direct and Corners": "DC"}).name("Neighbors").onChange(settings.apply);
	folderSettings.open();

	gui.add(settings, "viewSource").name("Show source code on GitHub");

	const canvas = document.getElementById("canvas");
	automaton.setCanvas(canvas);
	canvas.addEventListener("keypress", event => {
		switch(event.key) {
			case " ":
				settings.running = !settings.running;
				settings.apply();
				break;
			case "s":
				automaton.performStep();
				break;
			case "r":
				settings.restart();
				break;
			case "+":
				settings.speed = Math.min(settings.speed + (event.shiftKey ? 0.01 : 0.001), 2.0);
				settings.apply();
				break;
			case "-":
				settings.speed = Math.max(settings.speed - (event.shiftKey ? 0.01 : 0.001), 0.001);
				settings.apply();
				break;
		}
	}, false);
	canvas.focus();

	settings.restart();
})();