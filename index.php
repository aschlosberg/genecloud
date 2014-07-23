<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>GeneCloud Visualisation</title>
		
		<script src="//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>
		<link rel="stylesheet" href="//ajax.googleapis.com/ajax/libs/jqueryui/1.11.0/themes/smoothness/jquery-ui.css" />
		<script src="//ajax.googleapis.com/ajax/libs/jqueryui/1.11.0/jquery-ui.min.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/kineticjs/5.0.6/kinetic.min.js"></script>
		<script src="//cdnjs.cloudflare.com/ajax/libs/three.js/r68/three.min.js"></script>
		<link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css">
		<link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap-theme.min.css">
		<script src="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>

		<?php
		//ensure fresh javascript based on time when developing locally or git commit in production
		define('LOCALHOST', strpos($_SERVER['HTTP_HOST'], "localhost")!==false);
		if(!LOCALHOST){
			$fresh = htmlentities(`git log --pretty=format:'%h' -n 1`); //just to be safe
		}
		else {
			$fresh = time();
		?>
		<script src="http://localhost:3000/socket.io/socket.io.js"></script>
		<?php
		}
		?>
		<script src="js/btn-checkbox.js?fresh=<?=$fresh?>"></script>
		<script src="js/genecloud.js?fresh=<?=$fresh?>"></script>
		
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
			<div class="row panel panel-default">
				<div class="panel-body">
					<div class="col-lg-6">
						<textarea id="seq" class="form-control"><?=file_get_contents("./fasta/BRCA1")?></textarea>
					</div>
					<div class="col-lg-3">
						<select id="fasta" class="form-control">
							<?php foreach(preg_split("/[\s]+/", trim(`ls ./fasta | fgrep -v .`)) as $fasta) { $fasta = htmlentities($fasta); echo "<option value='{$fasta}'>{$fasta}</option>"; } ?>
						</select>
					</div>
					<div class="col-lg-3">
						<button id="load" class="btn btn-default btn-block">Load &amp; Render</button>
					</div>
				</div>
			</div>
			<div class="row panel panel-default">
				<div class="panel-body">
					<div class="form-group col-lg-3">
						<div class="input-group" data-help="Width of the <a href='http://en.wikipedia.org/wiki/K-mer'>k-mer</a>s used in the calculation of entropy values or of point positions in the 2D / 3D visualisation.">
							<div class="input-group-addon">k</div>
							<input id="k" class="form-control" value="3" />
						</div>
					</div>
			
					<div class="form-group col-lg-3">
						<div class="input-group" data-help="2D and 3D formats represent adjacent pairs / triplets (respectively) of kmers. Entropy format displays the <a href='http://en.wikipedia.org/wiki/Entropy_(information_theory)'>Shannon entropy</a> of a shifting window, mapped to a <a href='http://en.wikipedia.org/wiki/Hilbert_curve'>Hilbert curve</a>.">
							<div class="input-group-addon">Format</div>
							<select id="format" class="form-control">
								<?php foreach(array("2" => "2D", "3" => "3D", "ent" => "Entropy") as $val => $lbl) { echo "<option value='{$val}'>{$lbl}</option>"; } ?>
							</select>
						</div>
					</div>
			
					<div class="form-group col-lg-3">
						<div class="input-group" data-help-title="Lexicographical Order" data-help="<em>Only applies to 2D and 3D formats.</em><br /><br /><a href='http://en.wikipedia.org/wiki/K-mer'>k-mer</a>s are treated as <a href='http://en.wikipedia.org/wiki/Radix'>base</a>-4 numbers by utilising any of the possible <a href='http://en.wikipedia.org/wiki/Lexicographical_order'>lexicographical orderings</a>. The first is assigned the decimal value 0, the second assigned 1, and so on.">
							<div class="input-group-addon">Order</div>
							<select id="order" class="form-control"></select>
						</div>
					</div>
			
					<div class="col-lg-3">
						<button id="render" class="btn btn-default btn-block">Render</button>
					</div>
					
					<div class="clearfix visible-lg-block"></div>
					
					<div class="btn-group col-lg-3">
						<button class="btn btn-default btn-checkbox btn-block" data-help="Shifting by k treats the nucleotides in much the same way as translation, whereby there are no shared nucleotides between visualisation points or entropy 'bins'. Alternatively the reading frame is shifted by 1, and points share up to k-1 nucleotides depending on their proximity in the sequence.">
							Shift reading-frame by k
						</button>
						<input id="shift" type="checkbox" checked />
					</div>
					
					<div class="col-lg-3">
						<button class="btn btn-default btn-block btn-checkbox" data-help="Utilise <a href='http://nodejs.org'>node.js</a> and <a href='https://play.google.com/store/apps/details?id=org.zwiener.wimu'>Wireless IMU</a> to control 3D visualisations using your Android device's accelerometer and gyroscope. <em>Requires local installation.</em>">Android Remote</button>
						<input id="imu" type="checkbox" />
					</div>
					
					<div class="col-lg-3" data-help="The number of k-mer pairs (2D) or triplets (3D) represented by each point is displayed as size, colour, or transparency. This is calculated as the ratio of the point-value to the maximum value, to the power of this slider value (0, 1] i.e. 1 is a linear representation and 0.5 is the square root of the ratio.">
						<div class="col-lg-10" id="range"></div>
					</div>
					
					<div class="col-lg-3">
						<button id="save" class="btn btn-default btn-block">Save Image</button>
					</div>
				</div>
			</div>
		</div>
	</body>
</html>
