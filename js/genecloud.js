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
	
	render : function(){
		try {
			genecloud.fetchAngles = false; //restart it when we create a new 3D clouds
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
			
			var dim = $('#3d').prop('checked') ? 3 : 2;
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
			var node = new Kinetic.Circle({
				x: pts[p][0] * scale,
				y: pts[p][1] * scale,
				radius: 2,
				fill: 'rgba(0,0,255,'+(800/pts.length)+')',
				id: p,
				transformsEnabled: 'position'
			});
			
			node.on('mouseover', function(e){
				$('#x').val(genecloud.kmer(pts[e.target.getId()][0], frame));
				$('#y').val(genecloud.kmer(pts[e.target.getId()][1], frame));
				e.cancelBubble = true;
			});
			layer.add(node);

			n++;
			if(n >= 1000) {
				n = 0;
				stage.add(layer);
				layer = new Kinetic.Layer();
			}
		}
		stage.add(layer);
	},
	
	currAngles : [0, 0, 0],
	fetchAngles : false,
	animateAngle : 0,
	animateInc : -0.01,
	
	angles : function(){
		$.getJSON('http://localhost:8000/gyroAngle', function(data){
			genecloud.currAngles = data;
			if(genecloud.fetchAngles){
				setTimeout(genecloud.angles, 0);
			}
		});
	},
	
	plot3D : function(pts, frame){
		genecloud.fetchAngles = true;
		setTimeout(genecloud.angles, 0);
	
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

		var axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)];
		var origin = new THREE.Vector3(0, 0, 0);
		
		var render = function () {
			requestAnimationFrame(render);
			
			if($('#imu').prop('checked')){
				camera.position.set(0, 0, trans*3);
				for(var i=0; i<2; i++){
					camera.position.applyAxisAngle(axes[i], genecloud.currAngles[i]);
				}
			}
			else {
				genecloud.animateAngle += genecloud.animateInc;
				camera.position.set(0, -trans*2, trans*3)
				camera.position.applyAxisAngle(axes[1], genecloud.animateAngle);
			}
			
			camera.lookAt(origin);
			renderer.render(scene, camera);
		};

		render();
	},
	
	kmer : function(x, frame){
		x = parseInt(x);
		var kmer = '';
		var rank = $('#rank').val();
		for(var i=0; i<frame; i++){
			kmer = rank[x & 3] + kmer;
			x = x >> 2;
		}
		return kmer;
	},
	
	load : function(){
		$.get('./fasta/'+$('#fasta').val(), function(data){
			$('#seq').val(data);
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

$(genecloud.test);
$(genecloud.init);
$(genecloud.render);
