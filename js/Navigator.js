var mindmaps = mindmaps || {};

mindmaps.NavigatorView = function() {
	var self = this;

	var $content = $("#navigator");
	var $contentActive = $content.children(".active").hide();
	var $contentInactive = $content.children(".inactive").hide();
	var $dragger = $("#navi-canvas-overlay");
	var $canvas = $("#navi-canvas");

	/**
	 * Returns a jquery object.
	 */
	this.getContent = function() {
		return $content;
	};

	this.showActiveContent = function() {
		$contentInactive.hide();
		$contentActive.show();
	};

	this.showInactiveContent = function() {
		$contentActive.hide();
		$contentInactive.show();
	};

	this.setDraggerSize = function(width, height) {
		$dragger.css({
			width : width,
			height : height
		});
	};

	this.setDraggerPosition = function(x, y) {
		$dragger.css({
			left : x,
			top : y
		});
	};

	this.setCanvasSize = function(width, height) {
		$("#navi-canvas").attr({
			width : width,
			height : height
		});
	};

	this.init = function(canvasSize) {
		$("#navi-buttons").children().button();

		$dragger.draggable({
			containment : "parent",
			start : function(e, ui) {
				if (self.dragStart) {
					self.dragStart();
				}
			},
			drag : function(e, ui) {
				if (self.dragging) {
					var x = ui.position.left;
					var y = ui.position.top;
					self.dragging(x, y);
				}
			},
			stop : function(e, ui) {
				if (self.dragStop) {
					self.dragStop();
				}
			}
		});
	};

	this.draw = function(mindmap, scaleFactor) {
		var root = mindmap.root;
		var canvas = $canvas[0];
		var width = canvas.width;
		var height = canvas.height;
		var ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, width, height);
		ctx.lineWidth = 1.8;

		drawNode(root, width / 2, height / 2);

		function scale(value) {
			return value / scaleFactor;
		}

		function drawNode(node, x, y) {
			ctx.save();
			ctx.translate(x, y);

			if (!node.collapseChildren) {
				node.forEachChild(function(child) {
					ctx.beginPath();
					ctx.strokeStyle = child.edgeColor;
					ctx.moveTo(0, 0);
					var posX = scale(child.offset.x);
					var posY = scale(child.offset.y);
					// var textWidth =
					// ctx.measureText(child.getCaption()).width;
					textWidth = 5;

					/**
					 * draw two lines: one going up to the node, and a second
					 * horizontal line for the node caption. if node is left of
					 * the parent (posX < 0), we shorten the first line and draw
					 * the rest horizontally to arrive at the node's offset
					 * position. in the other case, we draw the line to the
					 * node's offset and draw another for the text.
					 */
					if (posX < 0) {
						var firstStop = posX + textWidth;
						var secondStop = posX;
					} else {
						var firstStop = posX;
						var secondStop = posX + textWidth;
					}
					ctx.lineTo(firstStop, posY);
					ctx.lineTo(secondStop, posY);

					ctx.stroke();
					drawNode(child, secondStop, posY);
				});
			}
			ctx.restore();
		}
	};
};

mindmaps.NavigatorPresenter = function(eventBus, appModel, view, container) {
	var CANVAS_WIDTH = 250;
	var $container = container.getContent();
	var viewDragging = false;

	function calculateDraggerSize(canvasSize, docSize) {
		var cw = $container.width();
		var ch = $container.height();
		// doc.x / container.x = canvas.x / dragger.x
		var draggerWidth = (cw * canvasSize.x) / docSize.x;
		var draggerHeight = (ch * canvasSize.y) / docSize.y;

		view.setDraggerSize(draggerWidth, draggerHeight);
	}

	function calculateCanvasHeight(docSize) {
		var width = CANVAS_WIDTH;
		var scale = docSize.x / width;
		var height = docSize.y / scale;

		view.setCanvasSize(width, height);

		return new mindmaps.Point(width, height);
	}

	function calculateDraggerPosition(canvasSize, docSize) {
		var sl = $container.scrollLeft();
		var st = $container.scrollTop();

		// sl / dox = dl / cw
		// dl = sl * cw / dox
		var left = sl * canvasSize.x / docSize.x;
		var top = st * canvasSize.y / docSize.y;
		view.setDraggerPosition(left, top);
	}

	function documentOpened(doc) {
		var dimensions = doc.dimensions;
		var canvasSize = calculateCanvasHeight(dimensions);

		// scroll container when the dragger is dragged
		view.dragging = function(x, y) {
			var scrollLeft = dimensions.x * x / canvasSize.x;
			var scrollTop = dimensions.y * y / canvasSize.y;
			$container.scrollLeft(scrollLeft).scrollTop(scrollTop);
		};

		// move dragger when container was scrolled
		$container.bind("scroll.navigator-view", function() {
			if (!viewDragging) {
				calculateDraggerPosition(canvasSize, dimensions);
			}
		});

		// set dragger size when container was resized
		container.subscribe(mindmaps.CanvasContainer.Event.RESIZED, function() {
			calculateDraggerSize(canvasSize, dimensions);
		});

		calculateDraggerSize(canvasSize, dimensions);
		view.showActiveContent();

		// draw canvas
		var mindmap = doc.mindmap;
		var scale = dimensions.x / canvasSize.x;
		view.draw(mindmap, scale);

		// node events
		eventBus.subscribe(mindmaps.Event.NODE_MOVED, function() {
			view.draw(mindmap, scale);
		});

		eventBus.subscribe(mindmaps.Event.NODE_CREATED, function() {
			view.draw(mindmap, scale);
		});

		eventBus.subscribe(mindmaps.Event.NODE_DELETED, function() {
			view.draw(mindmap, scale);
		});
	}

	function documentClosed() {
		// clean up
		// remove listeners
		container.unsubscribe(mindmaps.CanvasContainer.Event.RESIZED);
		$container.unbind("scroll.navigator-view");

		eventBus.unsubscribe(mindmaps.Event.NODE_MOVED);
		eventBus.unsubscribe(mindmaps.Event.NODE_CREATED);
		eventBus.unsubscribe(mindmaps.Event.NODE_DELETED);

		view.showInactiveContent();
	}

	view.dragStart = function() {
		viewDragging = true;
	};

	view.dragStop = function() {
		viewDragging = false;
	};

	// document events
	eventBus.subscribe(mindmaps.Event.DOCUMENT_CREATED, function(doc) {
		documentOpened(doc);
	});

	eventBus.subscribe(mindmaps.Event.DOCUMENT_OPENED, function(doc) {
		documentOpened(doc);
	});

	eventBus.subscribe(mindmaps.Event.DOCUMENT_CLOSED, function(doc) {
		documentClosed();
	});

	this.go = function() {
		view.init();
	};
};