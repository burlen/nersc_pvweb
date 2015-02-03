// newt.js
// 
// To use, insert this in your <head> section: 
// <script type="text/javascript" src="https://newt.nersc.gov/js/jquery-1.4.2.min.js"></script>
// <script type="text/javascript" src="https://newt.nersc.gov/js/newt.js"></script>

// Depends on jquery-1.4 or higher

// TODO: reset to newt after refactoring 
var newt_server="https://newt.nersc.gov";
var newt_base_path="/newt";
var newt_base_url=newt_server+newt_base_path;
var stayInDOM = true;

// TODO: Settle on auth type (string vs. boolean)
var newt_user={
    username:null,
    auth:false,
    session_lifetime:0
}

var IE = document.all?true:false;

var backupHTML;
var xmlhttp;

// $.newt_ajax simplifies call stack
// This is a wrapper to $.ajax but will additionally:
// - Set the credentials
// - Add the newt_base_url prefix
// This means that your URL is simply the API path

// TODO: Add Content Type

jQuery.extend({
   newt_ajax : function(s) {
       var myurl;
       // Do some sanity checking on URL - strip off https hostname and leading /newt
       // Do we want to check for newt_base_url??
       if (myurl=s.url.match(/^https?:\/\/[^\/]*(\/.*)/)) {
           s.url=myurl[1];           
       }
       
       // TODO: Match against newt_base_path
       var re=new RegExp("^"+newt_base_path+"(.*)");
       if (myurl=s.url.match(re)) {
           s.url=myurl[1];
       }

       // Set contentType string to json for "store" queries
       if (s.url.match(/^\/store/) && s.data) {
           s.contentType="application/json; charset=utf-8";           
       }

       if (!s.url.match(/^\/file.*view=read$/) && !s.url.match(/^\/status\/motd/)) {
           s.dataType='json';
       }
          
       // FIXME: Deal width jquery issue that calls success on "0" error code

       // Merge the existing settings with NEWT boilerplate options
       var ajax_settings=$.extend({},s,{
              url : newt_base_url+s.url,
              beforeSend : function(xhr){
                      // make cross-site requests
                      xhr.withCredentials = true;

              },
              crossDomain : true,
              cache : false,
              // For jquery 1.5
              xhrFields: { withCredentials: true },
          });
       $.ajax(ajax_settings);                   
   }
});


var logoutTimer=null;

var submission = function(){
    var username=$('#id_username').val();
    var password=$('#id_password').val();
    // show spinner
    $('#newt_auth_load').css('display', 'inline-block');
    $.newt_ajax({
        type:'POST', 
        url:"/auth", 
        data:{'username':username, 'password':password},
        success:function(res, textStatus, jXHR) {
            $('#newt_auth_load').hide();
            $('#topAuth').slideUp();
            check_status();
        }
    });
}

function doAfterLogin(){
}
function doAfterLogout(){
}

