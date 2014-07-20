<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>GeneCloud Visualisation</title>
		
		<script src="//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/kineticjs/5.0.6/kinetic.min.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/three.js/r68/three.min.js"></script>
		<link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css">
		<link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap-theme.min.css">
		<script src="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>

		<script src="js/genecloud.js?fresh=<?=strpos($_SERVER['HTTP_HOST'], "localhost")===false ? `git log --pretty=format:'%h' -n 1` : time()?>"></script>
		
		<!--[if lt IE 9]>
			<script src="https://oss.maxcdn.com/html5shiv/3.7.2/html5shiv.min.js"></script>
			<script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
		<![endif]-->
	</head>
	<body>
		<div class="container">
			<hr />
			<div class="row">
				<div class="col-lg-3"></div>
				<div id="cloud" class="col-lg-6" style="text-align: center;"></div>
				<div class="col-lg-3">
					<div class="input-group">
						<div class="input-group-addon">x</div>
						<input id="x" class="form-control" />
					</div>
					<hr />
					<div class="input-group">
						<div class="input-group-addon">y</div>
						<input id="y" class="form-control" />
					</div>
				</div>
			</div>
			<hr />
			<div class="row">
				<div class="col-lg-6">
					<textarea id="seq" class="form-control"><?=file_get_contents("./fasta/BRCA1")?></textarea>
				</div>
				<div class="col-lg-3">
					<select id="fasta" class="form-control">
						<?php foreach(preg_split("/[\s]+/", trim(`ls ./fasta | fgrep -v .`)) as $fasta) { $fasta = htmlentities($fasta); echo "<option value='{$fasta}'>{$fasta}</option>"; } ?>
					</select>
				</div>
				<div class="col-lg-3">
					<button id="load" type="button" class="btn btn-default btn-block">Load &amp; Render</button>
				</div>
			</div>
			<hr />
			<div class="row">
			
				<div class="form-group col-lg-3">
					<div class="input-group">
						<div class="input-group-addon">k</div>
						<input id="frame" class="form-control" value="3" />
					</div>
				</div>
				
				<div class="form-group col-lg-3">
					<div class="input-group">
						<div class="input-group-addon">dim</div>
						<select id="dim" class="form-control"><option value="2">2D</option><option value="3" selected="selected">3D</option></select>
					</div>
				</div>
				
				<div class="form-group col-lg-3">
					<div class="input-group">
						<div class="input-group-addon">rank</div>
						<select id="rank" class="form-control"></select>
					</div>
				</div>
				
				<div class="col-lg-3">
					<button id="go" type="button" class="btn btn-default btn-block">Render</button>
					<button id="save" type="button" class="btn btn-default btn-block">Save Image</button>
				</div>
			</div>
		</div>
	</body>
</html>
