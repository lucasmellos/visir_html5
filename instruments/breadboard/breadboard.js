

var visir = visir || {};

function snapPoint(p)
{
	p.x += 6; p.y += 6;
	p.x = p.x - (p.x % 13);
	p.y = p.y - (p.y % 13);
	p.x -= 5;
	p.y += 3;
}

function toBoardCoords(p)
{
	p.x = p.x / 13 | 0;
	p.y = p.y / 13 | 0;
}

//////////////////////////////////////////////////////////////////////////////
// Point

visir.Point = function(x,y)
{
	this.x = x || 0;
	this.y = y || 0;
}

visir.Point.prototype.SnapToGrid = function()
{
	this.x += 6; this.y += 6;
	this.x = this.x - (this.x % 13);
	this.y = this.y - (this.y % 13);
	this.x -= 5;
	this.y += 3;
}

visir.Point.prototype.toString = function()
{
	return "(x: " + this.x + " y: " + this.y + ")";
}

//////////////////////////////////////////////////////////////////////////////
// Wire

visir.Wire = function(color)
{
	this._color = color;
	this._lineWidth = 3.4;
	this._start = new visir.Point();
	this._end = new visir.Point();
	this._mid = new visir.Point();
}

visir.Wire.prototype.SetBentPoints = function(start, end)
{
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
		
	this.SetPoints(start, mid, end);
}

visir.Wire.prototype.SetPoints = function(start, mid, end)
{
	this._start = start;
	this._mid = mid;
	this._end = end;
}

visir.Wire.prototype.Draw = function(context)
{
	this._RawDraw(context, this._color, this._lineWidth);
}

visir.Wire.prototype.DrawShadow = function(context, color, width)
{
	var diff = { x: this._end.x - this._start.x, y: this._end.y - this._start.y };
	var len = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
		
	var scale = 20.0;
	var midx = this._mid.x + len / scale;
	var midy = this._mid.y + len / scale;
	
	context.save();
	
	context.shadowBlur=7;
	context.shadowColor="black";
	context.lineCap = 'round';
	context.strokeStyle = 'rgba(0,0,0,0.2)';
	context.lineWidth   = width-1;
	context.beginPath();
	context.moveTo(this._start.x, this._start.y);
	 // +1 is for avoiding having same start and end, which leads to no painting at all
	context.quadraticCurveTo(midx, midy, this._end.x+1, this._end.y);
	context.stroke();
	context.closePath();

	context.restore();
}


visir.Wire.prototype._RawDraw = function(context, color, width)
{	
	context.lineCap = 'round';
	context.strokeStyle = color;
	context.lineWidth   = width;
	context.beginPath();
	context.moveTo(this._start.x, this._start.y);
	 // +1 is for avoiding having same start and end, which leads to no painting at all
	context.quadraticCurveTo(this._mid.x, this._mid.y, this._end.x+1, this._end.y);
	context.stroke();
	context.closePath();
}

//////////////////////////////////////////////////////////////////////////////
// Grid

// Ocuppation grid for the bin (to know which positions are available)
visir.Grid = function(componentList, $bin) {
    var me = this;

    // Being true = "available", and false = "busy"
    this._grid = [
        // row 0 (y=0): [ true, true, true ... ],
        // row 1 (y=1): [ true, true, true ... ],
    ];

    this._rows = 7;
    this._cols = 54;

    for(var y = 0; y < this._rows; y++) {
        var rowOccupation = [];
        for(var x = 0; x < this._cols; x++)
            rowOccupation.push(true);
        this._grid.push(rowOccupation);
    }

    var bin_position = $bin.position();
    var bin_left = bin_position.left;
    var bin_top  = bin_position.top;

    $(componentList).each(function(pos, component) {
        var position = component._$elem.position();
        var relative_top  = Math.floor((position.top  - bin_top  - 5 + parseInt(component.translation.y)) / 13);
        var relative_left = Math.floor((position.left - bin_left - 5 + parseInt(component.translation.x)) / 13);

        // trace("Component found in: " + relative_top + ", " + relative_left);

        if(relative_top >= 0 && relative_top < me._rows && relative_left >= 0 && relative_left < me._cols) {
            for(var x = relative_left; x < relative_left + component.widthInPoints(); x++) 
                for(var y = relative_top; y < relative_top + component.heightInPoints(); y++) {
                    me._set(x,y, false);
//                    trace("Marking busy..." + x + "; " + y);
                }
        }
    });
}

visir.Grid.prototype._get = function(x, y)
{
    // trace("Attempting " + x + ", " + y);
    return this._grid[y][x];
}

visir.Grid.prototype._set = function(x, y, value)
{
    // trace("Attempting " + x + ", " + y);
    this._grid[y][x] = value;
}


visir.Grid.prototype._FindSlot = function(height, width) 
{
    for (var x = 0; x <= this._cols - width; x++) { // x = 0 .. ~54
        for (var y = 0; y <= this._rows - height; y++) { // y = 0 .. ~7
            if (this._get(x, y)) {
                var potentialHole = true;
                for (var x2 = x; x2 < this._cols && x2 < x + width && potentialHole; x2++) {
                    for (var y2 = y; y2 < this._rows && y2 < y + height && potentialHole; y2++) {
                        // trace(" " + x2 + " " + y2);
                        // trace(this._grid);
                        if (!this._get(x2, y2))
                            potentialHole = false;
                    }
                }
                if (potentialHole)
                    return { 'x' : x, 'y' : y };
            }
        }
    }

    return { 'x' : 0, 'y' : 0 };
}