var check_status=function() {
	$.newt_ajax({url:'/auth/',

    success:function(veri, textStatus, jXHR){
    if (veri.auth==false) { 
		//make sure hiding is turned off
		Set_Cookie( 'hide', '0', '', '/', '', '' );
        $('#topAuth').slideDown();
        $('#newt_auth_load').hide();
        $('#topAuth').animate({ backgroundColor: "#c83630" }, 200).animate({ backgroundColor: "#000000" }, 1000);
        // Cleanup any residual timer
        if (logoutTimer!=null) {
          clearTimeout(logoutTimer);
          logoutTimer=null;
        }

    } else {
        if(stayInDOM){
            backupHTML = $('#topAuth').html();
            $('#authCont').html("<div style='display: inline; padding-top: 7px;'>Logged in as <b>"+veri.username+"</b></div><div style='float:right;'><input style='display:inline; padding:2px 7px; font-size:12px;color:#444;background-color:#eee;background-image:-webkit-gradient(linear, 0 0, 0 100%,color-stop(0, #fff),color-stop(0.05, #eee),color-stop(1, #bbb));background-image:-moz-linear-gradient(-90deg,#fff 0%, #eee 5%, #bbb 100%);text-shadow:0 1px 0 #f6f6f6; -webkit-border-radius:2px;-moz-border-radius:2px;border:1px solid #888; -webkit-box-shadow:0 1px 2px rgba(0,0,0,0.3);-moz-box-shadow:0 1px 2px rgba(0,0,0,0.3);' type='submit' value='Logout' onClick='logout();'><input style='display:inline; padding:2px 7px; font-size:12px;color:#444;background-color:#eee;background-image:-webkit-gradient(linear, 0 0, 0 100%,color-stop(0, #fff),color-stop(0.05, #eee),color-stop(1, #bbb));background-image:-moz-linear-gradient(-90deg,#fff 0%, #eee 5%, #bbb 100%);text-shadow:0 1px 0 #f6f6f6; -webkit-border-radius:2px;-moz-border-radius:2px;border:1px solid #888; -webkit-box-shadow:0 1px 2px rgba(0,0,0,0.3);-moz-box-shadow:0 1px 2px rgba(0,0,0,0.3);' type='submit' value='Close X' onClick='javascript: hideForm()'></div>");
            $('#newt_auth_load').hide();
            $('#topAuth').slideDown();
            $('#topAuth').animate({ backgroundColor: "#0db51b" }, 200).animate({ backgroundColor: "#000000" }, 1000);
        }else{}
        // Set a timer to logout after session expiry
        if (logoutTimer==null) {
            logoutTimer=setTimeout('logout()',veri.session_lifetime*1000);
        }        				                
    }
    if (veri!=null) {
        newt_user.username=veri.username;
        newt_user.auth=veri.auth;
        newt_user.session_lifetime=veri.session_lifetime;
        //user-customizable functions
		if(newt_user.auth==true) doAfterLogin();
		else doAfterLogout();
    }
	}});
};
var hideForm = function(){
        Set_Cookie( 'hide', '1', '', '/', '', '' );
        vanishBox();
}
var vanishBox = function(){
    $('#topAuth').slideUp();
}
var logout = function(){
    $.newt_ajax({url:"/logout", 
        success:function() {
            $('#topAuth').slideUp("fast", function(){
                $('#topAuth').html(backupHTML);
                $('#newt_auth_load').hide();
                check_status();
				//make sure hiding of the login form is turned off
				Set_Cookie( 'hide', '0', '', '/', '', '' );
            });
            
                   				                
    }});  
      
}
$(function() {
        if(Get_Cookie( 'hide' )){
            if (Get_Cookie( 'hide' ) == 1 ){
                stayInDOM = false;
            }
            else{
                stayInDOM = true;
            }
        }else{}


        $('body').prepend("<div id='topAuth' style='width:100%; min-width:820px; height:35px; position: relative; background: #000000; display:inline-block; z-index:13; color: #ffffff; font-size: 11pt; font-family: \"Lucida Sans Unicode\", \"Lucida Grande\", sans-serif; text-rendering: optimizeLegibility;'><center><div id='authCont' style='min-width: 820px; margin: 5px 100px 5px 100px; text-align:left;'><form method=POST style='display:inline;' action='javascript: submission();'><div style='display: inline; font-size: 11pt;'><label for='id_username'>NERSC Username </label><input style='height: 20px; background:#fff; color: #000000;' id='id_username' type='text' name='username' maxlength='30' /></div><div style='display: inline; margin: 0 5px 0 7px; font-size: 11pt;'><label for='id_password'>NERSC Password </label><input style='height:20px; background:#fff; color: #000000;' type='password' name='password' id='id_password'/></div><input style='display:inline; padding:2px 7px; font-size:12px;color:#444;background-color:#eee;background-image:-webkit-gradient(linear, 0 0, 0 100%,color-stop(0, #fff),color-stop(0.05, #eee),color-stop(1, #bbb));background-image:-moz-linear-gradient(-90deg,#fff 0%, #eee 5%, #bbb 100%);text-shadow:0 1px 0 #f6f6f6; -webkit-border-radius:2px;-moz-border-radius:2px;border:1px solid #888;  -webkit-box-shadow:0 1px 2px rgba(0,0,0,0.3);-moz-box-shadow:0 1px 2px rgba(0,0,0,0.3);' type='submit' value='Login'></form><input style='display:inline; padding:2px 7px; font-size:12px;color:#444;background-color:#eee;background-image:-webkit-gradient(linear, 0 0, 0 100%,color-stop(0, #fff),color-stop(0.05, #eee),color-stop(1, #bbb));background-image:-moz-linear-gradient(-90deg,#fff 0%, #eee 5%, #bbb 100%);text-shadow:0 1px 0 #f6f6f6; -webkit-border-radius:2px;-moz-border-radius:2px;border:1px solid #888;-webkit-box-shadow:0 1px 2px rgba(0,0,0,0.3);-moz-box-shadow:0 1px 2px rgba(0,0,0,0.3);' id='cancel' type='submit' value='Cancel' onClick='vanishBox();'><div id='newt_auth_load' style='display:inline; padding:0px 10px 0px 10px;'><img src='https://newt.nersc.gov/images/ajax-loader-1.gif'> Authenticating</div></div></center></div>");
        $('body').css('margin-top', '0');
        $('#topAuth').hide();
            
        check_status();

        

    	
        
});

