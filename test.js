var yamaha = new Yamaha({
	ip: '192.168.1.217'
});

yamaha.isOn().then(function(result){
	console.log(result);
});