//////////////////////////////////////////////////////////////////////////////
// Component

// Component container
visir.Component = function($elem, breadboard)
{
	this._$elem        = $elem;
	this._breadboard   = breadboard;
	this._$circle      = null;
	this._current_step = 0;
	this.translation   = { 'x' : 0, 'y' : 0 };
	this.translations  = [];
	this._pins = []; // one entry per rotation, each entry contains an array of points with offsets to where each pin is located
}

visir.Component.prototype.width = function() 
{
    return this._$elem.find('.active').width();
}

visir.Component.prototype.height = function() 
{
    return this._$elem.find('.active').height();
}

visir.Component.prototype.heightInPoints = function()
{
    return Math.ceil(this.height() / 13);
}

visir.Component.prototype.widthInPoints = function()
{
    return Math.ceil(this.width() / 13);
}

visir.Component.prototype.remove = function() 
{
	this._RemoveCircle();
	this._$elem.remove();
	this._breadboard._RemoveComponent(this);
}

visir.Component.prototype._RemoveCircle = function() 
{
	this._breadboard._selectedCompnent = null;
	if(this._$circle != null) {
		this._$circle.remove();
		this._$circle = null;
	}
}

visir.Component.prototype._PlaceInBin = function()
{
    var grid = this._breadboard._BuildOccupationGrid();

    var height = this.heightInPoints();
    var width  = this.widthInPoints();

    var availablePos = grid._FindSlot(height, width);
    var bin_position = this._breadboard._GetBin().position();

    // TODO: Take into account: this.translation.rot
    var new_left = availablePos.x * 13 + bin_position.left + 5 - parseInt(this.translation.x);
    var new_top  = availablePos.y * 13 + bin_position.top  + 5 - parseInt(this.translation.y);

    // trace("Available position found: [x=" + availablePos.x + ", y=" + availablePos.y + "] (which is [" + new_left + ", " + new_top + "])");

    this._$elem.css({
        "left" : new_left,
        "top"  : new_top,
    });
}

visir.Component.prototype.Rotate = function(step)
{
	if(step == undefined) {
		step = this._current_step + 1;
	}

	var $imgs = this._$elem.find("img");
	if (step >= $imgs.length) step = step % $imgs.length;
	// trace("step: " + step);
	var idx = 0;
	var currentImage = null;
	$imgs.each(function() {
		if (idx == step) {
			$(this).addClass("active");
			currentImage = $(this);
		} else {
			$(this).removeClass("active");
		}
		idx++;
	});
	this._current_step = step;
	this.translation   = this.translations[step];
	// trace("New translation: " + this.translation.x + "; " + this.translation.y);
}

