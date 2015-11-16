var evacSim = new (function () {
  var gMap;
  var nodes;
  var ways;
  var nodeIdToIndex = {};
  var wayIdToIndex = [];
  var readyFunc = function () {};

// オブジェクト管理用の配列
  var objs = [];
  var emptyObjIds = [];
  var objIcons = [];
  var objLabels = [];
  var deadObjs = [];

// オブジェクトのマーカー、ラベルの配列
  var objGMarkers = [];
  var objGLabels = [];

// node,wayの可視化用
  var wayLines = [];
  var nodeMarkers = [];

  var eachStepFunc;
  var timer = null;

// 初期化関係
  var isInitialized = false;
  var isDataRead = false;
  var objInitFuncs = [];
  var objReadyFuncs = [];
  var closedNodes = [];

// 距離計算用の定数
  var R_EARTH = 6378137; // 地球半径


// タイマー処理用
  var timers = [];
  var timerKilledIds = [];

// 設定
  var root = ''
  var timeStep = 100;
  var mapCenterLat = 32.695528;
  var mapCenterLon = 128.840861;
  var domId = "map_canvas";

  function nodesUrl() {
    return root + "nodes.json";
  }
  function waysUrl() {
    return root + "ways.json";
  }



  function initGMap(_callback) {
    var dfd = new $.Deferred;

    var mapOptions = {
      center: new google.maps.LatLng(mapCenterLat,mapCenterLon),
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    gMap = new google.maps.Map(document.getElementById(domId), mapOptions);
    google.maps.event.addListenerOnce(gMap, 'idle', function () {
      dfd.resolve();
    });

    return dfd.promise();
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


    // nodesに通行止めプロパティを追加
    for (var i=0; i<nodes.length; i++) {
      nodes[i].closed = false;
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

    if (obj == null) {
      return null;
    } else if ((typeof obj == "string") || (typeof obj == "number")) { // 引数がidの場合
      if (obj in nodeIdToIndex) {  // 無効なidの場合を除外
//        if (!nodes[nodeIdToIndex[obj]].closed) {
          return nodes[nodeIdToIndex[obj]];
//        } else {
//          return null;
//        }
      } else {
        return null;
      }
    } else if (typeof obj == "object") {
      if ("getNodeId" in obj) {
        if (obj.getNodeId() in nodeIdToIndex) {
          if (!nodes[nodeIdToIndex[obj.getNodeId()]].closed) {
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
    } else {
      return null;
    }

  }

  this.getNeighbors = function (obj) {
    var node = getNode(obj);
    if (node != null) {
      if (!node.closed) {
        var neighbors = [];
        for (var i=0; i<node.neighbors.length; i++) {
          if (!nodes[nodeIdToIndex[node.neighbors[i]]].closed) {
            neighbors[neighbors.length] = node.neighbors[i];
          }
        }
        return neighbors;
      } else {
        return [];
      }
    } else {
      console.error("getNeighbors(): nodeの取得に失敗");
      return [];
    }
  };

  this.getAlt = function (obj) {
    var node = getNode(obj);
    if (node != null) {
      if (!node.closed) {
        return node.alt;
      } else {
        return 0;
      }
    } else {
      console.error("getAlt(): nodeの取得に失敗");
      return 0;
    }
  };

  this.closeNode = function (obj) {
    if (isDataRead) {
      var node = getNode(obj);
      if (node != null) {
        if (!node.closed) {
          node.closed = true;
        }
      }
    } else {
      closedNodes[closedNodes.length] = obj;
    }
  };
  this.openNode = function (obj) {
    if (isDataRead) {
      var node = getNode(obj);
      if (node != null) {
        node.closed = false;
      }
    }
  };
  function setClosedNodes() {
    for (var i=0; i<closedNodes.length; i++) {
      var node = getNode(closedNodes[i]);
      if (node != null) {
        node.closed = true;
      }
    }
    closedNodes = [];
  }

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

      } else {
        throw("無効な第1引数です")
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
      } else {
        throw("無効な第2引数です")
      }

      if ( ((lat1 != null) && (lat2 != null)) && ((lon1 != null) && (lon2 != null)) ) {
        dLat = lat2-lat1;
        dLon = lon2-lon1;
        return Math.sqrt(Math.pow(this.latToMeter(dLat),2)+Math.pow(this.lonToMeter(dLon),2) );
      } else {
        return 2*R_EARTH*Math.PI; // 通常使用し得ない大きな値(地球の外周)
      }

    } catch (errMsg) {
      console.error("calcDistance(): "+errMsg);
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
      } else {
        throw("無効な第1引数です")
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
      } else {
        throw("無効な第2引数です")
      }

      if ((lat1 != null) && (lat2 != null) && (lon1 != null) && (lon2 != null)) {
        vLat = this.latToMeter(lat2-lat1);
        vLon = this.lonToMeter(lon2-lon1);
        nv = Math.sqrt(Math.pow(vLat,2)+Math.pow(vLon,2));
        return {
          lat: vLat/nv,
          lon: vLon/nv
        };
      } else {
        return {
          lat: 0,
          lon: 0
        }
      }

    } catch (errMsg) {
      console.error("calcDirection(): "+errMsg);
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
      refreshGMap();
      timer = setInterval(eachStepFunc, timeStep);
    }
  };

  this.stop = function () {
    clearInterval(timer);
    timer = null;
  };

  this.getNodes = function () {
    var count = 0;
    return Array.prototype.map.call(nodes,function (elem) {
      return elem.id
    });
  };

  this.getGMapObj = function () {
    return gMap;
  }

  this.randomNode = function () {
    var nodeIndex;
    for (var i=0; i<nodes.length; i++) {
      nodeIndex = Math.floor(Math.random()*nodes.length);
      if (ES.aStar(nodes[nodeIndex].id,1288708805) != false) {
        console.log('ok');
        break;
      }
    }
    return nodes[nodeIndex].id;
  }

  this.ready = function (_func) {
    readyFunc = _func;
  };

  var baseObject = function (_id) {
    var id = _id;
    var isAdded = true;

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
//        nodeId = _nodeId;

        var node = getNode(_nodeId);
        if (node) {
          if (!node.closed) {
            nodeId = _nodeId;
            this.setLat(node.lat);
            this.setLon(node.lon);
          } else {
            return false;
          }
        } else {
          console.error("setNodeId: 無効なnodeIdです。")
          return false;
        }
        return true;
      },
      getNodeId: function () {
        return nodeId;
      },
      addToLat: function (dLat) {
        lat += dLat;
      },
      addToLon: function (dLon) {
        lon += dLon;
      },
      add: function () {
        return this;
      },
      remove: function () {
        if (isAdded) {
          registerDeadObject(id);
          isAdded = false;
        }
        return this;
      },
      setIcon: function (_icon,sizeX,sizeY) {
        if (typeof _icon == "object") {
          // icon = _icon;
          setIcon(_icon,id);
        } else if (typeof _icon == "string") {
          if (sizeX && sizeY) {
            setIcon({
              url: _icon,                     // url
              scaledSize: new google.maps.Size(sizeX,sizeY)
            },id);
          } else {
            // icon = _icon;
            setIcon(_icon,id);
          }
        } else {
          console.error("setIcon(): 無効な引数です")
        }
        return this;
      },
      setLabel: function (_dom,_width,_height) {

        var label = {};

        if (_dom) {
          label.dom = _dom;
        } else {
          label.dom = "";
        }
        if (_width) {
          label.width = _width;
        }
        if (_height) {
          label.height = _height;
        }


        setLabel(label,id);
      },
      setTimer: function (_func,_step) {
        return setTimer(_func.bind(this),_step);  
      },
      killTimer: function (_id) {
        killTimer(_id);
      }
    };
  };



  this.createObject = function () {
    var id = getNewObjId();

    var obj = new baseObject(id);

    var _const = arguments[0];
    var args = Array.prototype.slice.call(arguments,1,arguments.length);
    var obj;
    try {
      if (typeof _const == "function") {

        $.extend(obj, new _const());

        setIcon(null,id);
        setLabel(null,id);

        if(isInitialized) {
          obj.init? obj.init.apply(obj,args) : false;
          obj.ready? obj.ready() : false;
        } else {
          objInitFuncs[objInitFuncs.length] = function () {
            obj.init? obj.init.apply(obj,args) : false;
          };
          objReadyFuncs[objReadyFuncs.length] = function () {
            obj.ready? obj.ready() : false;
          }
        }

        addObject(obj,id);
        return obj;
      } else {
        throw("無効な引数です");
      }
    } catch (errMsg) {
      console.error("createObject: "+errMsg)
      return null;
    }



  };

  function getNewObjId () {
    var id;
    if (emptyObjIds.length) {
      id = emptyObjIds[emptyObjIds.length-1];
      emptyObjIds.pop();
    } else {
      id = objs.length;
    }
    return id;
  }


  function addObject (obj,id) {
    objs[id] = obj;
  }

  function setIcon(icon,id) {
    objIcons[id] = icon;
  }

  function getIcon(id) {
    return objIcons[id];
  }

  function setLabel(label,id) {
    objLabels[id] = label;
  }

  function getLabel(id) {
    return objLabels[id];
  }

  function registerDeadObject(id) { // deadリストに登録
    deadObjs[deadObjs.length] = id;
  }

  function killObjects() { // deadリストのオブジェクトを無効にし、オブジェクトリストから除外

    for (var i=0,l=deadObjs.length; i<l; i++) {
      disableObject(objs[deadObjs[i]]);
      objs[deadObjs[i]] = null;
      emptyObjIds[emptyObjIds.length] = deadObjs[i];
    }
    deadObjs = [];
  }

  function disableObject(obj) {
    for (var key in obj) {
      if (typeof obj[key] == "function") {
        obj[key] = function () { return null; }
      }
    }
  }

  this.eachStep = function (func,_timeStep) {
    eachStepFunc = function () {
      func();
      timersForward();
      killObjects();

      try {
        var status = setLatLonById();
        if (status) { throw(status); }
      } catch (errMsg) {
        console.error("eachStep(): "+errMsg)
      }
      // idToLatLon(); // idで位置を指定しているオブジェクトに緯度経度を与える
      refreshGMap();
    };
    if (_timeStep) {
      timeStep = _timeStep;
    }
  };

  function setLatLonById() {
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
        var gMapLatLng = new google.maps.LatLng(objs[i].getLat(), objs[i].getLon());
        if (!objGMarkers[i]) { //　マーカーが無ければ生成

          // objGMarkers[i] = new google.maps.Marker({
          //   position: gMapLatLng,
          //   icon: objs[i].getIcon()
          // });
          objGMarkers[i] = new google.maps.Marker({
            position: gMapLatLng,
            icon: getIcon(i)
          });

          if (typeof objs[i].click == "function") {
            (function (obj){
              google.maps.event.addListener(objGMarkers[i], 'click', function (gMapEvent) {
                obj.click.call(obj,gMapEvent);
              });
            })(objs[i]);
          }

          objGMarkers[i].setMap(gMap);
        } else {
          objGMarkers[i].setPosition(gMapLatLng);
          objGMarkers[i].setIcon(getIcon(i));
        }

        if (!objGLabels[i]) {
          if (getLabel(i)) {
            objGLabels[i] = new GMapLabel({
              position: gMapLatLng,
              label: getLabel(i)
            });
            objGLabels[i].setMap(gMap);
          }
        } else {
          objGLabels[i].setPosition(gMapLatLng);
          objGLabels[i].setLabel(getLabel(i));
        }


      } else { // オブジェクトが存在しない場合
        if (objGMarkers[i]) {　// マーカーがあれば削除
          objGMarkers[i].setMap(null);
          objGMarkers[i] = null;
        }
        if (objGLabels[i]) {
          objGLabels[i].setMap(null);
          objGLabels[i] = null;
        }
      }
    }
  }

  function GMapLabel(_options) {
    var position = _options.position ? _options.position : null;

    var label = {
      dom: "",
      width: 100,
      height: 100
    }
    $.extend(label,_options.label);

    var wrapper;
    var dom = null;
    this.onAdd = function () {
      wrapper = document.createElement('div');
      // div.style.border = "none";
      // div.style.borderWidth = "0px";
      wrapper.style.position = "absolute";
      wrapper.style.textAlign = "center";
      var panes = this.getPanes().floatPane.appendChild(wrapper);
    };
    this.draw = function () {
      var overlayProjection = this.getProjection();
      var pos = overlayProjection.fromLatLngToDivPixel(position);


      wrapper.style.width = label.width + "px";
      wrapper.style.height = label.height + "px";
      wrapper.style.top = pos.y+"px";
      wrapper.style.left = (pos.x - label.width/2)+"px";

      if (typeof label.dom != "object") {
        wrapper.innerHTML = label.dom;
      } else {
        $(wrapper).empty();
        $(wrapper).append(label.dom);
      }
    };
    this.setPosition = function (_position) {
      position = _position;
      this.draw();
    };
    this.setLabel = function (_label) {

      $.extend(label, _label);

      this.draw();
    };
    this.refresh = function (_position) {
      position = _position;
      this.draw();
    };

    this.onRemove = function() {
      wrapper.parentNode.removeChild(wrapper);
      wrapper = null;
    }


  }
  GMapLabel.prototype = new google.maps.OverlayView();


  this.refresh = refreshGMap;　// 手動でマップをリフレッシュする為の関数

