//var visir = visir || { Transport:null};
//var visir.Transport = {};

var visir = visir || {};
visir.JSTransport = function(workingCallback)
{
	this._url = "";
	this._cookie = "nocookieforyou";
	this._isWorking = false;
	this._workCall = workingCallback;
	this._sessionKey = null;
}

/*
	If not authenticated, this will first try to get a session key from the server
	If that succeeds, it will send the request to the server, get a response and pass that back through the callback
	On error, throw an exception?
	
	request: instrument xml to transport
	callback: a function that takes a xml blob with reponse data
*/
visir.JSTransport.prototype.Request = function(request, callback)
{
	trace("Send request");
	if (this._isWorking) return;
	this.SetWorking(true);
	if (!this._IsAuthenticated()) {
		this._SendAuthentication(request, this._cookie, callback);
	}
	else
	{
		this._SendRequest(request, callback);
	}
}

/*
	func is a callback function that the transport system can call to make a new request
*/
visir.JSTransport.prototype.SetMeasureFunc = function(func)
{
	trace("SetMeasureFunc");
}

visir.JSTransport.prototype.Connect = function(url, cookie)
{
	trace("connecting: " + url + " " + cookie);
	this._url = url;
	this._cookie = cookie;
}

visir.JSTransport.prototype.SetWorking = function(xx,yy)
{
}

/*
	Add the protocol and request tags to the request and send it to the server
*/
visir.JSTransport.prototype._SendRequest = function(xmlstring, callback)
{
	trace("_SendRequest");
	var xmlstring = '<root><protocol version="1.3"><request>' + xmlstring + '</request></protocol></root>';
	var $req = $(xmlstring);
	if (this._sessionKey) $req.find("protocol > request").attr("sessionkey", this._sessionKey);
	
	var data = $req.html();
	trace(data);
	var tprt = this;
	this._SendXML(data, function(response) {
		trace("reponse: " + response);
		tprt.SetWorking(false, false);
		if (typeof callback == "function") callback(tprt._ReadResponseProtocolHeader(response));
	});
}

visir.JSTransport.prototype._AuthReadSessionKey = function(response)
{
	trace("_AuthReadSessionKey");
	var $xml = $(response);
	var sessionKey = $xml.find("login").attr("sessionkey");
	trace("AuthCallback session key: " + sessionKey);
	if (sessionKey) this._sessionKey = sessionKey;
}

visir.JSTransport.prototype._ReadResponseProtocolHeader = function(response)
{
	var $xml = $(response);	
	return $xml.html(); // this will strip of the outer protocol tags
}


visir.JSTransport.prototype._SendAuthentication = function(request, cookie, callback)
{
	trace("_SendAuthentication");
	var xml = '<protocol version="1.3"><login keepalive="1" cookie="' + cookie + '"/></protocol>';
	var tprt = this;
	this._SendXML(xml, function(response) {
		tprt._AuthReadSessionKey(response);
		// make sure everything went well..
		tprt._SendRequest(request, callback);
	});
}

/*
* XXX: I can't find a way to make sure that requests are pipelined in the same connection to the webserver
*/
visir.JSTransport.prototype._SendXML = function(data, callback)
{
	// for some reason the jquery post doesn't work as it should, try again in the future.
	if (window.XDomainRequest) {
		// ie..
		var req = new window.XDomainRequest();
		req.onload = function() { trace("xdomain: " + req.responseText); };
		req.open('POST', this._url, true);
		req.send(data);

	} else {
		var req = new XMLHttpRequest();
		req.open('POST', this._url, true);
		req.onerror = function(e) { trace("XMLHttpRequest error: " + e); throw e; }
		req.onreadystatechange = function(response)
		{
			if (req.readyState != 4) return;
			if (req.status != "200" && req.status != "304") throw "unexpected request return status";
			trace("XMLHttpRequest response: " + req.responseText);
			callback(req.responseText);
		};
		req.send(data);
	}
}

visir.JSTransport.prototype._IsAuthenticated = function()
{
	return (this._sessionKey != null);
}

function CreateXDomainChannel(ondata, onerror)
{
	
}


/*(function(namespace) {
	var fn = visir.JSTransport.prototype;
	
	fn.Connect = function(url) {
		
	}
	
})(visir.JSTransport);
*/