visir.Component.prototype._AddCircle = function()
{
    var me = this;
		this._breadboard._selectedCompnent = this;

    // Placed here for math operations
    // var CIRCLE_SIZE    =  140;
    var CIRCLE_SIZE    =  this.width() + 100;
    var ICON_SIZE      =  40;

    // If the circle may be slightly bigger than the four 
    // corner icons, since circles don't have corners. This
    // constant establishes the level of overlap between the 
    // square that surrounds a circle and the square that
    // surrounds the icons. Example: establishing it to 0 
    // the circle will not overlap at all; establishing it to
    // 1 will overlap completely.
    var CIRCLE_OVERLAP =  0.4;

    // Where is the component?
    var originalTop  = parseInt(this._$elem.css('top'),  10);
    var originalLeft = parseInt(this._$elem.css('left'), 10);

    // Where should be located inside the circle?
    var relativeTop  = this._$elem.height() / 2;
    var relativeLeft = this._$elem.width()  / 2;

    // Where should the whole circle be located?
    var newTop       = originalTop  - relativeTop;
    var newLeft      = originalLeft - relativeLeft;

    // Later they are removed
    var $parentNode = this._$elem.parent();
    // this._$elem.remove();

    // Overall block
    this._$circle = $('<span class="componentcircle"></span>');
    this._$circle.width(CIRCLE_SIZE);
		this._$circle.height(CIRCLE_SIZE);
    var transform = 'translate(-' + (CIRCLE_SIZE / 2) + 'px,-' + (CIRCLE_SIZE / 2) + 'px)';
    this._$circle.css({
        'position'  : 'absolute',
        'top'       : newTop + 'px',
        'left'      : newLeft + 'px',
        'transform' : transform,
        '-moz-transform' : transform,
        '-webkit-transform' : transform
    });

    // Circle
    //var $circleImg = $('<img src="instruments/breadboard/images/empty_circle.png"/>');
		var $circleImg = $('<div class="circle" />');
    $circleImg.width(CIRCLE_SIZE - 2 * (1 - CIRCLE_OVERLAP) * ICON_SIZE);
    $circleImg.height(CIRCLE_SIZE - 2 * (1 - CIRCLE_OVERLAP) * ICON_SIZE);
    $circleImg.css({
        'position' : 'absolute',
        'left'     : (1 - CIRCLE_OVERLAP) * ICON_SIZE,
        'top'      : (1 - CIRCLE_OVERLAP) * ICON_SIZE
    });
    this._$circle.append($circleImg);

    // Trash button
    // http://openclipart.org/detail/68/trash-can-by-andy
    var $trashImg = $('<img src="instruments/breadboard/images/trash.png"/>');
    $trashImg.width(ICON_SIZE);
    $trashImg.height(ICON_SIZE);
    $trashImg.css({
        'position' : 'absolute',
        'left'     : 0,
        'top'      : CIRCLE_SIZE - ICON_SIZE
    })
    $trashImg.click(function() {
        me.remove();
    });
    this._$circle.append($trashImg);

    // Rotation button
    // Public domain
    // http://openclipart.org/detail/33685/tango-view-refresh-by-warszawianka
    var $rotateImg = $('<img src="instruments/breadboard/images/rotate.png"/>');
    $rotateImg.width(ICON_SIZE);
    $rotateImg.height(ICON_SIZE);
    $rotateImg.css({
        'position' : 'absolute',
        'left'     : CIRCLE_SIZE - ICON_SIZE,
        'top'      : CIRCLE_SIZE - ICON_SIZE
    });
    $rotateImg.click(function() {
        me.Rotate();

				// XXX: a bit to fancy to rotate the icon, disabled for now
        /*$rotateImg.animate({'rotation' : '+=360'}, {
            step : function(now, fx){
                var currentRotation  = 'rotate(' + (now % 360) + 'deg)';
                $rotateImg.css({
                    'transform'         : currentRotation,
                    '-moz-transform'    : currentRotation,
                    '-webkit-transform' : currentRotation,
                });
            },
            duration : 'slow'
        });
				*/
    });
    this._$circle.append($rotateImg);

    // Drag and drop button
    // XXX Gentleface; CC Attribution-NonCommercial 3.0
    // http://www.softicons.com/free-icons/toolbar-icons/black-wireframe-toolbar-icons-by-gentleface/cursor-hand-icon
    // http://www.softicons.com/free-icons/toolbar-icons/black-wireframe-toolbar-icons-by-gentleface/cursor-drag-hand-icon
    var $dragImg = $('<img src="instruments/breadboard/images/drop.png" />');
    $dragImg.width(ICON_SIZE);
    $dragImg.height(ICON_SIZE);
    $dragImg.css({
        'position' : 'absolute',
        'left'     : CIRCLE_SIZE - ICON_SIZE,
        'top'      : 0
    });
    this._$circle.append($dragImg);

    $parentNode.append(this._$circle);

    var handler = this.generateHandler(this._$circle, function() {
        // On clicked
        me._RemoveCircle();
    }, this._$elem, function() {
        $dragImg.attr("src", "instruments/breadboard/images/drag.png");
    }, function () {
        $dragImg.attr("src", "instruments/breadboard/images/drop.png");
    })

    $circleImg.on("mousedown touchstart", handler);
    $dragImg.on("mousedown touchstart", handler);
}

visir.Component.prototype.GenCircuitIfUsed = function()
{
	var out = this._type + "_X";
	
	var rot = this._current_step;
	var pins = this._pins[rot];
	if (pins.length == 0) return null; // assert?
	
	for(var i = 0; i< pins.length; i++) {
		var p = this._breadboard._GetNodeName(this._GetPinPoint(pins[i]));
		if (!p) return null;
		out += " " + p;
	}
	return out + " " + this._value + "\n";
}

visir.Component.prototype._GetPinPoint = function(p)
{
	var mx = parseInt(this._$elem.css('left'));
	var my = parseInt(this._$elem.css('top'));	
	//trace("mx/y: " + mx + " " + my + "-" + p);
	return new visir.Point(mx + p.x, my + p.y);
}

//////////////////////////////////////////////////////////////////////////////
// Breadboard

var debugbb;

