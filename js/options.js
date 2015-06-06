
function loadFeeds() {
	feeds = extBacPage.feedreader.feeds;
	feedcount = extBacPage.feedreader.feedcount;
}

function displayFeeds() {
	for (var i = 0; i < feedcount; i++) {
		var insertPattern = '<tr id="blog%ID%">'
								+ '<td>%TITLE% ( %FEEDLINK% )</td>'
								+ '<td><img src="images/cancel.png" /></td>'
							+ '</tr>';
		var feed = feeds[i];
		insertPattern = insertPattern.replace(/%ID%/, feed.blogid)
									.replace(/%TITLE%/, feed.title)
									.replace(/%FEEDLINK%/, feed.link);
		$("#bloglist tr:last-child").before(insertPattern);
	}
}

var extBacPage, feeds, feedcount, db;

$(document).ready(function(){
	
	$("body").on({
		mouseenter: function () {
			if ($(this).hasClass('current'))return;
			$(this).addClass('hover');
		},
		mouseleave: function () {
			if ($(this).hasClass('hover'))$(this).removeClass('hover');
		},
		click: function(){
			if (!$(this).hasClass('current')) {
				var id = $(this).attr('id');
				id = id.replace("btn", "tab");
				$(".current").removeClass('current');
				$(this).removeClass('hover');
				$(this).addClass('current');
				$(".tab").hide();
				$("#" + id).show();
			}
		}
	}, "#tabs li");
	
	$("body").on({
		click: function(){
			var elem = $(this).parent().parent();
			var blogid = elem.attr("id").slice(4);
			//remove from db
			db.transaction(function(tx) {
				var delStatement = 'DELETE FROM blogs WHERE id = ?';
				tx.executeSql(delStatement, [blogid], function(){
					
					extBacPage.feedreader.removeFeed(blogid);
					
					elem.css("background-color", "#FEE");
					elem.fadeOut("slow", function(){
						elem.remove();
					});
					//reload
					loadFeeds();
					
				}, function(tx, e) {
					console.log('SQL Error: ' + e.message + e + tx);
				});
			});
		}
	}, "#bloglist td:nth-child(2) img");
	
	$("body").on({
		click: function(){
			var maskHeight = $(document).height();
			var maskWidth = $(window).width();
			$('#mask').css({'width': maskWidth, 'height': maskHeight});
			$('#mask').fadeTo("fast", 0.5, function(){
				$("#popup").show();
				var winH = $(window).height();
				var winW = $(window).width();
				var popH = $("#popup").height();
				var popW = $("#popup").width();
				$("#popup").css('top',  winH/2- popH/2);
				$("#popup").css('left', winW/2- popW/2);
			});
		}
	}, "#btnAdd");
	
	$("body").on({
		click: function(){
			$("#popup, #mask").hide();
			$("#popup .pcontent").show();
			$("#popup .ploading, #popup .pmessage, #popup .ploaded").hide();
		}
	}, "#popup .pclose");
	
	$("body").on({
		click: function() {
			$("#popup .pmessage").hide();
			var link = $("input[name=bloglink]").val().trim();
			$("#popup .ploading").show();
			if (link == ""){
				$("#popup .ploading").hide();
				$("#popup .pmessage").show();
				return;
			}
			if (link.slice(0, 4) != "http"){
				link = "http://" + link;
			}
			$.ajax({
				url: link,
				success: function (data) {
					var linktags = $(data).filter(function(){ 
						return $(this).is('link[type="application/rss+xml"]'); 
					});
					var feedurl = "";
					linktags.each(function(){
						//add first link of same domain if not found add first link
						if (!feedurl){
							feedurl = $(this).attr('href');
						}
						if ($(this).attr('href').indexOf(link) != -1){
							feedurl = $(this).attr('href');
							return false;
						}
					});
					var titletags = $(data).filter(function(){ 
						return $(this).is('title'); 
					});
					var title = titletags.first().text();
					title = title || "";
					
					var pagingpattern = "paged=%1,1%";
					var numposts = 10;
					if (feedurl == "") {
						var pagingpattern = "";
						var numposts = 0;
					}else if((feedurl.match(/^(http|https):\/\/(.[^/]+)/i)[2]).indexOf("blogspot") != -1){
						var pagingpattern = "start-index=%0,25%";
						var numposts = 25;
					}
					
					$("#popup input[name=blogtitle]").val(title);
					$("#popup input[name=blogfeedlink]").val(feedurl);
					$("#popup input[name=blogpagepattern]").val(pagingpattern);
					$("#popup input[name=blognumposts]").val(numposts);
					
					$("#popup .ploading").hide();
					$("#popup .pcontent").hide();
					$("#popup .ploaded").show();
					var winH = $(window).height();
					var winW = $(window).width();
					var popH = $("#popup").height();
					var popW = $("#popup").width();
					$("#popup").css('top',  winH/2- popH/2);
					$("#popup").css('left', winW/2- popW/2);
					
				},
				error: function () {
					$("#popup .ploading").hide();
					$("#popup .pmessage").show();
				}
			});
		}
	}, "#pbtnAddLink");
	
	$("body").on({
		click: function() {
			$(this).parent().next().hide(); //hide error msg
			var title = $("#popup input[name=blogtitle]").val();
			var feedurl = $("#popup input[name=blogfeedlink]").val();
			var pagingpattern = $("#popup input[name=blogpagepattern]").val() || "";
			var numposts = $("#popup input[name=blognumposts]").val() || 0;
			if (title.trim() == "" || feedurl.trim() == "") {
				var errmsg = "\u0D0E\u0D31\u0D30\u0D4D\u200D: "
								+ "\u0D24\u0D46\u0D31\u0D4D\u0D31\u0D3E\u0D2F "
								+ "\u0D2C\u0D4D\u0D32\u0D4B\u0D17\u0D4D\u200C "
								+ "\u0D35\u0D3F\u0D35\u0D30\u0D19\u0D4D\u0D19\u0D33\u0D4D\u200D.";
				$(this).parent().next().html(errmsg);
				$(this).parent().next().show(); //show error msg
				return;
			}
			//remove last '/'
			if (feedurl.charAt(feedurl.length - 1) == "/")
				feedurl = feedurl.slice(0, -1);
			//check already added or not
			var isFeedExists = false;
			for (var i = 0; i < feedcount; i++){
				if (feeds[i].link == feedurl){
					isFeedExists = true;
					break;
				}
			}
			if (isFeedExists) {
				var errmsg = "\u0D0E\u0D31\u0D30\u0D4D\u200D: "
								+ "\u0D08 \u0D2C\u0D4D\u0D32\u0D4B\u0D17\u0D4D\u200C "
								+ "\u0D32\u0D3F\u0D38\u0D4D\u0D31\u0D4D\u0D31\u0D3F\u0D32\u0D4D\u200D "
								+ "\u0D12\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D32\u0D4D\u200D "
								+ "\u0D1A\u0D47\u0D30\u0D4D\u200D\u0D24\u0D4D\u0D24\u0D24\u0D3E\u0D23\u0D4D.";
				$(this).parent().next().html(errmsg);
				$(this).parent().next().show(); //show error msg
				return;
			}
			var id = (feedcount != 0) ? (feeds[feedcount - 1].blogid + 1) : 0;
			//add to database
			db.transaction(function(tx) {
				var insertStatement = 'REPLACE INTO blogs VALUES (?, ?, ?, ?, ?, ?)';
				tx.executeSql(insertStatement, 
					[ 
						id,
						title, 
						feedurl,
						numposts,
						1,
						pagingpattern
					], function() {
						var blogentry = {
							id: id,
							feed_link: feedurl,
							title: title,
							feed_numposts: numposts,
							feed_forceupdate: 1,
							feed_pagingpattern: pagingpattern
						};
						extBacPage.feedreader.addFeed(blogentry);
						/*
						var msg = "\u0D2C\u0D4D\u0D32\u0D4B\u0D17\u0D4D\u200C "
									+ "\u0D32\u0D3F\u0D38\u0D4D\u0D31\u0D4D\u0D31"
									+ "\u0D3F\u0D32\u0D4D\u200D "
									+ "\u0D1A\u0D47\u0D30\u0D4D\u200D\u0D24\u0D4D\u0D24\u0D41";
						alert(msg);
						*/
						
						$("#popup, #mask").hide();
						$("#popup .pcontent").show();
						$("#popup .ploading, #popup .pmessage, #popup .ploaded").hide();
						
						var insertPattern = '<tr id="blog%ID%">'
												+ '<td>%TITLE% ( %FEEDLINK% )</td>'
												+ '<td><img src="images/cancel.png" /></td>'
											+ '</tr>';
						insertPattern = insertPattern.replace(/%ID%/, id)
													.replace(/%TITLE%/, title)
													.replace(/%FEEDLINK%/, feedurl);
						$("#bloglist tr:last-child").before(insertPattern);
						$("#blog" + id).hide();
						$("#blog" + id).css("background-color", "#EFE");
						$("#blog" + id).fadeIn("slow", function(){
							$("#blog" + id).css("background-color", "#FFF");
						});
						
						//reload
						loadFeeds();
						
					}, function(tx, e) {
						console.log('SQL Error: ' + e.message + e + tx);
					});
			});
		}
	}, "#blogAdd");
	
	$('input[name="autoupdate"]').click(function(){
		$('input[name="updateinterval"]').prop('disabled', !$(this).is(':checked'));
		if (!$(this).is(':checked'))
			$('input[name="updateinterval"]').val("");
	});
	
	$('input[name="updatesettings"]').click(function(){
		$("#msg").hide();
		var updateinterval = $('input[name="updateinterval"]').val();
		if (!updateinterval){
			$('input[name="autoupdate"]').prop('checked', false);
			$('input[name="updateinterval"]').prop('disabled', true);
			updateinterval = 0;
		}else{
			updateinterval = Math.ceil(updateinterval) * 60 * 1000; //to millisecs
		}
		//save settings
		localStorage.updateInterval = updateinterval;
		//update timer
		extBacPage.timer.updateInterval(updateinterval);
		$("#msg").fadeIn('slow');
	});
	
	extBacPage = chrome.extension.getBackgroundPage();
	db = extBacPage.feedreader.db;
	loadFeeds();
	displayFeeds();
	//set settings
	if (localStorage.updateInterval > 0){
		$('input[name="autoupdate"]').prop('checked', true);
		$('input[name="updateinterval"]').prop('disabled', false);
		$('input[name="updateinterval"]').val(localStorage.updateInterval / 60000);
	}
});