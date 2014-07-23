var genecloud = {

	init : function(){
		$('#render').click(genecloud.render);
		$('#save').click(function(){
			genecloud.canvas.toDataURL({
				callback: function(dataUrl) {
					window.open(dataUrl);
				}
			});
		});
		
		$('button').click(function(){
			$(this).blur();
		});
		
		$('#range').slider({
			min : 0,
			max : 1,
			step : 0.001,
			value : 0.5,
			change : function(){
				$(this).find('.ui-slider-handle').blur();
				genecloud.render();
			}
		});
		
		$('#seq, #order').change(function(){
			genecloud.changed = true;
		});

		var orders = ['ACGT', 'ACTG', 'AGCT', 'AGTC', 'ATCG', 'ATGC', 'CATG', 'CAGT', 'CGTA', 'CGAT', 'CTGA', 'CTAG', 'GACT', 'GATC', 'GCAT', 'GCTA', 'GTAC', 'GTCA', 'TAGC', 'TACG', 'TCGA', 'TCAG', 'TGCA', 'TGAC'];
		var sel = $('select#order');
		for(var r in orders){
			sel.append(
				$('<option>')
					.attr('value', orders[r])
					.html(orders[r])
			);
		}
		
		$('#load').click(genecloud.load);

		$('[data-help]').each(function(){
			var popover = $('<div>')
									.attr('data-toggle', 'popover')
									.attr('data-content', $(this).attr('data-help'))
									.attr('title', $(this).attr('data-help-title'))
									.append($('<span class="glyphicon glyphicon-info-sign">'))
									.addClass($(this).hasClass('input-group') ? 'input-group-addon' : 'pull-right');

			$(this).append(popover);
		});
		
		$('[data-toggle=popover]').popover({
			container : 'body',
			placement : 'auto',
			trigger : 'manual',
			html : true
		}).on('mouseenter', function(){ //http://stackoverflow.com/questions/15989591/how-can-i-keep-bootstrap-popover-alive-while-the-popover-is-being-hovered
			var _this = this;
			$(this).popover('show');
			var pId = $(this).attr('aria-describedby');
			$('#'+pId).on('mouseleave', function(){
				$(_this).trigger('mouseleave');
			});
    	}).on('mouseleave', function(){
			var _this = this;
			setTimeout(function(){
				var pId = $(_this).attr('aria-describedby');
				if(!$(_this).is(':hover') && !$('#'+pId).is(':hover')){
					$(_this).popover('hide')
				}
			}, 200);
		});
	},
	
	changed : true, //does the sequence data need to be repacked as binary?
	buf : null, //binary data, 1 nucleotide for every 2 bits 
	u8 : null, //uint8 view for the buffer
	seqLen : 0,
	counts : {},
	canvas : null,
	
	render : function(){
		try {
			$('#render').html('Rendering...').prop('disabled', true);
			
			if(genecloud.changed){ //repack the sequence as binary
				genecloud.changed = false;
				var seq = $('#seq').val().trim().toUpperCase();
				if(seq.match(/[^ACGT]/)){
					throw 'Invalid sequence data; ACGT only.';
				}
				
				var buf = genecloud.buf = new ArrayBuffer(Math.ceil(seq.length/4));
				var u8 = genecloud.u8 = new Uint8Array(buf);
				genecloud.seqLen = seq.length;
				genecloud.counts = {};
				
				/**
				 * Pack 4 nucleotides into each byte, treating a 4-mer as a big-endian uint8
				 * First assign a bit-value (0-3) for each, based on the selected ordering
				 */
				var order = $('#order').val();
				var bits = {}
				for(var b=0; b<4; b++){
					bits[order[b]] = b;
				}
				
				var byte = -1; //is incremented immediately
				for(var i=0; i<seq.length; i++){
					if(!(i & 3)){
						byte++;
						u8[byte] = 0;
					}
					else {
						u8[byte] = u8[byte] << 2;
					}
					u8[byte] += bits[seq[i]];
				}
			}
		
			var k = $('#k').val().trim();
			if(k.match(/[^\d]/) || (k = parseInt(k))<0){
				throw 'k must be a positive integer.';
			}
			
			/**
			 * NB establish an upper bound for k!
			 */

			$('#cloud').empty();
			
			var format = $('#format').val();
			switch(format){
				case 'ent':
					genecloud.plotEntropy();
					break;
				case '2': case '3':
					var dim = parseInt(format);
					genecloud['plot'+dim+'D'](genecloud.getCounts(k, dim), k);
					break;
			}
		}
		catch(e){
			console.log(e);
			alert('ERROR: '+e);
		}
		$('#render').html('Render').prop('disabled', false);
		return false;
	},
	
	getCounts : function(k, dims){
		var frameShift = $('#shift').prop('checked') ? k : 1;
		
		if(k in genecloud.counts){
			if(frameShift in genecloud.counts[k]){
				if(dims in genecloud.counts[k][frameShift]){
					return genecloud.counts[k][frameShift][dims];
				}
			}
			else {
				genecloud.counts[k][frameShift] = {};
			}
		}
		else {
			genecloud.counts[k] = {};
			genecloud.counts[k][frameShift] = {};
		}
		
		var u8 = genecloud.u8;
		var len = genecloud.seqLen;
		var counts = {};
		var n = len - k;
		var max =  1;
		
		for(var i=0; i<n; i+=frameShift){
			var dimObj = counts;
			for(var dim=0; dim<dims; dim++){
				var kmer = 0;
				for(var j=0; j<k; j++){
					kmer = (kmer << 2) + genecloud.getNucleotide(i + dim*k + j);
				}
				if(dim==dims-1){
					if(kmer in dimObj){
						dimObj[kmer]++;
						if(dimObj[kmer]>max){
							max = dimObj[kmer];
						}
					}
					else {
						dimObj[kmer] = 1;
					}
				}
				else {
					if(!(kmer in dimObj)){
						dimObj[kmer] = {};	
					}
					dimObj = dimObj[kmer];
				}
			}
		}
		return genecloud.counts[k][frameShift][dims] = {data : counts, max : max};
	},
	
	getNucleotide : function(n){
		var pos = (n & 3) << 1;
		return (genecloud.u8[n >> 2] & (0xc0 >>> pos)) >>> (6 - pos);
		/* THIS IS IDENTICAL TO:
		var byte = genecloud.u8[n >> 2]; //4 nucleotides per byte, n >> 2 equivalent to Math.floor(n/4);
		//we now want to extract 2 bits, starting from lowest address
		var mod = n & 3; //which 2-bit
		var lmod = mod << 1; //double it as we are using 2 bits
		var mask = 0xc0 >>> lmod; //0xc0 = 11000000 so we zero-shift the mask accordingly
		return (byte & mask) >>> (6 - lmod); //mask the byte and zero-shift to the 2 highest-addressed bits
		*/
	},
	
	kmerFromDec : function(dec, k){
		var order = $('#order').val();
		var kmer = '';
		for(var i=0; i<k; i++){
			kmer = order[dec & 3] + kmer;
			dec = dec >>> 2;
		}
		return kmer;
	},
	
	plotEntropy : function(){
		var n = 6; //produce a 2^n by 2^n plot
		var binSize = genecloud.seqLen / (1 << (n << 1));
		var entropy = [];
		var base = 2;
		var logBase = Math.log(base);
		var maxEnt = 0;

		var k = parseInt($('#k').val());
		var numKmers = 1 << (k << 1);
		var zero = []
		for(var i=0; i<numKmers; i++){
			zero.push(0);
		}
		
		var sh = $('#shift').prop('checked') ? k : 1;
		for(var i=0; i<genecloud.seqLen; i+=binSize){
			var counts = zero.slice(); //clone
			for(var j=0; j<binSize; j+=sh){
				var count = 0;
				for(var x=0; x<k; x++){
					count = (count << 2) + genecloud.getNucleotide(i+j+x);
				}
				counts[count]++;
			}
			
			var ent = 0;
			for(kmer=0; kmer<numKmers; kmer++){
				if(!counts[kmer]){
					continue;
				}
				var p = counts[kmer]/binSize;
				ent -= p * Math.log(p)/logBase;
			}
			ent = Math.pow(ent, 1/3);
			entropy.push(ent);
			maxEnt = Math.max(maxEnt, ent);
		}
		
		//http://en.wikipedia.org/wiki/Hilbert_curve#Applications_and_mapping_algorithms
		var rot = function(n, xy, rx, ry){
			var x = xy[0];
			var y = xy[1];
			if(ry==0){
				if(rx==1){
					x = n-1 - x;
					y = n-1 - y;
				}
				var t  = x;
				x = y;
				y = t;
			}
			return [x, y];
		}
 
		var hilbert = function(n, d){ //n = 2^(2k); d = 0...n-1
			var rx, ry, s, t = d;
			var x = 0, y = 0, xy;
			for(var s=1; s<n; s*=2){
				rx = 1 & (t/2);
				ry = 1 & (t ^ rx);
				xy = rot(s, [x, y], rx, ry);
				x = xy[0];
				y = xy[1];
				x += s * rx;
				y += s * ry;
				t /= 4;
			}
			return [x, y];
		}
		
		var size = 9;
		var stage = new Kinetic.Stage({
			container: 'cloud',
			width: 1 << size,
			height: 1 << size
		});
		
		genecloud.canvas = stage;

		var scale = 1 << (size - n);
		var layer = new Kinetic.Layer();
		
		layer.add(new Kinetic.Rect({
			x : 0, y : 0, width : 1 << size, height : 1 << size, fill : '#fff'
		}));

		for(var e in entropy){
			var xy = hilbert(4096, e);
			var node = new Kinetic.Rect({
				x: xy[0]*scale,
				y: xy[1]*scale,
				width: scale,
				height: scale,
				fill: 'rgba(0,0,0,'+(entropy[e]/maxEnt)+')',
				transformsEnabled: 'position'
			});
			layer.add(node);
		}
		
		stage.add(layer);
	},
	
	plot2D : function(counts, k){
		var size = 9;
		var stage = new Kinetic.Stage({
			container: 'cloud',
			width: 1 << size,
			height: 1 << size
		});
		
		genecloud.canvas = stage;

		var scale = 1 << (size - 2*k);
		var layer = new Kinetic.Layer();
		
		layer.add(new Kinetic.Rect({
			x : 0, y : 0, width : 1 << size, height : 1 << size, fill : '#fff'
		}));

		for(var x in counts.data){
			for(var y in counts.data[x]){
				var ratio = Math.pow(counts.data[x][y]/counts.max, $('#range').slider('value'));
				var node = new Kinetic.Rect({
					x: x * scale,
					y: y * scale,
					width: scale,
					height: scale,
					fill: 'rgba(0,0,255,'+ratio+')',
					id: x+':'+y,
					transformsEnabled: 'position'
				});
				layer.add(node);
			}
		}
		
		var mouseCapture = new Kinetic.Rect({ //transparent rectangle to allow tracking of the mouse position in areas with no data
			width : (1 << size) - 1, //don't capture the last pixel because that will be a (k+1)-mer
			height : (1 << size) - 1,
			x : 0,
			y : 0,
			fill : 'rgba(0, 0, 0, 0)'
		});
		
		layer.add(mouseCapture);
		mouseCapture.on('mousemove', function(){
			var pos = stage.getPointerPosition();
			$('#x').val(genecloud.kmerFromDec(pos.x >>> (size - 2*k), k));
			$('#y').val(genecloud.kmerFromDec(pos.y >>> (size - 2*k), k));
		});
		
		stage.add(layer);
	},
	
	currAngles : [0, 0, 0],
	animateAngle : 0,
	animateLastFrameTime : (new Date()).getTime(),
	
	angles : function(){
		if(typeof io=='function'){
			var socket = io('http://localhost:3000');
			socket.on('angles', function(data){
				genecloud.currAngles = data;
			});
		}
	},
	
	plot3D : function(counts, k){
		setTimeout(genecloud.angles, 0);
	
		var scene = new THREE.Scene();
		//scene.fog = new THREE.Fog( 0x000000, 300, 600 );
		var camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000 );

		var renderer = new THREE.WebGLRenderer({
			preserveDrawingBuffer : true // required to support .toDataURL() - http://learningthreejs.com/blog/2011/09/03/screenshot-in-javascript/
		});
		
		renderer.setSize( 512, 512 );
		$('#cloud').append($(renderer.domElement));
		
		var mult = 5;
		
		var geometry = new THREE.Geometry();

		var trans = -Math.pow(4, k-0.5) * mult; //k - 1 is the same as dividing by 2
		var n = 0;
		var colors = [];
		for(var x in counts.data){
			for(var y in counts.data[x]){
				for(var z in counts.data[x][y]){
					geometry.vertices.push(new THREE.Vector3(parseInt(x), parseInt(y), parseInt(z)).multiplyScalar(mult).addScalar(trans));
					colors[n] =  new THREE.Color(0xffffff);
					//colors[n].setHSL((2 + Math.min(1, counts.data[x][y][z] / 4))/3, 1, 0.5); //blue lowest, red highest
					colors[n].setHSL(1, 0, Math.pow(counts.data[x][y][z] / counts.max, $('#range').slider('value')));
					n++;
				}
			}
		}
		
		geometry.colors = colors;

		var material = new THREE.PointCloudMaterial({
			size: 0.1*k,
			vertexColors: THREE.VertexColors,
			transparent: true
		});
		//material.color.setHSL( 1.0, 0.2, 0.7 );
		
		var cloud = new THREE.PointCloud(geometry, material);
		//cloud.sortParticles = true;
		scene.add(cloud);

		var axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)];
		var origin = new THREE.Vector3(0, 0, 0);
		
		var render = function () {
			requestAnimationFrame(render);
			
			if($('#imu').prop('checked')){
				camera.position.set(0, 0, trans*3);
				for(var i=0; i<2; i++){
					camera.position.applyAxisAngle(axes[i], genecloud.currAngles[i]*2);
				}
			}
			else {
				var now = (new Date()).getTime();
				genecloud.animateAngle += (genecloud.animateLastFrameTime - now) / 1000; //rotate at 1 radian per second, independent of frame rate
				genecloud.animateLastFrameTime = now;
				camera.position.set(0, -trans*1.5, trans*2.5)
				camera.position.applyAxisAngle(axes[1], genecloud.animateAngle);
			}
			
			camera.lookAt(origin);
			renderer.render(scene, camera);
		};

		render();
		genecloud.canvas = renderer.domElement;
	},
	
	kmer : function(x, k){
		x = parseInt(x);
		var kmer = '';
		var order = $('#order').val();
		for(var i=0; i<k; i++){
			kmer = order[x & 3] + kmer;
			x = x >> 2;
		}
		return kmer;
	},
	
	load : function(){
		$.get('./fasta/'+$('#fasta').val(), function(data){
			$('#seq').val(data);
			genecloud.changed = true;
			genecloud.render();
		});
	},
	
	test : function(){
		var correct = {
			'0000' : 0,
			'0001' : 1,
			'0002' : 2,
			'0003' : 3,
			'3333' : 255
		}
		
		var error = false;
		for(var c in correct){
			var pts = genecloud.getPoints(1, c, c.length);
			if(pts[0]!=correct[c]){
				error = true;
				console.log('Point for '+c+' expected '+correct[c]+' but returned '+pts[0]);
			}
		}
		
		if(error){
			console.log('**********************************************************');
			console.log('Test failed');
			console.log('**********************************************************');
		}
		else {
			console.log('Test passed');
		}
	}

}

//$(genecloud.test);
$(genecloud.init);
$(genecloud.render);
