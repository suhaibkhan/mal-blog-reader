
function Timer(callback, interval) {
	
	// private properties
	var id = 0; //timer id
	var timerStartTime;
	
	// public properties
	this.run = callback || function(){};
	interval = parseInt(interval);
	this.interval = interval || 0;
	this.isTimerStarted = false;
	
	// previleged methods
	this.timerInit = function (interval) {
		interval = parseInt(interval);
		// if interval not specified 
		// use interval property of timer class
		interval = interval || this.interval;
		id = setTimeout(function(){
			this.run();
			// start timer again
			this.timerInit();
		}.bind(this), interval);
		// set started time
		timerStartTime = new Date();
		// set timer state as started
		this.isTimerStarted = true;
	}
	
	//start or restart if already started
	this.start = function (interval) {
		interval = parseInt(interval);
		this.stop();
		interval = interval || this.interval;
		this.interval = interval;
		if (!this.isTimerStarted) this.timerInit();
	};
	
	this.stop = function() {
		if (this.isTimerStarted) {
			// clear 
			clearTimeout(id);
			// set timer state as stopped
			this.isTimerStarted = false;
		}
	};
	
	this.updateInterval = function(interval) {
		interval = parseInt(interval);
		// if not started just start it with new interval
		if (!this.isTimerStarted && interval ) {
			this.start(interval);
			return;
		}
		// if started stop it 
		// before changing interval
		this.stop();
		//if no interval specified just stop the timer
		if (!interval) 
			return;
		else
			this.interval = interval; //set interval
		
		//continue running timer
		var elapsed = new Date().getTime() - timerStartTime.getTime();
		if (interval <= elapsed) {
			this.run();
			this.timerInit();
		}else{
			//remaining time as first interval
			var firstinterval = interval - elapsed;
			this.timerInit(firstinterval);
		}
	};
}