visir.Breadboard = function(id, $elem)
{
	var me = this;
	debugbb = this;
	this._$elem = $elem;
	this._$library = null;
	this._components = [];
	this._wires = [];
	this._instruments = [];
	this._selectedWire = null; // index in _wires
	this._selectedCompnent = null;
	
	this.IMAGE_URL = "instruments/breadboard/images/";
	
	var tpl = '<div class="breadboard">\
	<img class="background" src="instruments/breadboard/breadboard.png" alt="breadboard"/>\
	<div class="clickarea"></div>\
	<div class="bin">\
    	<div class="teacher">+</div>\
	</div>\
	<div class="colorpicker">\
		<div class="color red"></div>\
		<div class="color black"></div>\
		<div class="color green"></div>\
		<div class="color yellow"></div>\
		<div class="color blue"></div>\
		<div class="color brown"></div>\
	</div>\
	<div class="delete"></div>\
	<div class="components"></div>\
	<div class="instruments">\
		<div class="left"></div>\
	</div>\
	<canvas id="wires" width="715" height="450"></canvas>\
	<div id="wire_start" class="wirepoint start" />\
	<div id="wire_mid" class="wirepoint mid" />\
	<div id="wire_end" class="wirepoint end" />\
	<div class="componentbox">\
        <div class="componentlist">\
            <table class="componentlist-table">\
            </table>\
        </div>\
        <div class="componentbutton">\
            <button>Close</button>\
        </div>\
    </div>\
	</div>';
	
	//tpl += '<div id="debug"></div>'
		
	$elem.append(tpl);
	
	var $wires = $elem.find("#wires");
	var wires_offset = $wires.offset();
	var offset = { x: wires_offset.left, y: wires_offset.top };
	var $doc = $(document);
	var context = $wires[0].getContext('2d');
	this._wireCtx = context;
	this._$wires = $wires;
	var $click = $elem.find(".clickarea");
	
	// create offsceen canvas for wire picking
	var offscreen_canvas = document.createElement('canvas');
	offscreen_canvas.width = $wires.width();
	offscreen_canvas.height = $wires.height();
	this._offWireCtx = offscreen_canvas.getContext('2d');
	//document.getElementById("debug").appendChild(offscreen_canvas);

 // TODO: make it configurable (argument?)
	var teacher_mode = (visir.Config) ? visir.Config.Get("teacher") : true;
	if(!teacher_mode) $elem.find(".teacher").hide();

    $elem.find(".teacher").click(function(e) {
        $elem.find(".componentbox").show();
        var $components = me._$library.find("component").each(function() {
            var img   = $(this).find("rotation").attr("image");
            var type  = $(this).attr("type");
            var value = $(this).attr("value");
						var img_html = '<tr class="component-list-row">\
							<td>\
								<img src="instruments/breadboard/images/' + img + '"/>\
							</td>\
							<td>' + type + '</td>\
							<td>' + value + '</td>\
							</tr>';
            $elem.find(".componentlist-table").append(img_html);

            $($elem.find('.component-list-row').get(-1)).click(function(e){
                var comp_obj = me.CreateComponent(type, value);
                comp_obj._PlaceInBin();
            });
        });
    });

    $elem.find(".componentbutton button").click(function(e) {
        $elem.find(".componentbox").hide();
    });

	
	$click.on("mousedown touchstart", function(e) {
		if (!me._color) {
			// do picking against the wires
			
			// don't care if we got more than one touch
			// we can probably do something smarter here, to avoid problems when scrolling etc.
			if (e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
			
			var touch = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
			var start = new visir.Point(touch.pageX - offset.x, touch.pageY - offset.y);
			var idx = me._PickWire(start.x, start.y);
			if (idx !== null) {
				e.preventDefault();
				me.SelectWire(idx);
				return;
			}
			
			// nothing was picked
			// XXX: should deselect component if selected
			me.SelectWire(null);
			me.SelectComponent(null);

			return;
		}
		//trace("mouse down");
		e.preventDefault();
		
		// Draw new wire
		var nWire = new visir.Wire(me._color); // XXX: replace with CreateWire
		me._wires.push(nWire);
		
		e = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
		var start = new visir.Point(e.pageX - offset.x, e.pageY - offset.y);
		start.SnapToGrid();
		
		$click.on("mousemove.rem touchmove.rem", function(e) {
			e = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
			var end = new visir.Point(e.pageX - offset.x, e.pageY - offset.y);
			end.SnapToGrid();
			
			nWire.SetBentPoints(start, end);
			me._DrawWires();

			//trace("move")
		});
		
		$doc.on("mouseup.rem touchend.rem", function(e) {
			trace("mouseup");
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
		me.SelectWire(null);
	});
	
	$elem.find(".delete").click( function() {
		if (me._selectedWire === null) return;
		me._RemoveWire(me._wires[me._selectedWire]);
		me.SelectWire(null);
	});
	
	
	function GenWirePointMove(snap, assign)
	{
		return function($elem, x, y) {
			if (me._selectedWire === null) return;
				var p = new visir.Point(x, y);
				if (snap) p.SnapToGrid();
				assign(p);
				me._DrawWires();
				return {x: p.x - $elem.width() / 2, y: p.y - $elem.height() / 2};
		}
	}
			
	$elem.find("#wire_start").draggable( {
		move: GenWirePointMove(true, function(p) { me._wires[me._selectedWire]._start = p; } )
	});
	
	$elem.find("#wire_mid").draggable( {
		move: GenWirePointMove(false, function(p) { me._wires[me._selectedWire]._mid = p; } )
	});
	
	$elem.find("#wire_end").draggable( {
		move: GenWirePointMove(true, function(p) { me._wires[me._selectedWire]._end = p; } )
	});
		
	me._ReadLibrary("instruments/breadboard/library.xml");
	
	me._AddMultimeters(1 + 13*45,8 + 13*22,2);
	me._AddOSC(1 + 13*45, 8 + 13 * 16, 1);
	me._AddGND(1 + 13*45, 8 + 13 * 30);
	me._AddDCPower(0, 6+13*5, 2);
	me._AddFGEN(0, 6+13*16, 2);
}

visir.Breadboard.prototype._PickWire = function(x, y)
{
	var pickWidth = 10;
	this._offWireCtx.clearRect(0,0, this._$wires.width(), this._$wires.height());
	for(var i=0;i<this._wires.length; i++)
	{
		this._wires[i]._RawDraw(this._offWireCtx, 'rgba(' + (i+1) + ', 0, 0, 1)', pickWidth);
	}
	var c = this._offWireCtx.getImageData(x, y, 1, 1).data;
	trace("c: " + c[0] + " " + c[1] + " " + c[2] + " " + c[3]);
	var r = c[0] - 1;
	
	/*for(var i=0;i<this._wires.length; i++)
	{
		this._wires[i].Draw(this._offWireCtx);
	}
	
	this._offWireCtx.strokeStyle = "#ff0000";
	this._offWireCtx.lineWidth = 1;
	this._offWireCtx.beginPath();	
	this._offWireCtx.arc(x, y, 2, 0, Math.PI*2, true);
	this._offWireCtx.closePath();
	this._offWireCtx.stroke();
	*/
	
	return (r >= 0) ? r : null;
}

visir.Breadboard.prototype._DrawWires = function()
{
	this._wireCtx.clearRect(0,0, this._$wires.width(), this._$wires.height());
	
	// draw outline if selected
	/*this._wireCtx.save();
	if (this._selectedWire !== null) {
		this._wires[this._selectedWire]._RawDraw(this._wireCtx, "#000", 5);
	}
	this._wireCtx.restore();
	*/
	
	for(var i=0;i<this._wires.length; i++)
	{
		this._wires[i].DrawShadow(this._wireCtx, "#000", 5);
	}
	
	for(var i=0;i<this._wires.length; i++)
	{
		if (this._selectedWire === i) continue;
		this._wires[i].Draw(this._wireCtx);
	}
	
	// always draw the selected wired on top
	this._wireCtx.save();
	if (this._selectedWire !== null) {
		this._wires[this._selectedWire]._RawDraw(this._wireCtx, "#000", 5);
		this._wires[this._selectedWire].Draw(this._wireCtx);
	}
	this._wireCtx.restore();	
	
}

visir.Breadboard.prototype.SelectWire = function(idx)
{
	trace("selected wire: " + idx);
	this._selectedWire = idx;
	this._DrawWires();
	
	if (idx === null) {
		this._$elem.find(".wirepoint").removeClass("enabled");
		this._$elem.find(".delete").removeClass("enabled");
		return;
	}
	
	this._$elem.find(".wirepoint").addClass("enabled");
	this._$elem.find(".delete").addClass("enabled");
	
	function UpdatePoint($e, p) {
			var x = p.x - $e.width() / 2;
			var y = p.y - $e.height() / 2;
			$e.css("left", x).css("top", y);
	}
	
	var w = this._wires[idx];
	UpdatePoint(this._$elem.find("#wire_start"), w._start);
	UpdatePoint(this._$elem.find("#wire_mid"), w._mid);
	UpdatePoint(this._$elem.find("#wire_end"), w._end);
}

visir.Breadboard.prototype.SelectComponent = function(comp)
{
	if (this._selectedCompnent) this._selectedCompnent._RemoveCircle();
}

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
			me._$library = $(xml);
		}
	});
}