/*
 * jQuery Color Animations
 * Copyright 2007 John Resig
 * Released under the MIT and GPL licenses.
 */

(function(jQuery){

	// We override the animation for all of these color styles
	jQuery.each(['backgroundColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'borderTopColor', 'color', 'outlineColor'], function(i,attr){
		jQuery.fx.step[attr] = function(fx){
			if ( fx.state == 0 ) {
				fx.start = getColor( fx.elem, attr );
				fx.end = getRGB( fx.end );
			}

			fx.elem.style[attr] = "rgb(" + [
				Math.max(Math.min( parseInt((fx.pos * (fx.end[0] - fx.start[0])) + fx.start[0]), 255), 0),
				Math.max(Math.min( parseInt((fx.pos * (fx.end[1] - fx.start[1])) + fx.start[1]), 255), 0),
				Math.max(Math.min( parseInt((fx.pos * (fx.end[2] - fx.start[2])) + fx.start[2]), 255), 0)
			].join(",") + ")";
		}
	});

	// Color Conversion functions from highlightFade
	// By Blair Mitchelmore
	// http://jquery.offput.ca/highlightFade/

	// Parse strings looking for color tuples [255,255,255]
	function getRGB(color) {
		var result;

		// Check if we're already dealing with an array of colors
		if ( color && color.constructor == Array && color.length == 3 )
			return color;

		// Look for rgb(num,num,num)
		if (result = /rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)/.exec(color))
			return [parseInt(result[1]), parseInt(result[2]), parseInt(result[3])];

		// Look for rgb(num%,num%,num%)
		if (result = /rgb\(\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*\)/.exec(color))
			return [parseFloat(result[1])*2.55, parseFloat(result[2])*2.55, parseFloat(result[3])*2.55];

		// Look for #a0b1c2
		if (result = /#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/.exec(color))
			return [parseInt(result[1],16), parseInt(result[2],16), parseInt(result[3],16)];

		// Look for #fff
		if (result = /#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])/.exec(color))
			return [parseInt(result[1]+result[1],16), parseInt(result[2]+result[2],16), parseInt(result[3]+result[3],16)];

		// Otherwise, we're most likely dealing with a named color
		return colors[jQuery.trim(color).toLowerCase()];
	}
	
	function getColor(elem, attr) {
		var color;

		do {
			color = jQuery.curCSS(elem, attr);

			// Keep going until we find an element that has color, or we hit the body
			if ( color != '' && color != 'transparent' || jQuery.nodeName(elem, "body") )
				break; 

			attr = "backgroundColor";
		} while ( elem = elem.parentNode );

		return getRGB(color);
	};
	

})(jQuery);

function Get_Cookie( check_name ) {
	// first we'll split this cookie up into name/value pairs
	// note: document.cookie only returns name=value, not the other components
	var a_all_cookies = document.cookie.split( ';' );
	var a_temp_cookie = '';
	var cookie_name = '';
	var cookie_value = '';
	var b_cookie_found = false; // set boolean t/f default f

	for ( i = 0; i < a_all_cookies.length; i++ )
	{
		// now we'll split apart each name=value pair
		a_temp_cookie = a_all_cookies[i].split( '=' );


		// and trim left/right whitespace while we're at it
		cookie_name = a_temp_cookie[0].replace(/^\s+|\s+$/g, '');

		// if the extracted name matches passed check_name
		if ( cookie_name == check_name )
		{
			b_cookie_found = true;
			// we need to handle case where cookie has no value but exists (no = sign, that is):
			if ( a_temp_cookie.length > 1 )
			{
				cookie_value = unescape( a_temp_cookie[1].replace(/^\s+|\s+$/g, '') );
			}
			// note that in cases where cookie is initialized but no value, null is returned
			return cookie_value;
			break;
		}
		a_temp_cookie = null;
		cookie_name = '';
	}
	if ( !b_cookie_found )
	{
		return null;
	}
}
function Set_Cookie( name, value, expires, path, domain, secure )
{
    // set time, it's in milliseconds
    var today = new Date();
    today.setTime( today.getTime() );

    /*
    if the expires variable is set, make the correct
    expires time, the current script below will set
    it for x number of days, to make it for hours,
    delete * 24, for minutes, delete * 60 * 24
    */
    if ( expires )
    {
        expires = expires * 1000 * 60 * 60 * 24;
    }
    var expires_date = new Date( today.getTime() + (expires) );

    document.cookie = name + "=" +escape( value ) +
    ( ( expires ) ? ";expires=" + expires_date.toGMTString() : "" ) +
    ( ( path ) ? ";path=" + path : "" ) +
    ( ( domain ) ? ";domain=" + domain : "" ) +
    ( ( secure ) ? ";secure" : "" );
}


