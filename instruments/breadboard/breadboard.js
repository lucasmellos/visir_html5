

var visir = visir || {};

function snapPoint(p)
{
	p.x += 6; p.y += 6;
	p.x = p.x - (p.x % 13);
	p.y = p.y - (p.y % 13);
	p.x -= 5;
	p.y += 3;
}

function drawWire(context, start, end, color)
{
	color = color || "#000000";
	// the point with largest x is the second point
	if (start.x > end.x) {
		var p1 = end;
		var p2 = start;
	}
	else {
		var p1 = start;
		var p2 = end;
	}

	var diff = { x: p2.x - p1.x, y: p2.y - p1.y };
	var cross = { x: diff.y, y: -diff.x };
	var scale = 5;
	cross.x /= scale;
	cross.y /= scale;
	
	var mid = { x: 0, y: 0 };
	mid.x = start.x + (end.x - start.x) / 2;
	mid.y = start.y + (end.y - start.y) / 2;
	mid.x += cross.x;
	mid.y += cross.y;
	
	context.lineCap = 'round';
	/*
	context.strokeStyle = '#000000';
	context.lineWidth   = 5;
	context.beginPath();
	context.moveTo(start.x, start.y);
	context.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
	context.stroke();
	context.closePath();
	*/
	
	context.strokeStyle = color;
	context.lineWidth   = 3.4;
	context.beginPath();
	context.moveTo(start.x, start.y);
	context.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
	context.stroke();
	context.closePath();
}

visir.Breadboard = function(id, $elem)
{
	//visir.Breadboard.parent.constructor.apply(this, arguments)
	
	var me = this;
	this._$elem = $elem;
	this._$library = null;
	
	var tpl = '<div class="breadboard">\
	<img class="background" src="instruments/breadboard/breadboard.png" alt="breadboard"/>\
	<div class="bin"></div>\
	<div class="clickarea"></div>\
	<div class="components"></div>\
	<canvas id="wires" width="715" height="450"></canvas>\
	<div class="colorpicker">\
		<div class="color red"></div>\
		<div class="color black"></div>\
		<div class="color green"></div>\
		<div class="color yellow"></div>\
		<div class="color blue"></div>\
		<div class="color brown"></div>\
	</div>\
	</div>';
		
	$elem.append(tpl);
	
	var $wires = $elem.find("#wires");
	var wires_offset = $wires.offset();
	var offset = { x: wires_offset.left, y: wires_offset.top };
	var $doc = $(document);
	var context = $wires[0].getContext('2d');
	var $click = $elem.find(".clickarea");
	
	$click.on("mousedown touchstart", function(e) {
		if (!me._color) return;
		//trace("mouse down");
		e.preventDefault();
		
		e = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
		var start = { x: e.pageX - offset.x, y: e.pageY - offset.y};
		//trace("start: " + start.x + " " + start.y);
		
		$click.on("mousemove.rem touchmove.rem", function(e) {
			e = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
			var end = { x: e.pageX - offset.x, y: e.pageY - offset.y };
			
			context.clearRect(0,0, $wires.width(), $wires.height());
			snapPoint(start);
			snapPoint(end);
			//trace("start2: " + start.x + " " + start.y);
			drawWire(context, start, end, me._color);

			//trace("move")
		});
		
		$doc.on("mouseup.rem touchend.rem", function(e) {
			$click.off(".rem");
			$doc.off(".rem");
			
			// deselect the color picker
			me._color = null;
			me._$elem.find(".color").removeClass("selected");
		});
	});
	
	$elem.find(".color").click( function() {
		me._color = $(this).css("background-color");
		me._$elem.find(".color").removeClass("selected");
		$(this).addClass("selected");
	});
	
	me._ReadLibrary("instruments/breadboard/library.xml");
}

//extend(visir.TripleDC, visir.DCPower)

visir.Breadboard.prototype._UpdateDisplay = function(ch)
{
}