visir.Breadboard.prototype.CreateComponent = function(type, value)
{
	var BASE_URL = "instruments/breadboard/images/";
	
	var me = this;
	var $libcomp = this._$library.find('component[type="'+ type+'"][value="'+ value+ '"]');
	var $comp = $('<div class="component"></div>');
	var comp_obj = new visir.Component($comp, me);

	//XXX: should be in ctor
	comp_obj._type = type;
	comp_obj._value = value;
	
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
			'transform': transform,
			'-moz-transform': transform,
			'-webkit-transform': transform,
//			, 'top': oy + 'px'
//			, 'left': ox + 'px'
		})
	
		var current_translation = { 'x' : ox, 'y' : oy, 'rot' : rot };
		comp_obj.translations.push(current_translation);
		trace("Adding " + ox + ", " + oy);
		if (idx == 0) {
			$img.addClass("active");
			comp_obj.translation = current_translation;
		}
		$comp.append($img);
		
		$(this).find("pin").each( function() {
			var x = parseInt($(this).attr("x"));
			var y = parseInt($(this).attr("y"));
			if (!comp_obj._pins[idx]) comp_obj._pins[idx] = [];
			comp_obj._pins[idx].push(new visir.Point(x,y));
		});		
		
		idx++;
	});
	
	me._components.push(comp_obj);
	me._AddComponentEvents(comp_obj, $comp);
	me._$elem.find(".components").append($comp);
	return comp_obj;
}

