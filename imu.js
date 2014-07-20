var dgram = require("dgram");
var sock = dgram.createSocket("udp4");
var listen_address = null;

sock.on("error", function(err){
	console.log("Socket error:\n" + err.stack);
	sock.close();
});

sock.on("listening", function(){
	listen_address = sock.address();
});

function imuZero(){
	var imuZero = {
		a : [0, 0, 0],
		g : [0, 0, 0],
		m : [0, 0, 0]
	}
	return JSON.parse(JSON.stringify(imuZero)); //quick and dirty cloning, but we're only doing it to initialise the server
}

/**
 * Global sensor data
 */
var imu = {
	latest : {
		timestamp : 0,
		data : imuZero()
	},
	gyro : [0, 0, 0]
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

sock.on("message", function(buf, from){

	var raw = buf.toString('ASCII').split(/,\s+/);
	var data = {a : [], g : [], m : []}; //accelerometer, gyroscope, magnetometer
	
	/**
	 * Extract each sensor's data based on the app's description:
	 *
	 * https://play.google.com/store/apps/details?id=org.zwiener.wimu
	 * 
	 * Timestamp [sec], sensorid, x, y, z, sensorid, x, y, z, sensorid, x, y, z
	 * Sensor id:
	 * 3 - Accelerometer (m/s^2)
	 * 4 - Gyroscope (rad/s)
	 * 5 - Magnetometer (micro-Tesla uT)
	 */
	
	//invalid packet 
	if((raw.length-1)%4){
		return;
	}
	
	var timestamp = parseFloat(raw[0]);
	for(var i=1; i<raw.length; i+=4){
		var sID;
		switch(raw[i]){
			case '3':
				sID = 'a';
				break;
			case '4':
				sID = 'g';
				break;
			case '5':
				sID = 'm';
				break;
		}
		for(var j=0; j<3; j++){
			data[sID][j] = parseFloat(raw[i+j+1]);
		}
	}

	if(timestamp > imu.latest.timestamp){
	
		/**
		 * Sum the gyro; reset it to zero with:
		 * - HTTP request for the URL /zero
		 * - shake the device
		 */
		var accel = (Math.pow(data.a[0],2) + Math.pow(data.a[1],2) + Math.pow(data.a[2],2));
		if(shakeLimit < accel){
			imu.gyro = [0, 0, 0];
		}
		else {
			var delta = timestamp - imu.latest.timestamp;
			if(data.g.length==3){
				for(var dim=0; dim<3; dim++){
					imu.gyro[dim] += data.g[dim]*delta;
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

sock.bind(5555); //default for the app

var http = require('http');

var server = http.createServer(function(req, resp){
	var data;
	if(req.url.substring(0, 4)=='/avg'){
		data = imu[req.url.substring(1,req.url.length)];
	}
	else {
		switch(req.url){
			case '/accelAngle':
				var a = imu.latest.data.a;
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

server.listen(8000);
