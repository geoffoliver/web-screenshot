var http = require('http');
var url = require('url');
var fs = require('fs');
var phantom = require('phantom');
var im = require('imagemagick');

function handleRequest(request, response){
	if(!request.url){
		return;
	}

	var req = url.parse(request.url, true);
	if(!req.query || !req.query.url){
		return;
	}

	var dom = url.parse(req.query.url),
		savePath = __dirname+'/screenshots/'+dom.host+'.jpg',
		expire = new Date().getTime() - 864000;

	fs.access(savePath, fs.F_OK, function(err){
		if(!err){
			var fileStat = fs.statSync(savePath);
			if(fileStat && fileStat.isFile() && new Date(fileStat.ctime).getTime() > expire){
				console.log('found file. using cached version');
				var img = fs.readFileSync(savePath);
				response.writeHead(200, {'Content-Type': 'image/jpg' });
				response.end(img, 'binary');
				return;
			}
		}
		
		console.log('creating new screenshot');
		phantom.create("--web-security=no", "--ignore-ssl-errors=yes", "--ssl-protocol=any", function(ph){
			ph.createPage(function(page){
				page.set('viewportSize', {width:1280,height:900}, function(){
					page.set('clipRect', {top:0,left:0,width:1280,height:900}, function(){
						console.log('Requesting:', req.query.url);
						page.open(req.query.url, function(status){
							console.log('status', status);
							if(status === 'fail'){
								response.end();
								ph.exit();
								return;
							}
							page.render(savePath, function(d){
								console.log('rendered');
								im.resize({
									width: 800,
									srcPath: savePath,
									dstPath: savePath,
									stripe: true
								}, function(){
									var img = fs.readFileSync(savePath);
									response.writeHead(200, {'Content-Type': 'image/jpg' });
									response.end(img, 'binary');
									ph.exit();
								});
							});
						});
					});
				});
			});
		}, {
		    dnodeOpts: {weak: false}
		});
	});
}

var server = http.createServer(handleRequest);

server.listen(9000, function(){
	console.log('Listening on port 9000');
});
