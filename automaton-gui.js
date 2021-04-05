var settings = {
	running : true,
	speed : 1,
	blockSize : 10,
	initialPopulation : 0.01,
	numColors : 1,
	borderWrap : true,
	neighbors : "D",
	performStep : automaton.performStep,
	restart : function() {
		automaton.start(settings.blockSize, settings.numColors, settings.borderWrap, settings.initialPopulation, settings.neighbors, settings.running, settings.speed);
	},
	viewSource : function() {
		window.location.href = "https://github.com/Robyt3/automaton";
	}
};

var gui = new dat.gui.GUI({ width: 400 });

var folderGeneration = gui.addFolder('Generation');
folderGeneration.add(settings, 'running').name('Running').listen().onChange(function() {
	automaton.setRunning(settings.running);
});
folderGeneration.add(settings, 'speed').min(0.001).max(2).step(0.001).name('Speed').listen().onChange(function() {
	automaton.setSpeed(settings.speed);
});
folderGeneration.add(settings, 'performStep').name('Perform single step');
folderGeneration.add(settings, 'restart').name('Start/Restart generation');
folderGeneration.open();

var folderSettings = gui.addFolder('Settings');
folderSettings.add(settings, 'blockSize').min(5).max(100).step(1).name('Block size');
folderSettings.add(settings, 'initialPopulation').min(0).max(1.0).step(0.001).name('Initial population');
// TODO: Number of colors is weird because step size 2 does not work correctly with odd minimum value to enforce odd numbers
folderSettings.add(settings, 'numColors').min(1).max(25).step(1).name('Number of colors (2 * N + 1)');
folderSettings.add(settings, 'borderWrap').name('Borders wrap around');
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
	} else if(event.key == "+") {
		settings.speed = Math.min(settings.speed + (event.shiftKey ? 0.01 : 0.001), 2.0);
		automaton.setSpeed(settings.speed);
	} else if(event.key == "-") {
		settings.speed = Math.max(settings.speed - (event.shiftKey ? 0.01 : 0.001), 0.001);
		automaton.setSpeed(settings.speed);
	}
});