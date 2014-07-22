var dgram = require("dgram");
var udp = dgram.createSocket("udp4");
var listen_address = null;

udp.on("error", function(err){
	console.log("Socket error:\n" + err.stack);
	udp.close();
});

udp.on("listening", function(){
	listen_address = udp.address();
});

/**
 * Extract each sensor's data based on the app's description:
 *
 * https://play.google.com/store/apps/details?id=org.zwiener.wimu
 *
 * Although more sensors (not documented) are available with:
 * https://play.google.com/store/apps/details?id=de.lorenz_fenster.sensorstreamgps
 * 
 * Timestamp [sec], sensorid, x, y, z, sensorid, x, y, z, sensorid, x, y, z
 * Sensor id:
 * 3 - Accelerometer (m/s^2)
 * 4 - Gyroscope (rad/s)
 * 5 - Magnetometer (micro-Tesla uT)
 */

var sensors = { //app uses IDs for each, each key is the app ID and the array is a pretty-name, the vector length, and optional transformation callback
	3 : ['accel', 3],
	4 : ['gyro', 3],
	5 : ['mag', 3],
	81 : ['orient', 3, function(deg){
		return deg / 180 * Math.PI;
	}],
	84 : ['rot', 3]
}

var imuObjs = {zero : {}, empty : {}}
for(var i in sensors){
	s = sensors[i];
	imuObjs.zero[s[0]] = [];
	imuObjs.empty[s[0]] = [];
	for(var j=0; j<s[1]; j++){
		imuObjs.zero[s[0]].push(0);
	}
}

function imuObj(obj){
	return JSON.parse(JSON.stringify(imuObjs[obj])); //quick and dirty cloning, but we're only doing it to initialise the server
}

function imuZero(){
	return imuObj('zero');
}

function imuEmpty(){
	return imuObj('empty');
}

/**
 * Global sensor data
 */
var imu = {
	latest : {
		timestamp : 0,
		data : imuZero()
	},
	gyro : [0, 0, 0] //summed value over time
}

/**
 * If total acceleration exceeds this limit, the gyro count is reset to 0
 */
var shakeLimit = 18;
shakeLimit = Math.pow(shakeLimit,2);

/**
 * Keep rolling averages to reduce noise
 * See socket message event for implementation
 */
var avg = [5, 10, 25, 100];
for(var i in avg){
	var n = avg[i];
	imu['avg'+n] = imuZero();
}

udp.on("message", function(buf, from){

	var raw = buf.toString('ASCII').split(/,\s+/);
	var data = imuEmpty();
	
	var timestamp = parseFloat(raw[0]);
	var sID = 0, transform = null, doTransform = false;
	
	for(var i=1, j=0; i<raw.length; i++, j++){
		if(raw[i].match(/^\d+$/)){
			if(raw[i] in sensors){
				sID = sensors[raw[i]][0];
				j = -1;
				if(typeof sensors[raw[i]][2]=='function'){
					doTransform = true;
					transform = sensors[raw[i]][2];
				}
				else {
					doTransform = false;
					transform = null;
				}
			}
			else {
				sID = false;
				console.log('Unknown sensor ID: '+raw[i]);
			}
		}
		else {
			if(sID===false){
				continue;
			}
			var fl = parseFloat(raw[i]);
			data[sID][j] = doTransform ? transform(fl) : fl;
		}
	}

	if(timestamp > imu.latest.timestamp){
	
		/**
		 * Sum the gyro; reset it to zero with:
		 * - HTTP request for the URL /zero
		 * - shake the device
		 */
		var accel = (Math.pow(data.accel[0],2) + Math.pow(data.accel[1],2) + Math.pow(data.accel[2],2));
		if(shakeLimit < accel){
			imu.gyro = [0, 0, 0];
		}
		else {
			var delta = timestamp - imu.latest.timestamp;
			if(data.gyro.length==3){
				for(var dim=0; dim<3; dim++){
					imu.gyro[dim] += data.gyro[dim]*delta;
				}
			}
		}
	
		imu.latest.timestamp = timestamp;
		imu.latest.data = data;
	}

	/**
	 * Rolling averages weight old and new data linearly, resulting in an exponentially decreasing weight of individual packets.
	 * e.g. avg5 weights 0.8 : 0.2
	 * Results in decreased noise, but at the expense of an "easing-in" lag
	 */
	for(var i in avg){
		var n = avg[i];
		
		//weighting for new and old data
		var wN = 1/n;
		var wO = 1 - wN;
		
		//is there a faster way to do this? does it matter?
		var key = 'avg'+n;
		for(var sID in imu[key]){
			for(var dim in imu[key][sID]){ //dimensions
				imu[key][sID][dim] = wO*imu[key][sID][dim] + wN*data[sID][dim];
			}
		}
	}
});

udp.bind(5555); //default for the app

var http = require('http');

var server = http.createServer(function(req, resp){
	var data;
	if(req.url.substring(0, 4)=='/avg'){
		data = imu[req.url.substring(1,req.url.length)];
	}
	else {
		switch(req.url){
			case '/accelAngle':
				var a = imu.latest.data.accel;
				var x2 = Math.pow(a[0],2);
				var y2 = Math.pow(a[1],2);
				var z2 = Math.pow(a[2],2);
		
				data = [
					Math.atan(a[0] / Math.sqrt(y2 + z2)),
					Math.atan(a[1] / Math.sqrt(x2 + z2)),
					Math.atan(Math.sqrt(x2 + y2) / a[2])
				];
				break;
			case '/zero':
				imu.gyro = [0, 0, 0];
				data = "Done";
				break;
			case '/gyroAngle':
				data = imu.gyro;
				break;
			default:
				data = imu.latest.data;
				break;
		}
	}

	resp.writeHead(200, {
		'Content-Type' : 'application/json',
		'Access-Control-Allow-Origin' : '*'
	});
	resp.end(JSON.stringify(data));
});

server.listen(8000, function(){
	console.log('HTTP listening on 8000');
});

/**
 * Web socket with socket.io
 */

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var connCount = 0;

io.on('connection', function(socket){
	connCount++;
	socket.on('disconnect', function(){
		connCount--;
	});
});

var sendAngles = function(){
	if(connCount){
		io.emit('angles', imu.latest.data.rot);
	}
	setTimeout(sendAngles, 20);
}

sendAngles();

http.listen(3000, function(){
	console.log('Socket.io listening on 3000');
});
