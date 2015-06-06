function sqlError(tx, e) {
	logThis('SQL Error: ' + e.message + e + tx);
}

function sqlSuccess(tx, results) {
	logThis('SQL Success : ' + results.rowsAffected + ' rows affected');
}; 

function FeedReader() {
	logThis("FeedReader : constructor");
	this.feeds = [];
	this.feedcount = 0;
	this.onComplete = function(){};
	this.isComplete = false;
	
	this.initDB(function (){
		this.loadLocalFeeds(function (){
			this.getFeeds(function (){
				this.fetchFeeds();
			}.bind(this));
		}.bind(this));
	}.bind(this));
}

FeedReader.prototype.initDB = function(callback){
	logThis("FeedReader : initDB");
	callback = callback || function() {};
	this.db = openDatabase('Posts', '1.0', 'posts', 2 * 1024 * 1024);
	this.db.transaction(function(tx) {
		tx.executeSql('CREATE TABLE IF NOT EXISTS '
			+ ' blogs ('
				+ ' id INTEGER PRIMARY KEY,'
				+ ' title TEXT,'
				+ ' feed_link TEXT,'
				+ ' feed_numposts INTEGER DEFAULT(0),'
				+ ' feed_forceupdate INTEGER DEFAULT(0),'
				+ ' feed_pagingpattern TEXT '
			+ ' )',
			[], function() {}, sqlError
		);
		
		tx.executeSql('CREATE TABLE IF NOT EXISTS '
			+ ' posts ('
				+ ' blog_id INTEGER,'
				+ ' title TEXT,'
				+ ' link TEXT PRIMARY KEY,'
				+ ' pubdate INTEGER,'
				+ ' summary TEXT,'
				+ ' author TEXT,'
				+ ' categories TEXT'
			+ ' )',
			[],	function() {}, sqlError
		);
	},function(e){
		logThis('SQL Error: ' + e.message + e);
	},callback);
} 

FeedReader.prototype.getFeeds = function(callback){
	logThis("FeedReader : getFeeds");
	callback = callback || function() {};
	this.feeds = [];
	this.db.readTransaction(function(tx) {
		tx.executeSql('SELECT * FROM blogs ORDER BY id', [], function(tx, results) {
			//get feeds list from db
			this.feedcount = results.rows.length;
			for ( var i = 0; i < results.rows.length; i++ ) {
				var blogentry = results.rows.item(i);
				this.feeds[i] = new Feed(blogentry, this.db);
			}
			callback();
		}.bind(this), sqlError);
	}.bind(this));
}

FeedReader.prototype.loadLocalFeeds = function(callback){
	logThis("FeedReader : loadLocalFeeds");
	callback = callback || function() {};
	if (localStorage.bloglist) {
		logThis("loadLocalFeeds - loading");
		var bloglist = JSON.parse(localStorage.bloglist);
		localStorage.removeItem("bloglist");
		this.db.transaction(function(tx) {
			for (var i = 0; i < bloglist.length; i++){
				bloglist[i].id = i;
				bloglist[i].feed_numposts = bloglist[i].feed_numposts || 0;
				bloglist[i].feed_forceupdate = bloglist[i].feed_forceupdate || 1;
				bloglist[i].feed_pagingpattern = bloglist[i].feed_pagingpattern || "";
				//add to DB
				var insertStatement = 'REPLACE INTO blogs VALUES (?, ?, ?, ?, ?, ?)';
				tx.executeSql(insertStatement, 
					[ 
						bloglist[i].id,
						bloglist[i].title, 
						bloglist[i].feed_link,
						bloglist[i].feed_numposts,
						bloglist[i].feed_forceupdate,
						bloglist[i].feed_pagingpattern
					], function() {}, sqlError);
			}
		}.bind(this),function(e){
			logThis('SQL Error: ' + e.message + e);
		},callback);
	}else{
		callback();
	}
}

FeedReader.prototype.addFeed = function(entry){
	logThis("FeedReader : addFeed");
	this.feeds[this.feedcount] = new Feed(entry, this.db);
	this.feedcount += 1;
	//fetch this feed only
	this.fetchFeeds(entry.id);
}

