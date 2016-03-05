var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var phantom = require('phantom');
var im = require('imagemagick');

function scrapePage(url, response){
	var reqObj = http;
	if(url.indexOf('https:') > -1){
		reqObj = https;
	}
	reqObj.get(url, function(res){
		if(res.statusCode !== 200){
			if(res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
				return scrapePage(res.headers.location, response);
			}else{
				response.writeHead(res.statusCode);
				response.end();
			}
		}else{
			response.writeHead(200, {'Content-Type': 'text/html' });
			res.on('end', function(){
				response.end();
			});
			res.on('data', function(d){
				response.write(d, function(err){
					response.end();
				});
			});
		}
		return true;
	});
}

function handleRequest(request, response){
	if(!request.url){
		response.end();
		return;
	}

	var req = url.parse(request.url, true);
	var action = 'screenshot';
	var actions = ['screenshot','scrape'];

	if(!req.query || !req.query.url){
		response.end();
		return;
	}
	
	if(req.query.action && actions.indexOf(req.query.action) > -1){
		action = req.query.action;
	}

	var dom = url.parse(req.query.url);

	switch(action){
		case 'scrape':
			console.log('Scrape requested:', req.query.url);
			scrapePage(req.query.url, response);
			break;
		case 'screenshot':
		default:
			var savePath = __dirname+'/screenshots/'+dom.host+'.jpg',
				expire = new Date().getTime() - 864000;
			
			console.log('Screenshot requested:', req.query.url);

			fs.access(savePath, fs.F_OK, function(err){
				if(!err){
					var fileStat = fs.statSync(savePath);
					if(fileStat && fileStat.isFile() && new Date(fileStat.ctime).getTime() > expire){
						console.log('Found cached screenshot');
						var img = fs.readFileSync(savePath);
						response.writeHead(200, {'Content-Type': 'image/jpg' });
						response.end(img, 'binary');
						return;
					}
				}
				
				console.log('Creating new screenshot');
				phantom.create("--web-security=no", "--ignore-ssl-errors=yes", "--ssl-protocol=any", function(ph){
					ph.createPage(function(page){
						page.set('viewportSize', {width:1280,height:900}, function(){
							page.set('clipRect', {top:0,left:0,width:1280,height:900}, function(){
								page.set('settings.userAgent', 'Plan8 Screenshot Bot/1.0 (NodeJS, PhantomJS) Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.97 Safari/537.11', function(){
									page.open(req.query.url, function(status){
										console.log('Request status:', status);
										if(status === 'fail'){
											response.end();
											ph.exit();
											return;
										}
										page.render(savePath, function(d){
											console.log('Page Rendered');
											im.resize({
												width: 300,
												srcPath: savePath,
												dstPath: savePath,
												strip: true,
												quality: 0.8,
												progressive: true
											}, function(err){
												if(err){
													response.end();
												}else{
													var img = fs.readFileSync(savePath);
													response.writeHead(200, {'Content-Type': 'image/jpg' });
													response.end(img, 'binary');
												}
												ph.exit();
											});
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
			break;
	}
}

var server = http.createServer(handleRequest);

server.listen(9000, function(){
	console.log('Listening on port 9000');
});
