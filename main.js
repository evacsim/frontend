var Car = function(){
	this.init = function(nodeId,shelterId){
		this.setNodeId(nodeId);
		this.route = ES.aStar(nodeId,shelterId);
		this.setIcon("./icons/car.svg",20,20);
		this.routeIndex = 0;
	}
	this.move = function(){
		if(this.routeIndex < this.route.length){
			this.setNodeId(this.route[this.routeIndex]);
		this.routeIndex++;
		} else{
			this.remove();
		}
	}
}

var car = ES.createObject(Car,1288705232,1288731483);
	car.add();
ES.eachStep(function(){
	car.move();
})