visir.Breadboard.prototype._AddComponentEvents = function(comp_obj, $comp)
{
	var me = this;
	var $doc = $(document);
	
	var offset = this._$elem.offset();
	
	var touches = 0;
    var initialTouchTime = 0;

    var generateHandler = function(component, callbackClicked, internalComponent, callbackPressed, callbackReleased) {
        return function(e) {
            e.preventDefault();

            initialTouchTime = new Date().getTime();

            touches = (e.originalEvent.touches) ? e.originalEvent.touches.length : 1;
            e = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
            //var start = { x: e.pageX - offset.x, y: e.pageY - offset.y};
            
            $doc.on("keypress.rem", function(e) {
                // trace("key: " + e.which);
                if (e.which == 114) // 'r'
                    comp_obj.Rotate();
            });

            $doc.on("keyup.rem", function(e){
                if(e.keyCode == 46)
                    comp_obj.remove();
            }) 

            $doc.on("mousemove.rem touchmove.rem", function(e) {
                if(callbackPressed != undefined)
                    callbackPressed();

                touches = (e.originalEvent.touches) ? e.originalEvent.touches.length : 1;
                var touch = (e.originalEvent.touches) ? e.originalEvent.touches[0] : e;
                

                var p = { x: touch.pageX - offset.left, y: touch.pageY - offset.top };
                snapPoint(p);
                //trace("move");
                component.css({
                    "left": p.x + "px",
                    "top": p.y + "px"
                });
                if(internalComponent != undefined) {
                    internalComponent.css({
                        "left": p.x + "px",
                        "top": p.y + "px"
                    });
                }
                
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
                    
                    comp_obj.Rotate(step);
                }
                
            });

            $doc.on("mouseup.rem touchend.rem", function(e) {
                trace("up: " + touches);
                if (touches > 1) {
                    touches--;
                    return;
                }

                var timeSincePressed = new Date().getTime() - initialTouchTime;
                trace("Time since pressed: " + timeSincePressed);
                if(timeSincePressed < 300) // Less than this time is considered a click
                    callbackClicked();

                if(callbackReleased != undefined)
                    callbackReleased();

                //if (e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
                component.off(".rem");
                $doc.off(".rem");
            });
        };
    };
	$comp.on("mousedown touchstart", generateHandler($comp, function() {
        // On clicked, add circle
        $(me._components).each(function() {
            this._RemoveCircle();
        });
        comp_obj._AddCircle();
    }));
    comp_obj.generateHandler = generateHandler;
}

visir.Breadboard.prototype._RemoveWire = function(wire)
{
	for (var i = 0; i < this._wires.length; i++) {
		if(this._wires[i] == wire) {
			this._wires.splice(i, 1);
			return;
		}
	}
}

visir.Breadboard.prototype._RemoveComponent = function(comp_obj)
{
	for (var i = 0; i < this._components.length; i++) {
		if(this._components[i] == comp_obj) {
			this._components.splice(i, 1);
			return;
		}
	}
}

visir.Breadboard.prototype._BuildOccupationGrid = function() 
{
    return new visir.Grid(this._components, this._GetBin());
}

visir.Breadboard.prototype._GetBin = function()
{
    return this._$elem.find(".bin");
}

visir.Breadboard.prototype.CreateInstr = function(instr_type, instr_name)
{
	var me = this;
	
	var newinstr = {
		_type: instr_type,
		_name: instr_name,
		_connections: [],		
		AddConnection: function(board_point, fixed_output) {
			//var p = new visir.Point(point.x / 13 | 0, point.y / 13 | 0);
			trace("adding to instr: " + board_point + " " + instr_type);
			this._connections.push( { _point: board_point, fixed: fixed_output, marked: false });
			return this;
		},
		GetNameAndMarkIfUsed: function(point) {
			trace("instr: " + this._type + " " + this._name + " " + point);
			for(var i=0;i<this._connections.length; i++) {
				trace("checking against: " + this._connections[i]._point);
				if (point.x == this._connections[i]._point.x && point.y == this._connections[i]._point.y) {
					this._connections[i].marked = true;
					return this._ConnectionName(i);
				}
			}
		},
		GenInstrIfUsed: function() {
			if (this._type == "0") return; // special case for 0/GND instruments
			
			// if any of the points are marked, generate the instrument string
			var isUsed = false;
			var conStr = "";
			for(var i=0;i<this._connections.length; i++) {
				conStr += " " + this._ConnectionName(i);
				if (this._connections[i].marked) {
					isUsed = true;
				}
			}
			if (isUsed) {
				return this._type + "_" + this._name + conStr + "\n";
			}
			return null;
		},
		ClearMarks: function() {
			for(var i=0;i<this._connections.length; i++) {
				this._connections[i].marked = false;
			}
		},
		_ConnectionName: function(i) {
			if (this._connections[i].fixed) return this._connections[i].fixed;
			return this._type + "_" + this._name + "_" + (i+1);
		}
	};
	this._instruments.push(newinstr);
	return newinstr;
}

visir.Breadboard.prototype._GetAndMarkInstrNodeName = function(p)
{
	for(var i=0;i<this._instruments.length;i++)
	{
		var r = this._instruments[i].GetNameAndMarkIfUsed(p);
		if (r) return r;
	}
	return null;
}

