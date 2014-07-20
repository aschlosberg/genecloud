$(function(){

	var toggle = function(){
		var check = $(this).siblings('input[type=checkbox]');
		check.prop('checked', !check.prop('checked'));
		$(this).each(setIcon);
	}
	
	var setIcon = function(){
		var check = $(this).siblings('input[type=checkbox]').hide();
		var icons = ['unchecked', 'check'];
		var is = check.prop('checked') ? 1 : 0;
		$(this)
			.blur()
			.find('>.glyphicon')
				.removeClass('glyphicon-'+icons[1-is])
				.addClass('glyphicon-'+icons[is]);
	}
	
	$('.btn.btn-checkbox')
		.each(function(){
			$(this)
				.html(' '+$(this).html())
				.prepend($('<span>').addClass('glyphicon'));
		})
		.each(setIcon)
		.click(toggle);
});
