

function update(isLoading, popupContent) {
	//update from background page
	if (popupContent) {
		$('body').html(popupContent);
		$('body .page').first().show();
		showPagination();
	}
	if (isLoading) {
		$("#update .button").hide();
		$("#update .loading").show();
	}else{
		//completed
		$("#update .button").show();
		$("#update .loading").hide();
	}
}

function showPagination() {
	if ($('.page:visible').next().hasClass('page')){
		$("#previous").show();
	}else{
		$("#previous").hide();
	}
	if ($('.page:visible').prev().hasClass('page')){
		$("#next").show();
	}else{
		$("#next").hide();
	}
}

function updatePosts() {
	//update
	var extBacPage = chrome.extension.getBackgroundPage();
	extBacPage.feedreader.fetchFeeds();
}

function getPosts() {
	//initial load
	var extBacPage = chrome.extension.getBackgroundPage();
	extBacPage.feedreader.updatePopUp(true);
}

$(document).ready(function(){

	$("body").on({
		mouseenter: function () {
			if ($(this).hasClass('active'))return;
			if ($(this).hasClass('newpost'))$(this).removeClass('newpost');
			$(this).addClass('hover');
			$(this).parent().css('border-left-color', '#999');
		},
		mouseleave: function () {
			if ($(this).hasClass('hover'))$(this).removeClass('hover');
			$(this).parent().css('border-left-color', '#CCC');
		},
		click: function(){
			if ($(this).hasClass('active')) {
				$(this).parent().children('.summary').hide();
				$(this).removeClass('active');
				$(this).addClass('hover');
				$(this).parent().css('border-left-color', '#999');
			}else{
				$(".entry .summary:visible").hide();
				$(".entry header").not(this).removeClass('active');
				$(this).removeClass('hover');
				$(this).addClass('active');
				var parent = $(this).parent();
				parent.css('border-left-color', '#CCC');
				parent.children('.summary').show("fast");
			}
		}
	}, ".entry header");
	
	$("body").on({
		mouseenter: function () {
			$(this).css('background-color','#000');
		},
		mouseleave: function () {
			$(this).css('background-color','#666');
		},
		click: function(){
			var navId = $(this).attr('id');
			var curPage = $('.page:visible');
			curPage.find(".entry .summary:visible").hide();
			curPage.find(".entry .active").removeClass('active');
			curPage.hide(function(){
				if (navId == "previous")
					$(this).next().show('fast', showPagination);
				else if(navId == "next")
					$(this).prev().show('fast', showPagination);
			});
		}
	}, "#nav div");
	
	$("body").on({
		mouseenter: function () {
			$(this).css('text-decoration','underline');
		},
		mouseleave: function () {
			$(this).css('text-decoration','none');
		},
		click: function(){
			updatePosts();
			$(this).hide();
			$(this).next().show();
		}
	}, "#update .button");
	
	getPosts();
	
	//change icon
	chrome.browserAction.setIcon({path : "images/icon_19.png"});
});

/**
 * Google Analytics code to track popup page views
 */
var _AnalyticsCode = 'UA-33660253-1';
var _gaq = _gaq || [];
_gaq.push(['_setAccount', _AnalyticsCode]);
_gaq.push(['_trackPageview']);
(function() {
	var ga = document.createElement('script');
	ga.type = 'text/javascript';
	ga.async = true;
	ga.src = 'https://ssl.google-analytics.com/ga.js';
	var s = document.getElementsByTagName('script')[0];
	s.parentNode.insertBefore(ga, s);
})();