FeedReader.prototype.removeFeed = function(blogid){
	logThis("FeedReader : removeFeed");
	if (!blogid) return;
	for (var i = 0; i < this.feedcount; i++) {
		if (this.feeds[i].blogid == blogid){
			this.feeds.splice(i, 1);
			break;
		}
	}
}

FeedReader.prototype.fetchFeeds = function(blogid){
	logThis("FeedReader : fetchFeeds");
	if (blogid){
		//fetch specified feed only
		for (var i = 0; i < this.feedcount; i++) {
			var feed = this.feeds[i];
			if (feed.blogid == blogid){
				feed.initFetch(function(updated){
					this.loadingComplete(updated);
				}.bind(this));
				break;
			}
		}
	}else {
		//fetch all feeds
		for (var i = 0; i < this.feedcount; i++) {
			var feed = this.feeds[i];
			feed.initFetch(function(updated){
				this.loadingComplete(updated);
			}.bind(this));
		}
	}
}

FeedReader.prototype.loadingComplete = function(updated){
	logThis("FeedReader : loadingComplete - " + updated);
	var completedflag = true;
	for (var i = 0; i < this.feedcount; i++) {
		var feed = this.feeds[i];
		if (!feed.isComplete){
			completedflag = false;
			break;
		}
	}
	if (completedflag) {
		this.isComplete = true;
		//complete callback
		if (this.onComplete)
			this.onComplete();
	}else{
		this.isComplete = false;
	}
	
	//update popup on each feed fetch if visible
	var popup = chrome.extension.getViews({type: 'popup'})[0];
	if (popup) {
		//fetch from db and update popup if updates available
		this.updatePopUp(updated);
	}else{
		if (updated) {
			//show notification in browser action
			chrome.browserAction.setIcon({path : "images/notif_icon.png"});
		}
	}
}

FeedReader.prototype.dumpDB = function(){
	logThis("FeedReader : dumpDB");
	var selectStatement = 'SELECT * FROM posts';
	this.db.readTransaction(function (tx) {
		tx.executeSql(selectStatement, [], function(tx, results) {
			for ( var i = 0; i < results.rows.length; i++ ) {
				var postentry = results.rows.item(i);
				//print post details
				console.log(postentry.blog_id);
				console.log(postentry.title);
				console.log(postentry.link);
				console.log(postentry.pubdate);
				console.log(postentry.summary);
				console.log(postentry.author);
				console.log(postentry.categories);
			}
		}, sqlError);
	});
}