visir.Breadboard.prototype._GetNodeName = function(p)
{
	var px = p.x / 13 | 0;
	var py = p.y / 13 | 0;
	trace("px/y: " + px + " " + py);
	
	// upper half, vertical
	if (px >= 11 && px <= 42 && py >= 16 && py <= 20) {	return "A" + (px - 10);	}
	// lower half, vertical
	if (px >= 11 && px <= 42 && py >= 23 && py <= 27) {	return "F" + (px - 10);	}
	// horizontal rows
	if (px >= 13 && px <= 41 && py == 11 && (px % 6 != 0)) { return "X"; }
	if (px >= 13 && px <= 41 && py == 12 && (px % 6 != 0)) { return "Y"; }
	if (px >= 13 && px <= 41 && py == 31 && (px % 6 != 0)) { return "S"; }
	if (px >= 13 && px <= 41 && py == 32 && (px % 6 != 0)) { return "T"; }
	
	var instrp = this._GetAndMarkInstrNodeName(new visir.Point(px, py));
	if (instrp) return instrp;
	
	return null;
}

visir.Breadboard.prototype._GenerateCircuit = function()
{
	for(var i=0; i < this._instruments.length; i++) {
		var r = this._instruments[i].ClearMarks();
	}
	
	var out = "";
	for (var i = 0; i < this._wires.length; i++) {
		var wire = this._wires[i];
		var s = this._GetNodeName(wire._start);
		var e = this._GetNodeName(wire._end);
		if (s && e) out += "W_X " + s + " " + e + "\n";
	}
	
	for(var i=0;i < this._components.length; i++) {
		var r = this._components[i].GenCircuitIfUsed();
		if (r) out += r;
	}
	
	for(var i=0; i < this._instruments.length; i++) {
		var r = this._instruments[i].GenInstrIfUsed();
		if (r) out += r;
	}
	
	return out;
}

visir.Breadboard.prototype.WriteRequest = function()
{
	var $xml = $('<circuit><circuitlist/></circuit>');
	$xml.find("circuitlist").append(this._GenerateCircuit());
	return $("<root />").append($xml).html();
}

//////////////////////////////////////////////////////////////////////////////
// Breadboard Instruments handling

visir.Breadboard.prototype._AddMultimeters = function(x, y, num)
{
	var i = 0;
	var $dmm = $('<div class="instrument dmm">\
	<table border="0" cellspacing="0" cellpadding="0">\
	<tr class="top"></tr>\
	<tr class="Vhi"></tr>\
	<tr class="Vlo"></tr>\
	<tr class="spacer"></tr>\
	<tr class="Ahi"></tr>\
	<tr class="Alo"></tr>\
	</table>\
	</div>');
	
	$dmm.css("left", x + "px").css("top", y + "px");
	
	var $top = $dmm.find("table tr.top");
	for(i=0;i<num; i++) {
		var n = (num > 1) ? i+1 : "&nbsp;";
		$top.append('<td class="cell">' + n + '</td>');
		$top.append('<td class="cell">&nbsp;</td>');
	}
	$top.append('<td class="">DMM</td>');
	
	var $Vhi = $dmm.find("table tr.Vhi");
	var $Vlo = $dmm.find("table tr.Vlo");
	for(i=0;i<num; i++) {
		$Vhi.append('<td class="cell" rowspan="2" ><img src="' + 	this.IMAGE_URL + 'connections_2.png" /></td>');
		if (i != num - 1) $Vhi.append('<td class="cell" rowspan="2">&nbsp;</td>');
	}
	$Vhi.append('<td>Hi</td><td rowspan="2">V/&Omega;</td>');
	$Vlo.append('<td>Lo</td>');
	
	var $Ahi = $dmm.find("table tr.Ahi");
	var $Alo = $dmm.find("table tr.Alo");
	for(i=0;i<num; i++) {
		$Ahi.append('<td class="cell" rowspan="2" ><img src="' + 	this.IMAGE_URL + 'connections_2.png" /></td>');
		if (i != num - 1) $Ahi.append('<td class="cell" rowspan="2">&nbsp;</td>');
	}
	$Ahi.append('<td>Hi</td><td rowspan="2">mA</td>');
	$Alo.append('<td>Lo</td>');	
	this._$elem.find(".instruments").append($dmm);
	
	for(i=0;i<num; i++) {
		var p = new visir.Point(x / 13 | 0, y / 13 | 0);
		var off_x = i * 2;
		this.CreateInstr("DMM", i+1).AddConnection(new visir.Point(p.x + off_x, p.y + 2)).AddConnection(new visir.Point(p.x + off_x, p.y + 3));
		this.CreateInstr("IPROBE", i+1).AddConnection(new visir.Point(p.x + off_x, p.y + 4)).AddConnection(new visir.Point(p.x + off_x, p.y + 5));
	}
}

visir.Breadboard.prototype._AddOSC = function(x, y, num)
{
	var $osc = $(
	'<div class="instrument osc">\
		<table border="0" cellspacing="0" cellpadding="0">\
			<tr class="top"></tr>\
			<tr class="ch1"></tr>\
			<tr class="spacer"></tr>\
			<tr class="ch2"></tr>\
		</table>\
	</div>');
	
	var $top = $osc.find("table tr.top"); // channel numbers
	$top.append('<td>&nbsp;</td>');
	
	var $ch1 = $osc.find("table tr.ch1");
	$ch1.append('<td class="cell"><img src="' + 	this.IMAGE_URL + 'connections_1.png" /></td>');
	$ch1.append('<td class="cell">Ch1</td>');
	$ch1.append('<td class="cell" rowspan="3">Oscilloscope</td>');
	
	var $ch2 = $osc.find("table tr.ch2");
	$ch2.append('<td class="cell"><img src="' + 	this.IMAGE_URL + 'connections_1.png" /></td>');
	$ch2.append('<td class="cell">Ch2</td>');
	
	
	$osc.css("left", x + "px").css("top", y + "px");
	this._$elem.find(".instruments").append($osc);
	
	var p = new visir.Point(x / 13 | 0, y / 13 | 0);
	this.CreateInstr("PROBE1", 1).AddConnection(new visir.Point(p.x, p.y + 2));
	this.CreateInstr("PROBE2", 1).AddConnection(new visir.Point(p.x, p.y + 4));
}

