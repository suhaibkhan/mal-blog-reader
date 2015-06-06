
function logThis(msg) {
	if (prefs.debug) {
		console.log(msg);
	}
}

//main
if (!localStorage.initialized) {
	//first run
	localStorage.bloglist = JSON.stringify(prefs.bloglist);
	localStorage.initialized = true;
}

var feedreader = new FeedReader();
var updateCallback = function(){feedreader.fetchFeeds();}; 
var timer = new Timer(updateCallback);
//start timer
if (localStorage.updateInterval > 0) {
	timer.start(localStorage.updateInterval);
}