visir.Breadboard.prototype._ReadLibrary = function(url)
{
	var me = this;
	$.ajax({
		type: "GET",
		url: url,
		dataType: "xml",
		async: true,
		success: function(xml) {
			trace("xml: " + xml);
			me._$library = $(xml);
			me.CreateComponent("D", "1N4002")
			//me.CreateComponent("R", "10k")
		}
	});
}

var BASE_URL = "instruments/breadboard/images/";

visir.Breadboard.prototype.CreateComponent = function(type, value)
{
	var me = this;
	var $libcomp = this._$library.find('component[type="'+ type+'"][value="'+ value+ '"]');
	var $comp = $('<div class="component"></div>');
	
	var idx = 0;
	
	$libcomp.find("rotation").each(function() {
		var imgtpl = '<img src="' + BASE_URL + $(this).attr("image") + '" alt="'+ type + value + '"/>';
		var $img = $(imgtpl);
		var rot = $(this).attr("rot");
		var ox = $(this).attr("ox");
		var oy = $(this).attr("oy");

		// fix weird library format..
		if (rot == 90 || rot == 270) {
			var tmp = ox;
			ox = oy;
			oy = tmp;
		}
		
		var transform = "";
		transform	+= ' translate(' + ox + 'px, ' + oy + 'px)';
		transform += ' rotate(' + rot + 'deg)';
				
		$img.css( {
			'transform': transform
			,'-moz-transform': transform
			,'-webkit-transform': transform
//			, 'top': oy + 'px'
//			, 'left': ox + 'px'
		})
		
		if (idx == 0) {
			$img.addClass("active");
		}
		$comp.append($img);
		idx++;
	});
	
	me._AddComponentEvents($comp);
	
	me._$elem.find(".components").append($comp);
}

visir.Breadboard.prototype._AddComponentEvents = function($comp)
{
	var me = this;
	var $doc = $(document);
	
	var offset = this._$elem.offset();

	$comp.on("mousedown touchstart", function(e) {
		e.preventDefault();
		e = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
		//var start = { x: e.pageX - offset.x, y: e.pageY - offset.y};
		
		$doc.on("keypress.rem", function(e) {
			trace("key: " + e.which);
			if (e.which == 114) { // r
				var $next = $comp.find("img.active").next();
				$comp.find("img").removeClass("active");
				if ($next.length > 0) {					
					$next.addClass("active");
				} else {
					$comp.find("img").first().addClass("active");
				}
			}
		});

		$doc.on("mousemove.rem touchmove.rem", function(e) {
			var touch = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;

			var p = { x: touch.pageX - offset.left, y: touch.pageY - offset.top };
			snapPoint(p);
			//trace("move");
			$comp.css({
				"left": p.x + "px",
				"top": p.y + "px"
			});
			
			// if two fingers are down, turn the component around towards the second finger
			if (e.originalEvent.touches && e.originalEvent.touches.length > 1) {
				var turn = e.originalEvent.touches[1];
				var angle = Math.atan2( touch.pageY - turn.pageY, touch.pageX - turn.pageX ) * 180 / Math.PI;
				angle = (angle + 360) % 360;
				var step = 0;
				if (angle < 45 || angle > 315) step = 0;
				else if (angle > 45 && angle < 135) step = 1;
				else if (angle >135 && angle < 225) step = 2;
				else step = 3;
				
				me._SetComponentRotation($comp, step);
			}
			
		});

		$doc.on("mouseup.rem touchend.rem", function(e) {
			$comp.off(".rem");
			$doc.off(".rem");
		});
	});
}

visir.Breadboard.prototype._SetComponentRotation = function($comp, step)
{
	var $imgs = $comp.find("img");
	//if ($imgs.length <= 2) step = step % 2;
	if (step >= $imgs.length) step = step % $imgs.length;
	trace("step: " + step);
	var idx = 0;
	$imgs.each(function() {
		if (idx == step) {
			$(this).addClass("active");
		} else {
			$(this).removeClass("active");
		}
		idx++;
	});
}












