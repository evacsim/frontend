var evacSim = new (function () {
	var gMap;
	var nodes;
	var ways;
	var nodeIdToIndex = {};
	var wayIdToIndex = [];

	var objs = [];
	var objMarkers = [];
	var wayLines = [];
	var nodeMarkers = [];

	var emptyObjIds = [];
	var eachStepFunc;
	var timer = null;

	var isInitialized = false;
	var objInitFuncs = [];

	var R_EARTH = 6378137; // 地球半径

// 設定
	var timeStep = 100;
	var nodesUrl = "a_star/nodes.cgi";
	var waysUrl = "a_star/ways.cgi";
//	var nodesUrl = "nodes.json";
//	var waysUrl = "ways.json";
	var mapCenterLat = 32.695528;
	var mapCenterLon = 128.840861;
	var domId = "map_canvas";


	function initGMap() {
		var mapOptions = {
			center: new google.maps.LatLng(mapCenterLat,mapCenterLon),
			zoom: 12,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		gMap = new google.maps.Map(document.getElementById(domId), mapOptions);
	}

	function initData() {
		// id→indexのハッシュを定義
		for (var i=0; i<nodes.length; i++) {
			nodeIdToIndex[nodes[i].id] = i;
		}
		console.log(nodeIdToIndex)

		// nodesに隣接ノードのプロパティを宣言
		for (var i=0; i<nodes.length; i++) {
			nodes[i].neighbors = [];
		}

		// 隣接ノードのidを追加
		var id1,id2,index1,index2,nodes_ids
		for (var i=0; i<ways.length; i++) {
			node_ids = ways[i].node_ids;
			for (var j=1; j<node_ids.length; j++) {
				id1 = node_ids[j-1];
				id2 = node_ids[j];
				if ((id1 in nodeIdToIndex) && (id2 in nodeIdToIndex)) {
					index1 = nodeIdToIndex[id1];
					index2 = nodeIdToIndex[id2];
					nodes[index2].neighbors[nodes[index2].neighbors.length] = id1;
					nodes[index1].neighbors[nodes[index1].neighbors.length] = id2;
				}
			}
		}

		console.log(nodes)
	}

	this.setTimeStep = function (_timeStep) {
		timeStep = _timeStep;
	}

	this.showWays = function () {
		var lineCoords, nodes_ids, id,index;
		for (var i=0; i<ways.length; i++) {
			lineCoords = [];
			node_ids = ways[i].node_ids;
			for (var j=0; j<node_ids.length; j++) {
				id = node_ids[j]
				if (id in nodeIdToIndex) {
					index = nodeIdToIndex[id];
					lineCoords[lineCoords.length] = new google.maps.LatLng(nodes[index].lat, nodes[index].lon);
				}
				
			}

			wayLines[i] = new google.maps.Polyline({
				path: lineCoords,
				strokeColor: "#ff0000",
				strokeOpacity: 1.0,
				strokeWeight: 2
			});

			wayLines[i].setMap(gMap);
		}
	};

	this.hideWays = function () {
		for (var i=0; i<ways.length; i++) {
			wayLines[i].setMap(null);
		}
		wayLines = [];
	};

	this.showNodes = function () {
		for (var i=0; i<nodes.length; i++) {
		//	nodeMarkers[i] = new google.maps.Marker({
		//		position: new google.maps.LatLng(nodes[i].lat, nodes[i].lon)
		//	});
			nodeMarkers[i] = new google.maps.Marker({
				position: new google.maps.LatLng(nodes[i].lat, nodes[i].lon)
			});
			nodeMarkers[i].setMap(gMap);

			nodeClicked = (function (id,lat,lon) {
				return function () {
					alert("node id: "+id+"\nlat: "+lat+"\nlon: "+lon);
				}
			})(nodes[i].id,nodes[i].lat,nodes[i].lon);
			google.maps.event.addListener(nodeMarkers[i], 'click', nodeClicked);
		}
	};

	this.hideNodes = function () {
		for (var i=0; i<nodes.length; i++) {
			nodeMarkers[i].setMap(null);
		}
		nodeMarkers = [];
	};

	function getNode(obj) {
		// try {		
		// 	// if (!isInitialized) {
		// 	// 	throw("初期化前に実行することは出来ません");
		// 	// }
		// 	if ((typeof obj == "string") || (typeof obj == "number")) { // 引数がidの場合
		// 		if (!(obj in nodeIdToIndex)) { throw(obj+"は無効なnodeIdです"); } // 無効なidの場合を除外
		// 		return nodes[nodeIdToIndex[obj]];
		// 	} else if (typeof obj == "object") {
		// 		if (!("getNodeId" in obj)) { throw(obj+"は無効なオブジェクトです"); }
		// 		if (!(obj.getNodeId() in nodeIdToIndex)) { throw("オブジェクトのnodeIdが未定義または無効です。"); }
		// 		return nodes[nodeIdToIndex[obj.getNodeId()]];
		// 	} else {
		// 		throw("無効な引数です");
		// 	}

		// } catch(errMsg) {
		// 	console.warn("Internal error in getNode(): " + errMsg);
		// 	return null;
		// }



		if ((typeof obj == "string") || (typeof obj == "number")) { // 引数がidの場合
			if (obj in nodeIdToIndex) {  // 無効なidの場合を除外
				return nodes[nodeIdToIndex[obj]];
			} else {
				return null;
			}
		} else if (typeof obj == "object") {
			if ("getNodeId" in obj) {
				if (obj.getNodeId() in nodeIdToIndex) {
					return nodes[nodeIdToIndex[obj.getNodeId()]];
				} else {
					return null;
				}
			} else {
				return null;
			}
		} else {
			return null;
		}

	}

	this.getNeighbors = function (obj) {
		var node = getNode(obj);
		if (node != null) {
			return node.neighbors.concat();
		} else {
			console.warn("getNeighbors(): nodeの取得に失敗");
			return [];
		}
	};

	this.getAlt = function (obj) {
		var node = getNode(obj);
		if (node != null) {
			return node.alt;
		} else {
			console.warn("getAlt(): nodeの取得に失敗");
			return 0;
		}
	};

	this.calcDistance = function (obj1,obj2) {
		var lat1,lon1,lat2,lon2;
		var dLat,dLon;

		try {
			if (!nodeIdToIndex) {
				throw("初期化前に実行することは出来ません");
			}

			if ((typeof obj1 == "string") || (typeof obj1 == "number")) { // 引数がidの場合
				if (!(obj1 in nodeIdToIndex)) { throw("第1引数のnodeIdは無効です"); } // 無効なidの場合を除外
				lat1 = nodes[nodeIdToIndex[obj1]].lat;
				lon1 = nodes[nodeIdToIndex[obj1]].lon;
			} else if (typeof obj1 == "object") { // 引数がオブジェクトの場合
				if ( (!("getLat" in obj1)) || (!("getLon" in obj1)) ) { throw("第1引数のオブジェクトは無効です"); } // lat、lonのプロパティがない場合を除外
				// lat1 = obj1.lat;
				// lon1 = obj1.lon;
				lat1 = obj1.getLat();
				lon1 = obj1.getLon();

			}
			if ((typeof obj2 == "string") || (typeof obj2 == "number")) { // 引数がidの場合
				if (!(obj2 in nodeIdToIndex)) { throw("第2引数のnodeIdは無効です"); } // 無効なidの場合を除外
				lat2 = nodes[nodeIdToIndex[obj2]].lat;
				lon2 = nodes[nodeIdToIndex[obj2]].lon;
			} else if (typeof obj2 == "object") { // 引数がオブジェクトの場合
				if ( (!("getLat" in obj2)) || (!("getLon" in obj2)) ) { throw("第2引数のオブジェクトは無効です"); } // lat、lonのプロパティがない場合を除外
				// lat2 = obj2.lat;
				// lon2 = obj2.lon;
				lat2 = obj2.getLat();
				lon2 = obj2.getLon();
			}

			dLat = lat2-lat1;
			dLon = lon2-lon1;
			return Math.sqrt(Math.pow(this.latToMeter(dLat),2)+Math.pow(this.lonToMeter(dLon),2) );

		} catch (errMsg) {
			console.warn("calcDistance(): "+errMsg);
			return 0;
		}
	};

	this.calcDirection = function (obj1,obj2) {
		var lat1,lon1,lat2,lon2;
		var vLat,vLon,nv;

		try {
			if (!nodeIdToIndex) {
				throw("初期化前にcalcDistanceを実行することは出来ません");
			}

			if ((typeof obj1 == "string") || (typeof obj1 == "number")) { // 引数がidの場合
				if (!obj1 in nodeIdToIndex) { throw("第1引数のnodeIdは無効です"); } // 無効なidの場合を除外
				lat1 = nodes[nodeIdToIndex[obj1]].lat;
				lon1 = nodes[nodeIdToIndex[obj1]].lon;
			} else if (typeof obj1 == "object") { // 引数がオブジェクトの場合
				if ( (!("getLat" in obj1)) || (!("getLon" in obj1)) ) { throw("第1引数のオブジェクトは無効です"); } // lat、lonのプロパティがない場合を除外
				// lat1 = obj1.lat;
				// lon1 = obj1.lon;
				lat1 = obj1.getLat();
				lon1 = obj1.getLon();
			}
			if ((typeof obj2 == "string") || (typeof obj2 == "number")) { // 引数がidの場合
				if (!(obj2 in nodeIdToIndex)) { throw("第2引数のnodeIdは無効です"); } // 無効なidの場合を除外
				lat2 = nodes[nodeIdToIndex[obj2]].lat;
				lon2 = nodes[nodeIdToIndex[obj2]].lon;
			} else if (typeof obj2 == "object") { // 引数がオブジェクトの場合
				if ( (!("getLat" in obj2)) || (!("getLon" in obj2)) ) { throw("第2引数のオブジェクトは無効です"); } // lat、lonのプロパティがない場合を除外
				// lat2 = obj2.lat;
				// lon2 = obj2.lon;
				lat2 = obj2.getLat();
				lon2 = obj2.getLon();
			}

			vLat = this.latToMeter(lat2-lat1);
			vLon = this.lonToMeter(lon2-lon1);
			nv = Math.sqrt(Math.pow(vLat,2)+Math.pow(vLon,2));

			return {
				lat: vLat/nv,
				lon: vLon/nv
			};
		} catch (errMsg) {
			console.warn("calcDirection(): "+errMsg);
			return {
				lat: 0,
				lon: 0
			}
		}
	};

	this.latToMeter = (function () {
		var oneDeg = 2*Math.PI*R_EARTH/360; // 1度あたりの距離(m)

		return function (lat) {
			return lat*oneDeg;
		};
	})();

	this.lonToMeter = (function () {
		var oneDeg = 2*Math.PI*R_EARTH*Math.cos(mapCenterLat*Math.PI/180)/360; // 1度あたりの距離(m)

		return function (lon) {
			return lon*oneDeg;
		};
	})();

	this.meterToLat = (function () {
		var oneDeg = 2*Math.PI*R_EARTH/360; // 1度あたりの距離(m)

		return function (m) {
			return m/oneDeg;
		}
	})();

	this.meterToLon = (function () {
		var oneDeg = 2*Math.PI*R_EARTH*Math.cos(mapCenterLat*Math.PI/180)/360; // 1度あたりの距離(m)

		return function (m) {
			return m/oneDeg;
		}
	})();


	this.start = function () {
		if ((isInitialized) && (!timer)) {
//			idToLatLon();
			refreshGMap();
			timer = setInterval(eachStepFunc, timeStep);
		}
	};

	this.stop = function () {
		clearInterval(timer);
		timer = null;
	};


	this.createObject = function () {

		var baseObj = (function () {
			var id;
			var isAdded = false;

			var lat = mapCenterLat;
			var lon = mapCenterLon;
			var nodeId = null;
			var icon = null;

			return {
				setLat: function (_lat) {
					lat = _lat;
					return this;
				},
				setLon: function (_lon) {
					lon = _lon;
					return this;
				},
				getLat: function () {
					return lat;
				},
				getLon: function () {
					return lon;
				},
				setNodeId: function (_nodeId) {
					nodeId = _nodeId;

	// if (isInitialized) {
					var node = getNode(nodeId);
		// if (node) {
					this.setLat(node.lat);
					this.setLon(node.lon);
		// } else {
		// 	console.warn("setNodeId: 無効なnodeIdです。")
		// }
	// }
					return this;
				},
				getNodeId: function () {
					return nodeId;
				},
				addToLat: function (dLat) {
	// lat += this.meterToLat(l);
					lat += dLat;
				},
				addToLon: function (dLon) {
	// lon += this.meterToLon(l);
					lon += dLon;
				},
				add: function () {
					if (!isAdded) {
						id = addObject(this);
						isAdded = true;
					}
					return this;
				},
				remove: function () {
					if (isAdded) {
						removeObject(id);
						isAdded = false;
					}
					return this;
				},
				setIcon: function (_icon,sizeX,sizeY) {
//					icon = _icon;

if (typeof _icon == "object") {
	icon = _icon;
} else if (typeof _icon == "string") {
	if (sizeX && sizeY) {
		icon = {
			url: _icon,                     // url
			scaledSize: new google.maps.Size(sizeX,sizeY)
		};
	} else {
		icon = _icon;
	}
} else {
	console.warn("setIcon(): 無効な引数です")
}
					return this;
				},
				getIcon: function () {
					return icon;
				}
				// addToLat: function (l) {
				// 	this.lat += meterToLat(l);
				// },
				// addToLon: function (l) {
				// 	this.lon += meterToLon(l);
				// },
				// setNodeId: function (nodeId) {
				// 	var node = getNode(nodeId);
				// 	if (node) {
				// 		this.lat = node.lat;
				// 		this.lon = node.lon;
				// 		this.nodeId = nodeId;
				// 	} else {
						
				// 	}
				// },
				// lat: 0,
				// lon: 0,
				// nodeId: null
			};
		})();


		var _const = arguments[0];
		var args = Array.prototype.slice.call(arguments,1,arguments.length);

		try {
			if (typeof _const == "function") {

				var obj = $.extend({},baseObj, new _const());

				if(isInitialized) {
					obj.init.apply(obj,args);
				} else {
					objInitFuncs[objInitFuncs.length] = function () {
						obj.init.apply(obj,args);
					};
				}
				return obj;
			} else {
				throw("無効な引数です");
			}
		} catch (errMsg) {
			console.warn("createObject: "+errMsg)
			return null;
		}

	};

	function addObject (obj) {
		var id;
		if (emptyObjIds.length) {
			id = emptyObjIds[emptyObjIds.length-1];
			emptyObjIds.pop();
		} else {
			id = objs.length;
		}
		objs[id] = obj;
		return id;
	}

	function removeObject(id) {
		objs[id] = null;
		emptyObjIds[emptyObjIds.length] = id;
	}

	this.eachStep = function (func) {
		eachStepFunc = function () {
			func();

			try {
				var status = setLatLonById();
				if (status) { throw(status); }
			} catch (errMsg) {
				console.warn("eachStep(): "+errMsg)
			}
			// idToLatLon(); // idで位置を指定しているオブジェクトに緯度経度を与える
			refreshGMap();
		};
	};

	function setLatLonById() {
		// var index;
		// for (var i=0; i<objs.length; i++) {
		// 	if (objs[i]){ // オブジェクトが存在する場合
		// 		// マーカーの座標オブジェクトを生成
		// 		if (objs[i].getNodeId() in nodeIdToIndex) {
		// 			index = nodeIdToIndex[objs[i].getNodeId()];
		// 			// objs[i].lat = nodes[index].lat;
		// 			// objs[i].lon = nodes[index].lon;
		// 			objs[i].setLat(nodes[index].lat);
		// 			objs[i].setLon(nodes[index].lon);
		// 		}
		// 	}
		// }

		try {
			for (var i=0; i<objs.length; i++) {
				if (objs[i]){ // オブジェクトが存在する場合
					var id = objs[i].getNodeId();
				// マーカーの座標オブジェクトを生成
					if ( (id != null) && (!(id in nodeIdToIndex)) ) { throw(id+"は無効なnodeIdです。") }

					if (id != null) {
						var index;
						index = nodeIdToIndex[objs[i].getNodeId()];
					// objs[i].lat = nodes[index].lat;
					// objs[i].lon = nodes[index].lon;
						objs[i].setLat(nodes[index].lat);
						objs[i].setLon(nodes[index].lon);
					}

				}
			}
			return 0;
		} catch (errMsg) {
			return errMsg;
		}

	}

	function refreshGMap() {
		var gMapLatLng, index;
		for (var i=0; i<objs.length; i++) {
			if (objs[i]){ // オブジェクトが存在する場合
				// マーカーの座標オブジェクトを生成

				// if (objs[i].nodeId) {
				// 	index = nodeIdToIndex[objs[i].nodeId];
				// 	gMapLatLng = new google.maps.LatLng(nodes[index].lat, nodes[index].lon);
				// } else {
//				var gMapLatLng = new google.maps.LatLng(objs[i].lat, objs[i].lon);
				var gMapLatLng = new google.maps.LatLng(objs[i].getLat(), objs[i].getLon());
				// }
				if (!objMarkers[i]) { //　マーカーが無ければ生成

					objMarkers[i] = new google.maps.Marker({
						position: gMapLatLng,
						icon: objs[i].getIcon()
					});
					objMarkers[i].setMap(gMap);
				} else {
					objMarkers[i].setPosition(gMapLatLng);
				}
			} else { // オブジェクトが存在しない場合
				if (objMarkers[i]) {　// マーカーがあれば削除
					objMarkers[i].setMap(null);
					objMarkers[i] = null;
				}
			}
		}
	}
	this.refresh = refreshGMap;　// 手動でマップをリフレッシュする為の関数

// 	this.aStar = function (_start,_goal) {
	
// 		function aStar() {
// 			this.status = true;
// 			this.id;
// 			this.cost;
// 			this.before = null;
// 		}
// 		var startId = getNode(_start).id;
// 		var goalId = getNode(_goal).id;

// 		var aStars = [];

// 		aStars[startId] = new aStar();
// 		aStars[startId].status = false;
// 		aStars[startId].cost = 0;

// 		var selected = startId;
// 		var neighbors = this.getNeighbors(startId);


// 		for (var k=0; k<1000000; k++) {

// 			aStars[selected].status = false;
// 			var neighbors = this.getNeighbors(selected);

// 			for (var i=0; i<neighbors.length; i++) {

// 				if (!(neighbors[i] in aStars)) {
// 					aStars[neighbors[i]] = new aStar();
// 					aStars[neighbors[i]].cost = aStars[selected].cost + this.calcDistance(selected, neighbors[i]);
// 					aStars[neighbors[i]].before = selected;

// // nodeMarkers[i] = new google.maps.Marker({
// // 	position: new google.maps.LatLng(nodes[nodeIdToIndex[neighbors[i]]].lat, nodes[nodeIdToIndex[neighbors[i]]].lon)
// // });
// // nodeMarkers[i].setMap(gMap);

// 				}
// 			}

// 			//最小ノードを計算
// 			var maxF = 100000000;
// 			for (var id in aStars) {
// 				if  (aStars[id].status) {
// 					var f = aStars[id].cost + this.calcDistance(id, goalId);
// // console.log(id+","+ES.calcDistance(id, goalId))
// 					if (f < maxF) {
// 						selected = id;
// 						maxF = f;
// 					}
// 				}
// 			}

// // console.log(selected+","+goalId)
// 			if (selected == goalId) {
// 				break;
// 			}

// 		}


// 		var after = goalId;
// 		var route = [];
// 		while(1) {
// 			route[route.length] = Number(after);
// 			after = aStars[after].before;
// 			if (!after) {
// 				break;
// 			}
// 		}

// 		route.reverse();

// 		var lineCoords = [];
// 		for (var i=0; i<route.length; i++) {
// 			lineCoords[lineCoords.length] = new google.maps.LatLng(nodes[nodeIdToIndex[route[i]]].lat, nodes[nodeIdToIndex[route[i]]].lon);
// 		}

// 		var routeLine = new google.maps.Polyline({
// 			path: lineCoords,
// 			strokeColor: "#0000ff",
// 			strokeOpacity: 0.8,
// 			strokeWeight: 2
// 		});

// 		routeLine.setMap(gMap);

// 		return route;

// 	};

	this.aStar = function (_start,_goal) {
		var startId = getNode(_start).id;
		var goalId = getNode(_goal).id;

		if (startId && goalId) {
			this.stop();
			function aStar() {
				this.cost;
				this.before = null;
			}

			var aStars = [];

			var open = {};
			var openMissingIndex = {};
			var close = {};
			var closeMissingIndex = {};


		// aStars[startId] = new aStar();
		// aStars[startId].status = false;
		// aStars[startId].cost = 0;

			open[startId] = new aStar();
			open[startId].cost = 0;


			var selected = startId;
			var neighbors = this.getNeighbors(startId);


			for (var k=0; k<1000000; k++) {

				var neighbors = this.getNeighbors(selected);

				for (var i=0,length = neighbors.length; i<length; i++) {

					if ((!(neighbors[i] in open)) && (!(neighbors[i] in close))) {
						open[neighbors[i]] = new aStar();
						open[neighbors[i]].cost = open[selected].cost + this.calcDistance(selected, neighbors[i]);
						open[neighbors[i]].before = selected;

// nodeMarkers[i] = new google.maps.Marker({
// 	position: new google.maps.LatLng(nodes[nodeIdToIndex[neighbors[i]]].lat, nodes[nodeIdToIndex[neighbors[i]]].lon)
// });
// nodeMarkers[i].setMap(gMap);

					}
				}

				close[selected] = open[selected];
				delete open[selected];
				if (jQuery.isEmptyObject(open)) {
					console.warn("aStar(): there are no route");
					break;
				}

			//最小ノードを計算
				var maxF = 100000000;
				for (var id in open) {
				// if  (open[id].status) {
					var f = open[id].cost + this.calcDistance(id, goalId);
// console.log(id+","+ES.calcDistance(id, goalId))
					if (f < maxF) {
						selected = id;
						maxF = f;
					}
				// }
				}

// console.log(selected+","+goalId)
				if (selected == goalId) {
					console.log("aStar(): calclation of A* completed successfully");
					close[selected] = open[selected];
					break;
				}

			}

			var after = selected;
			var route = [];
			while(1) {
				route[route.length] = Number(after);
				after = close[after].before;
				if (!after) {
					break;
				}
			}

			for (var id in close) {
				delete close[id];
			}

			route.reverse();

			var lineCoords = [];
			for (var i=0; i<route.length; i++) {
				lineCoords[lineCoords.length] = new google.maps.LatLng(nodes[nodeIdToIndex[route[i]]].lat, nodes[nodeIdToIndex[route[i]]].lon);
			}

			var routeLine = new google.maps.Polyline({
				path: lineCoords,
				strokeColor: "#0000ff",
				strokeOpacity: 0.8,
				strokeWeight: 2
			});

			routeLine.setMap(gMap);

			this.start();

			return route;
		} else {
			console.warn("astar(): nodeの取得に失敗")
		}

	};



	function initObjs() {
		for (var i=0; i<objInitFuncs.length; i++) {
			objInitFuncs[i]();
		}
	}

	// initializer
	(function () {
		var domLoadedProm = (function () {
			var dfd = $.Deferred();
			$(function() {
				dfd.resolve();
			});
			return dfd.promise();
		});

		var nodesProm = $.getJSON(nodesUrl,function (data) {
			nodes = data;
		});
		var waysProm = $.getJSON(waysUrl, function (data) {
			ways = data;
		});

		$.when(
			nodesProm,
			waysProm,
			domLoadedProm
		)
		.then(function () {
			initGMap();
			initData();
			initObjs();

			// try {
			// 	var status = setLatLonById();
			// 	if (status) { throw(status)}
			isInitialized = true;
			// } catch (errMsg) {
			// 	console.error("initializer: "+errMsg);
			// }
		})
		.fail(function () {
			console.error("ERROR: cannot read files");
		});
	})();

	return this;

})();

ES = evacSim;