FeedReader.prototype.updatePopUp = function(fetchFromDB){
	logThis("FeedReader : updatePopUp");
	var popup = chrome.extension.getViews({type: 'popup'})[0];
	if (popup){
	
		//fetch from db only if new posts available
		//else 'forceShow' is true
		if (!fetchFromDB) {
			//on complete remove loading in popup
			if (this.isComplete) {
				//not content available
				if (localStorage.tempLastLink) {
					localStorage.lastLink = localStorage.tempLastLink;
					localStorage.removeItem("tempLastLink");
				}
				popup.update(false);
			}
			return;
		}
		
		var selectStatement = 'SELECT posts.title , posts.author, posts.summary, '
								+ 'posts.link, blogs.title AS blogtitle FROM posts INNER JOIN '
								+ 'blogs ON posts.blog_id = blogs.id AND posts.pubdate >= ? '
								+ 'ORDER BY posts.pubdate DESC';
		this.db.readTransaction(function (tx) {
			var today = new Date();
			today.setHours(0,0,0,0);
			tx.executeSql(selectStatement, [today.getTime()], function(tx, results) {
				var tplArticle = '<article class="entry">'
									+ '<header %NEWPOST%><hgroup><h1>%TITLE%</h1>'
									+ '<h3>%AUTHOR%, %BLOG%</h3></hgroup></header>'
									+ '<article class="summary"><p>%SUMMARY%</p>'
									+ '<p class="readmore"><a href="%LINK%" target="_blank">'
									+ '\u0D2E\u0D41\u0D34\u0D41\u0D35\u0D28\u0D4D\u200D '
									+ '\u0D35\u0D3E\u0D2F\u0D3F\u0D15\u0D4D\u0D15\u0D41'
									+ '\u0D15</a></p></article>'
								+ '</article>';
				var tplPage = '<section id="wrapper" class="page">%PAGES%</section>';
				var preSection = '<section id="head">'
									+ '<img src="images/icon_16.png" />'
									+ '<h1>\u0D07\u0D28\u0D4D\u0D28\u0D24\u0D4D\u0D24\u0D46 '
									+ '\u0D2A\u0D4B\u0D38\u0D4D\u0D31\u0D4D\u0D31\u0D41'
									+ '\u0D15\u0D33\u0D4D\u200D</h1>'
								+ '</section>';
				var postSection = '<section id="nav">'
									+ '<div id="previous">'
									+ '<img src="images/prev.png" alt="&lt;&lt;"/>'
									+ '\u0D2A\u0D34\u0D2F \u0D2A\u0D4B\u0D38\u0D4D' 
									+ '\u0D31\u0D4D\u0D31\u0D41\u0D15\u0D33\u0D4D\u200D'
									+ '</div><div id="next">\u0D2A\u0D41\u0D24\u0D3F\u0D2F '
									+ '\u0D2A\u0D4B\u0D38\u0D4D\u0D31\u0D4D\u0D31'
									+ '\u0D41\u0D15\u0D33\u0D4D\u200D '
									+ '<img src="images/next.png" alt="&gt;&gt;"/></div>'
									+ '<div style="clear: both;"></div>'
								+ '</section>'
								+ '<section id="update">'
									+ '<p class="button">\u0D2A\u0D41\u0D24\u0D3F\u0D2F '
									+ '\u0D2A\u0D4B\u0D38\u0D4D\u0D31\u0D4D\u0D31\u0D41'
									+ '\u0D15\u0D33\u0D4D\u200D \u0D09\u0D23\u0D4D\u0D1F'
									+ '\u0D4B \u0D0E\u0D28\u0D4D\u0D28\u0D41 '
									+ '\u0D28\u0D4B\u0D15\u0D4D\u0D15\u0D41\u0D15</p>'
									+ '<p class="loading"><img src="images/loading.gif" />'
									+ '\u0D32\u0D4B\u0D21\u0D3F\u0D02\u0D17\u0D4D...</p>'
								+ '</section>'; 
								
				var numOfPosts = results.rows.length;
				var postsPerPage = prefs.popup_posts_per_page;
				var numOfPages =  Math.ceil(numOfPosts / postsPerPage);
				var popupContent = '';
				
				popupContent += preSection;
				var isNewPost = true;
				for (var i = 0; i < numOfPages; i++){
					var posts = '';
					var maxPosts = (i + 1) * postsPerPage;
					var lastPostIndex =  (maxPosts > numOfPosts) ? numOfPosts : maxPosts;
					for (var j = i * postsPerPage; j < lastPostIndex; j++){
						var postentry = results.rows.item(j);
						//indicate new post
						if (postentry.link == localStorage.lastLink){
							isNewPost = false; 
						}
						var newPostIndication = '';
						if (isNewPost){
							newPostIndication = 'class = "newpost"'
						}
						var post = tplArticle.replace(/%TITLE%/g, postentry.title)
											.replace(/%AUTHOR%/g, postentry.author)
											.replace(/%BLOG%/g, postentry.blogtitle)
											.replace(/%SUMMARY%/g, postentry.summary)
											.replace(/%LINK%/g, postentry.link)
											.replace(/%NEWPOST%/g, newPostIndication);
						posts += post;
					}
					var page = tplPage.replace(/%PAGES%/g, posts);
					popupContent += page;
				}
				//set last post for new post detection next time
				if (numOfPosts > 0) {
					if (this.isComplete) {
						localStorage.lastLink = results.rows.item(0).link;
						if (localStorage.tempLastLink) {
							localStorage.removeItem("tempLastLink");
						}
					} else {
						localStorage.tempLastLink = results.rows.item(0).link;
					}
				}
				popupContent += postSection;
				//update
				popup.update(!this.isComplete, popupContent);
			}.bind(this), sqlError);
		}.bind(this));
	}
}