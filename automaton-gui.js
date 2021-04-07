var settings = {
	running : true,
	speed : 1,
	blockSize : 10,
	initialPopulation : 0.01,
	numColors : 1,
	borders : "W",
	neighbors : "D",
	initialCellLife : 1,
	performStep : automaton.performStep,
	restart : function() {
		automaton.start(settings);
	},
	viewSource : function() {
		window.location.href = "https://github.com/Robyt3/automaton";
	}
};

var gui = new dat.gui.GUI({ width: 400 });

var folderGeneration = gui.addFolder('Generation');
folderGeneration.add(settings, 'running').name('Running [Space]').listen().onChange(function() {
	automaton.setRunning(settings.running);
});
folderGeneration.add(settings, 'speed').min(0.001).max(2).step(0.001).name('Speed [+/-]').listen().onChange(function() {
	automaton.setSpeed(settings.speed);
});
folderGeneration.add(settings, 'performStep').name('Perform single step [S]');
folderGeneration.add(settings, 'restart').name('Start/Restart generation [R]');
folderGeneration.open();

var folderSettings = gui.addFolder('Settings');
folderSettings.add(settings, 'blockSize').min(5).max(100).step(1).name('Cell size (pixels)');
folderSettings.add(settings, 'initialPopulation').min(0).max(1.0).step(0.001).name('Initial population');
folderSettings.add(settings, 'initialCellLife').min(1).max(50).step(1).name('Initial cell life');
// TODO: Number of colors is weird because step size 2 does not work correctly with odd minimum value to enforce odd numbers
folderSettings.add(settings, 'numColors').min(1).max(25).step(1).name('Number of colors (2 * N + 1)');
folderSettings.add(settings, 'borders', { "Wrap around": "W", "Empty": "E", "Undefined": "U" }).name('Borders');
folderSettings.add(settings, 'neighbors', { "Direct": "D", "Direct and Corners": "DC"}).name('Neighbors');
folderSettings.open();

gui.add(settings, 'viewSource').name('Show source code on GitHub');

$(document).ready(settings.restart);
$(document).keypress(event => {
	if(event.key == " ") {
		settings.running = !settings.running;
		automaton.setRunning(settings.running);
	} else if(event.key == "s") {
		automaton.performStep();
	} else if(event.key == "r") {
		settings.restart();
	} else if(event.key == "+") {
		settings.speed = Math.min(settings.speed + (event.shiftKey ? 0.01 : 0.001), 2.0);
		automaton.setSpeed(settings.speed);
	} else if(event.key == "-") {
		settings.speed = Math.max(settings.speed - (event.shiftKey ? 0.01 : 0.001), 0.001);
		automaton.setSpeed(settings.speed);
	}
});