// 遅延実行用の関数群
  function setTimer(_func,_step) {
    var id;
    if (_step > 0) {
      if (timerKilledIds.length > 0) {
        id = timerKilledIds[timerKilledIds.length-1];
        timerKilledIds.pop();
      } else {
        id = timers.length;
      }
      timers[id] = {
        func: _func,
        count: _step
      };
      return id;
    } else {
      return null;
    }
  };
  
  function killTimer(_id) {
    if (_id >= 0) {
      timers[_id] = null;
      timerKilledIds[timerKilledIds.length] = _id;
    }
  }

  function timersForward() {
    for (var i=0; i<timers.length; i++) {
      if(timers[i]) {
        timers[i].count--;
        if (timers[i].count == -1) {
          timers[i].func();
          killTimer(i);
        }
      }
    }
  }

  this.setTimer = function (_func,_step) {
    return setTimer(_func,_step);
  };

  this.killTimer = function (_id) {
    killTimer(_id);
  };

  this.setRoot = function (_root) {
    root = _root;
  };
  	

// 経路探索
  this.aStar = function (_start,_goal,lineColor) {
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

      open[startId] = new aStar();
      open[startId].cost = 0;


      var selected = startId;
      var neighbors = this.getNeighbors(startId);

      var isSuccess = true;


      for (var k=0; k<1000000; k++) {

        var neighbors = this.getNeighbors(selected);

        for (var i=0,length = neighbors.length; i<length; i++) {

          if ((!(neighbors[i] in open)) && (!(neighbors[i] in close))) {
            open[neighbors[i]] = new aStar();
            open[neighbors[i]].cost = open[selected].cost + this.calcDistance(selected, neighbors[i]);
            open[neighbors[i]].before = selected;

          }
        }

        close[selected] = open[selected];
        delete open[selected];
        if (jQuery.isEmptyObject(open)) {
          isSuccess = false
          console.error("aStar(): there are no route");
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

      if (isSuccess) {
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

        if (lineColor) {
          var routeLine = new google.maps.Polyline({
            path: lineCoords,
            strokeColor: lineColor,
            strokeOpacity: 0.8,
            strokeWeight: 2
          });
          routeLine.setMap(gMap);
        }
      }

      this.start();

      if (isSuccess) {
        return route;
      } else {
        return false;
      }
    } else {
      console.error("astar(): nodeの取得に失敗")
      return false;
    }

  };

  this.calcTotalDistance = function (route) {
    var totalDistance = 0;
    for (var i=0; i<route.length-1; i++) {
      totalDistance += this.calcDistance(route[i],route[i+1]);
    }
    return totalDistance;
  };

  function initObjs() {
    for (var i=0; i<objInitFuncs.length; i++) {
      objInitFuncs[i]();
    }
    for (var i=0; i<objReadyFuncs.length; i++) {
      objReadyFuncs[i]();
    }
  }

  // initializer
  

  var init = function () {
    var domLoadedProm = (function () {
      var dfd = new $.Deferred;
      $(function() {
        dfd.resolve();
      });
      return dfd.promise();
    })();

    var nodesProm = $.getJSON(nodesUrl(),function (data) {
      nodes = data;
    });
    var waysProm = $.getJSON(waysUrl(), function (data) {
      ways = data;
    });

    $.when(
      nodesProm,
      waysProm,
      domLoadedProm
    )
    .then(function () {
      initGMap()
      .then(function (){
        initData();
        isDataRead = true;
        setClosedNodes();
        initObjs();
        readyFunc();
        isInitialized = true;
      });

    })
    .fail(function () {
      console.error("ERROR: cannot read files");
    });
  };
  this.init = init;
  init();

  return this;

})();

ES = evacSim;