visir.Breadboard.prototype._AddGND = function(x, y)
{
	var $gnd = $(
	'<div class="instrument gnd">\
		<table border="0" cellspacing="0" cellpadding="0">\
		<tr class=""><td class="cell"><img src="' + 	this.IMAGE_URL + 'connections_1.png" /></td><td>GND</td></tr>\
		</table>\
	</div>');
	$gnd.css("left", x + "px").css("top", y + "px");
	this._$elem.find(".instruments").append($gnd);
	
	var p = new visir.Point(x / 13 | 0, (y / 13 | 0) + 1)
	this.CreateInstr("0").AddConnection(p, "0");
}

visir.Breadboard.prototype._AddDCPower = function(x, y, num)
{
	var $dcpower = $(
	'<div class="instrument dcpower">\
		<table border="0" cellspacing="0" cellpadding="0">\
			<tr class="top"></tr>\
			<tr class="p25v"></tr>\
			<tr class="com"></tr>\
			<tr class="m25v"></tr>\
			<tr class="spacer"></tr>\
			<tr class="p6v"></tr>\
			<tr class="gnd"></tr>\
		</table>\
	</div>');
	
	var $top = $dcpower.find("table tr.top"); // channel numbers
	$top.append('<td rowspan="7">DC Power Supply</td>');
	
	var $p25v = $dcpower.find("table tr.p25v");
	$p25v.append('<td class="cell">+25V</td>');
	$p25v.append('<td class="cell" rowspan="3"><img src="' + 	this.IMAGE_URL + 'connections_3.png" /></td>');
	
	var $com = $dcpower.find("table tr.com");
	$com.append('<td>COM</td>');
	
	var $m25v = $dcpower.find("table tr.m25v");
	$m25v.append('<td>-25V</td>');
	
	var $p6v = $dcpower.find("table tr.p6v");
	$p6v.append('<td>+6V</td>');
	$p6v.append('<td class="cell" rowspan="2"><img src="' + 	this.IMAGE_URL + 'connections_2.png" /></td>');
	
	var $gnd = $dcpower.find("table tr.gnd");
	$gnd.append('<td>GND</td>');
	
	$dcpower.css("right", x + "px").css("top", y + "px");
	this._$elem.find(".instruments .left").append($dcpower);
	
	var p = new visir.Point(x / 13 | 0, y / 13 | 0);
	var off_x = 8;
	var off_y = 9;

	this.CreateInstr("VDC+25V", "1").AddConnection( new visir.Point(p.x + off_x, p.y + off_y + 2));
	this.CreateInstr("VDCCOM", "1").AddConnection( new visir.Point(p.x + off_x, p.y + off_y + 3));
	this.CreateInstr("VDC-25V", "1").AddConnection( new visir.Point(p.x + off_x, p.y + off_y + 4));
	this.CreateInstr("VDC+6V", "1").AddConnection( new visir.Point(p.x + off_x, p.y + off_y + 6));
	this.CreateInstr("0").AddConnection(new visir.Point(p.x + off_x, p.y + off_y + 7), "0");
}

visir.Breadboard.prototype._AddFGEN = function(x, y, num)
{
	var $fgen = $(
	'<div class="instrument fgen">\
		<table border="0" cellspacing="0" cellpadding="0">\
			<tr class="top"></tr>\
			<tr class="FGEN"></tr>\
			<tr class="GND"></tr>\
		</table>\
	</div>');
	
	var $top = $fgen.find("table tr.top"); // channel numbers
	$top.append('<td>&nbsp;</td>');
	
	var $funcgen = $fgen.find("table tr.FGEN");
	$funcgen.append('<td class="cell">Function&nbsp;Generator</td>');
	$funcgen.append('<td class="cell" rowspan="2"><img src="' + 	this.IMAGE_URL + 'connections_2.png" /></td>');
	
	var $gnd = $fgen.find("table tr.GND");
	$gnd.append('<td class="cell">GND</td>');
	
	$fgen.css("right", x + "px").css("top", y + "px");
	this._$elem.find(".instruments .left").append($fgen);
	
	var p = new visir.Point(x / 13 | 0, y / 13 | 0);
	var off_x = 8;
	var off_y = 9;
	this.CreateInstr("VFGENA", 1).AddConnection( new visir.Point(p.x + off_x, p.y + off_y + 2)).AddConnection(new visir.Point(1000,1000),"0");
	this.CreateInstr("0").AddConnection(new visir.Point(p.x + off_x, p.y + off_y + 3), "0");
}
