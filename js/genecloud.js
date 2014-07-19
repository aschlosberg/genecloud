var genecloud = {

	init : function(){
		$('#go').click(genecloud.render);
		$('#save').click(function(){
			alert('This function has not been implemented.');
		});

		var ranks = ['ACGT', 'ACTG', 'AGCT', 'AGTC', 'ATCG', 'ATGC', 'CATG', 'CAGT', 'CGTA', 'CGAT', 'CTGA', 'CTAG', 'GACT', 'GATC', 'GCAT', 'GCTA', 'GTAC', 'GTCA', 'TAGC', 'TACG', 'TCGA', 'TCAG', 'TGCA', 'TGAC'];
		var sel = $('select#rank');
		for(var r in ranks){
			sel.append(
				$('<option>')
					.attr('value', ranks[r])
					.html(ranks[r])
			);
		}
	},
	
	render : function(){
		try {
			var seq = $('#seq').val().trim().toUpperCase();
			if(seq.match(/[^ACGT]/)){
				throw 'Invalid sequence data; ACGT only.';
			}
			
			var rank = $('#rank').val();
			for(var r in rank){
				seq = seq.replace(new RegExp(rank[r],'g'), r);
			}
		
			var frame = $('#frame').val().trim();
			if(frame.match(/[^\d]/) || (frame = parseInt(frame))<0){
				throw 'Frame must be a positive integer.';
			}
			
			var dim = parseInt($('#dim').val());
			$('#cloud').empty();
			genecloud['plot'+dim+'D'](genecloud.getPoints(dim, seq, frame), frame);
		}
		catch(e){
			console.log(e);
			alert('ERROR: '+e);
		}
		return false;
	},
	
	getPoints : function(dim, seq, frame){
		var len = seq.length;
		var mod = len % frame;
		if(mod!=0){
			console.log('Discarding final '+mod+' nucleotides.');
		}
		
		// pt = point
		var pts = [];
		var width = frame*dim;
		var n = Math.floor(len / frame) - frame*(dim-1);
		/**
		 * ###################################
		 * This code can be optimised by calculating all frames and then sharing them across points.
		 * Is currently calculating a frame once for each point that it is in.
		 * ###################################
		 */
		for(var i=0; i<n; i++){
			var start = i*frame;
			var ptFrame = seq.substring(start, start + width);
			
			var pt = [];
			for(var d=0; d<dim; d++){
				var start = d*frame;
				pt.push(parseInt(ptFrame.substring(start, start+frame), 4)); //use parseInt radix of 4
			}
			
			pts.push(pt);
		}
		return pts;
	},
	
	plot2D : function(pts, frame){
		var size = 512;
		var stage = new Kinetic.Stage({
			container: 'cloud',
			width: size,
			height: size
		});

		var n = 0;
		var scale = size / Math.pow(4, frame);
		var layer = new Kinetic.Layer();
		for(var p in pts) {
			layer.add(new Kinetic.Circle({
				x: pts[p][0] * scale,
				y: pts[p][1] * scale,
				radius: 2,
				fill: 'rgba(0,0,255,'+(800/pts.length)+')',
				id: 'pt'+p,
				transformsEnabled: 'position'
			}));

			n++;
			if(n >= 1000) {
				n = 0;
				stage.add(layer);
				layer = new Kinetic.Layer();
			}
		}
		stage.add(layer);
	},
	
	plot3D : function(pts, frame){
		var scene = new THREE.Scene();
		scene.fog = new THREE.FogExp2( 0xefd1b5, 0.25 );
		var camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000 );

		var renderer = new THREE.WebGLRenderer();
		renderer.setSize( 512, 512 );
		$('#cloud').append($(renderer.domElement));
		
		var geometry = new THREE.Geometry();
		var trans = -Math.pow(4, frame-0.5); //frame - 1 is the same as dividing by 2
		for(var p in pts){
			geometry.vertices.push(new THREE.Vector3(pts[p][0], pts[p][1], pts[p][2]).addScalar(trans));
		}
		
		var cloud = new THREE.PointCloud(geometry, new THREE.PointCloudMaterial({
			size: 0.1*frame
		}));
		scene.add(cloud);

		camera.position.set(0, -trans*1.5, trans*2.5);
		
		var rotate = new THREE.Vector3(0, 1, 0);
		var origin = new THREE.Vector3(0, 0, 0);
		var render = function () {
			requestAnimationFrame(render);
			camera.position.applyAxisAngle(rotate, 0.01);
			camera.lookAt(origin);
			renderer.render(scene, camera);
		};

		render();
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

$(genecloud.test);
$(genecloud.init);
$(genecloud.render);
