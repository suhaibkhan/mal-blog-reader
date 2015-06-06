
function stripTags(html) {
	return html
			.replace(/<(?:br|\/div|\/p)>/g, "\n")
			.replace(/(<([^>]+)>)/ig, "")
			.replace(/\n/g, "<br />");
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function Feed(data, db) {
	logThis("Feed " + data.id + ": constructor ");
	this.db = db;
	
	this.blogid = data.id;
	this.title = data.title;
	this.link = data.feed_link;
	this.numPosts = data.feed_numposts;
	this.forceUpdate = data.feed_forceupdate;
	this.pagingPattern = data.feed_pagingpattern || "";
	
	this.feedposts = [];
	this.postscount = 0;
	
	this.onComplete = function(){};
	this.isComplete = false;
}

Feed.prototype.initFetch = function(callback){
	logThis("Feed " + this.blogid + ": initFetch ");
	this.feedposts = [];
	this.postscount = 0;
	
	this.onComplete = callback || function() {};
	this.isComplete = false;
	
	this.newPostsIndex = null;
	this.isWebFetchingComplete = false;
	
	this.dbClean(function (){
		this.dbFetch(function (){
			var parsedLink = this.parseLink();
			this.webFetch(parsedLink, function(){
				this.storePosts(function (){
					this.completed();
				}.bind(this));
			}.bind(this));
		}.bind(this));
	}.bind(this));
}

Feed.prototype.dbClean = function(callback){
	logThis("Feed " + this.blogid + ": dbClean ");
	callback = callback || function() {};
	this.db.transaction(function(tx) {
		var cleanStatement = 'DELETE FROM posts WHERE pubdate < ?';
		var today = new Date();
		today.setHours(0,0,0,0);
		tx.executeSql(cleanStatement, [today.getTime()], callback, sqlError);
	}.bind(this));
}

Feed.prototype.dbFetch = function(callback){
	logThis("Feed " + this.blogid + ": dbFetch ");
	callback = callback || function() {};
	this.db.readTransaction(function(tx) {
		tx.executeSql('SELECT * FROM posts WHERE blog_id = ?', [this.blogid], function(tx, results) {
			// get posts from db
			for ( var i = 0; i < results.rows.length; i++ ) {
				var postentry = results.rows.item(i);
				this.feedposts[this.postscount] = postentry;
				this.postscount += 1;
			}
			callback();
		}.bind(this), sqlError);
	}.bind(this));
}

Feed.prototype.isPostAdded = function(title, pubdate, link){
	var postExists = false;
	for (var i = this.postscount - 1; i >= 0; i--) {
		if (this.feedposts[i].link == link 
			&& this.feedposts[i].title == title
			&& this.feedposts[i].pubdate == pubdate.getTime()) {
			postExists = true;
			break;
		}
	}
	return postExists;
}

Feed.prototype.parseLink = function(){
	logThis("Feed " + this.blogid + ": parseLink ");
	var today = new Date();
	var dateisostr = today.toISOString();
	var yearstr = today.getFullYear().toString();
	var monstr = ("0" + (today.getMonth() + 1)).slice(-2);
	var daystr = ("0" + today.getDate()).slice(-2);
	
	var parsedLink = this.link;
	if (this.forceUpdate) {
		if ( parsedLink.indexOf('?') == -1 )
			parsedLink += "?forceupdate=" + encodeURIComponent(dateisostr);
		else
			parsedLink += "&forceupdate=" + encodeURIComponent(dateisostr);
	}
	
	return parsedLink.replace(/%YEAR%/g, yearstr)
					.replace(/%MONTH%/g, monstr)
					.replace(/%DATE%/g, daystr); 
}

Feed.prototype.webFetch = function(link, callback){
	logThis("Feed " + this.blogid + ": webFetch - " + link );
	callback = callback || function() {};
	
	var xhr = new XMLHttpRequest();
	xhr.open('GET', link);
	xhr.onreadystatechange = function() {
		if ( xhr.readyState == 4 ) {
			if ( xhr.status == 200 ) {
				this.parseResponse(xhr.responseXML, (xhr.responseText || '').trim(), link, callback);
			} else {
				logThis("XMLHttpRequest : Error - " + link + xhr.status);
				// cannot proceed furthur
				this.isWebFetchingComplete = true;
			}
			if (this.isWebFetchingComplete) callback();
		}
	}.bind(this);
	xhr.send();
}

Feed.prototype.parseResponse = function(xml, text, link, callback){
	logThis("Feed " + this.blogid + ": parseResponse - " + link );
	// if xml header not found
	if ( ! xml ) {
		xml = new DOMParser().parseFromString(text, 'text/xml');
	}
	//parse rss
	// Feed posts are indicated with <entry> or <item> tags
	var posts = xml.getElementsByTagName('entry');
	if (posts.length == 0)
		posts = xml.getElementsByTagName('item');
	
	for (var i = 0; i < posts.length; i++) {
		var post = posts[i];
		
		// get title of the post
		var postTitle = post.getElementsByTagName('title')[0];
		if (postTitle)
			postTitle = postTitle.textContent;
		else
			continue; // ignore posts with no title
		
		// get published date and time
		var postDateStr = post.getElementsByTagName('pubDate')[0];
		if (postDateStr)
			postDateStr = postDateStr.textContent;
		else
			continue; // ignore posts with no date
		var postDate = new Date(postDateStr);
		// check whether post published today
		var today = new Date();
		today.setHours(0,0,0,0);
		if (postDate < today) {
			// completed
			this.isWebFetchingComplete = true;
			// ignore rest of the posts
			return;
		}
		
		// get link to the post
		var postLink = post.getElementsByTagName('link')[0];
		if (postLink)
			postLink = postLink.textContent;
		else
			// if no link return address of the blog
			postLink = link.match(/^(http|https):\/\/(.[^/]+)/i)[0]; 
		// check if post with same link exists
		if (this.isPostAdded(postTitle, postDate, postLink)) {
			// completed
			this.isWebFetchingComplete = true;
			// ignore rest of the posts
			return;
		}
			
		// get summary of the post
		var postDesc = post.getElementsByTagName('description')[0];
		if (!postDesc)
			postDesc = post.getElementsByTagName('summary')[0];
		if (!postDesc)
			postDesc = post.getElementsByTagName('content')[0];
		if (postDesc)
			postDesc = postDesc.textContent;
		else
			postDesc = ""; // no summary
		// strip html in summary
		postDesc = stripTags(postDesc);
		// strip summary if execeeds max length
		var summary_maxsize = prefs.summary_maxsize;
		if (postDesc.length > summary_maxsize) {
			postDesc = postDesc.substr(0, summary_maxsize);
			var lastSpaceIndex = postDesc.lastIndexOf(" ");
			postDesc = postDesc.substring(0, lastSpaceIndex);
		}
		
		// get post author
		var postAuthor = post.getElementsByTagName('creator')[0];
		if (!postAuthor)
			postAuthor = post.getElementsByTagName('author')[0];
		if (postAuthor)
			postAuthor = postAuthor.textContent;
		else
			postAuthor = ""; // no author
		// strip email from author name (applies to blogspot feed)
		var postAuthorWithEmail = postAuthor.match(/\s*.+@.+\..+\s*\((.+)\)\s*/i);
		if (postAuthorWithEmail)
			postAuthor = postAuthorWithEmail[1];
		
		// get categories
		var postCategoryNodes = post.getElementsByTagName('category');
		var postCategories = "";
		if (postCategoryNodes.length > 0){
			for (var j = 0; j < postCategoryNodes.length; j++) {
				postCategories += postCategoryNodes[j].textContent;
				// do not add comma after last category
				if (j < postCategoryNodes.length - 1)
					postCategories += ",";
			}
		}
		
		// add post
		var newPost = {};
		newPost.blog_id = this.blogid;
		newPost.title = postTitle;
		newPost.link = postLink;
		newPost.pubdate = postDate.getTime();
		newPost.summary = postDesc;
		newPost.author = postAuthor;
		newPost.categories = postCategories;
		if (this.newPostsIndex == null)
			this.newPostsIndex = this.postscount;
		this.feedposts[this.postscount] = newPost;
		this.postscount += 1;
	}
	
	// fetch next page of feed if exists
	if (posts.length && posts.length == this.numPosts && this.pagingPattern){
		var pagingParts = this.pagingPattern.match(/^(.+)%(.+)\,(.+)%$/);
		if (pagingParts) {
			var pagingInitStr = pagingParts[1];
			var pagingInitVal = parseInt(pagingParts[2]);
			if (!isNaN(parseInt(pagingParts[3]))) {
				var pagingIncrVal = parseInt(pagingParts[3]);
			}else{
				var pagingIncrVal = 1;
				if (pagingParts[3].match(/MAXPOSTCOUNT/))
					pagingIncrVal = this.numPosts;
			}
			var withPagePattern = '(.+)' + escapeRegExp(pagingInitStr) + '(\\d+)$';
			var lastPage = link.match(withPagePattern);
			if (lastPage){
				var feedURL = lastPage[1];
				var curPage = parseInt(lastPage[2]);
			}else{
				var feedURL = link;
				if ( feedURL.indexOf('?') == -1 )
					feedURL += "?";
				else
					feedURL += "&";
				var curPage = pagingInitVal;
			}
			// fetch page
			var newLink = feedURL + pagingInitStr + (curPage + pagingIncrVal).toString();
			this.webFetch(newLink, callback);
			return;
		}
	}
	// completed
	this.isWebFetchingComplete = true;
}

Feed.prototype.storePosts = function(callback){
	logThis("Feed " + this.blogid + ": storePosts ");
	callback = callback || function() {};
	if (this.newPostsIndex != null) {
		this.db.transaction(function(tx) {
			// insert new posts into db
			for (var i = this.newPostsIndex; i < this.feedposts.length; i++){
				var post = this.feedposts[i];
				var insertStatement = 'REPLACE INTO posts VALUES (?, ?, ?, ?, ?, ?, ?)';
				tx.executeSql(insertStatement, 
					[ 
						post.blog_id,
						post.title,
						post.link, 
						post.pubdate,
						post.summary,
						post.author,
						post.categories
					], function() {}, sqlError);
			}
		}.bind(this),function(e){
			logThis('SQL Error: ' +  e.message);
		},callback);
	}else{
		callback();
	}
}

Feed.prototype.completed = function(){
	logThis("Feed " + this.blogid + ": completed");
	this.isComplete = true;
	var updated = (this.newPostsIndex != null);
	this.onComplete(updated);
}
