const debug = false;
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})
const request = require('request');
const fs = require('fs');
const WebSocket = require('ws');
const spawn = require('child_process').spawn;
const moment = require('moment');
let connected = false;
if (process.env.process_restarting) {
	delete process.env.process_restarting;
	setTimeout(main, 1000);
	return;
}
const configExists = fs.existsSync("./config.json");
const logfile = "./game_logs";
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = 80

const HQTrivia = require("./src/game_types/trivia/index.js");
const HQWords = require("./src/game_types/words/index.js");

const Stream = require('node-rtsp-stream')

let quedMessages = [];

const newLine = require('os').EOL;

let connections = [];

if (configExists == false){
	readline.question(`What is your Phone Number for HQ? `, (phone) => {
		request.post({
		  url: 'https://api-quiz.hype.space/verifications',
		  headers: {
			  "User-Agent": "hq-viewer/1.6.1 (iPhone; iOS 11.1.1; Scale/3.00)",
			  "x-hq-client": "Android/1.6.1"
		  },
		  form: {
			method: "sms",
			phone: "+1"+phone
		  }
		}, function(error,response,body){
			if (error){
				console.log("ERROR: "+error);
			}else{
				const parsed = JSON.parse(body);
				if (parsed["error"] == null){
					const verifyId = parsed["verificationId"];
					readline.question(`Please enter the code you just recived `, (code) => {
						request.post({
						  url: 'https://api-quiz.hype.space/verifications/'+verifyId,
						  headers: {
							  "User-Agent": "HQ-iOS/89 CFNetwork/808.2.16 Darwin/16.3.0",
							  "x-hq-client": "Android/1.6.1"
						  },
						  form: {
							code: code
						  }
						}, function(error,response,body){
							if (error){
								console.log("ERROR: "+error);
							}else{
								const parsed = JSON.parse(body);
								if (parsed["auth"] == null == false){
									let newParsed = parsed["auth"];
									/*
									{ auth:
									   { userId: userid,
										 username: 'name',
										 admin: false,
										 tester: false,
										 guest: false,
										 avatarUrl: 'https://cdn.hy.pe/a/42/',
										 loginToken:
										  '',
										 accessToken:
										  '..-',
										 authToken:
										  '..',
										 canEnterReferral: true,
										 wasReferralDenied: false } 
										}
										 */
									//WHOOO!
									console.log("Hello "+newParsed["username"]+", please wait while we set up some config files. Once this is finished this will restart and then your bot will be ready!");
									let newConfig = {};
									
									newConfig["username"] = newParsed["username"];
									newConfig["userId"] = newParsed["userId"];
									newConfig["loginToken"] = newParsed["loginToken"];
									newConfig["accessToken"] = newParsed["accessToken"];
									newConfig["authToken"] = newParsed["authToken"];
									
									fs.writeFile('config.json', JSON.stringify(newConfig), 'utf8',function(error){
										if (error){
											console.log(error);
										}
									})
									
									console.log("Restarting...");
									
									spawn(process.argv[0], process.argv.slice(1), {
										env: { process_restarting: 1 },
										stdio: 'ignore'
									}).unref();
									process.kill()
								}else{
									console.log("ERROR: "+parsed["error"]);
								}
							}
						})
					})
				}else{
					console.log("ERROR: "+parsed["error"]);
				}
			}
		});
	})
}else{
	if (debug){
		stream = new Stream({
			name: 'DEBUG',
			streamUrl: "rtsp://184.72.239.149/vod/mp4:BigBuckBunny_175k.mov",
			wsPort: 6541,
			ffmpegOptions: {
				'-q': `1`
			}
		});
	}
	
	app.get('/', (req, res) => {
		if (connected){
			res.sendFile(__dirname +"/src/web/index.html")
		}else{
			res.send("Not connected to websocket, therefore there must be no active show or an error has occured. Reload if you know there is an active show.")
		}
	})

	  io.on('connection', function(socket){
		thisid = Math.random();
		connections.push({socket: socket, id: thisid})
		socket.on('disconnect', function(){
		  let number = 0;
		  connections.forEach(element => {
			  if (element.id == thisid){
					connections.splice(number,1)
					number=number+1;
			  }
		  });
		});
	  });

	let gameHook;
	fs.readFile('./config.json', 'utf8', function(err, rawconfig){
		const config = JSON.parse(rawconfig);
		
		const config_headers = {
			 'User-Agent': 'HQ-iOS/121 CFNetwork/975.0.3 Darwin/18.2.0'
			, 'x-hq-client': 'iOS/1.3.27 b121'
			, 'x-hq-lang': 'en'
			, 'x-hq-country': 'US'
			, 'x-hq-stk': 'MQ=='
			, 'x-hq-timezone': 'America/Chicago',
            'Authorization':    `Bearer ${config["authToken"]}`
        }
		
		function handleConnectionToSocket(broadcast,gameType,debug){
			
						/*
						{
						  "broadcast": {
							"broadcastId": 45758
							"title": "Wirecast stream",
							"status": 1,
							"state": "live",
							"channelId": 100,
							"created": "2018-07-05T03:54:54.000Z",
							"started": "2018-07-05T03:54:54.000Z",
							"ended": null,
							"socketUrl": "https://ws-quiz.hype.space/ws/45758",
							"streamUrl": "rtsp://edge-global.hype.space:1935/live/wirecast_high",
							"streamKey": "wirecast",
						  },
						}
						*/
/*
			if (gameType == "words"){
				gameHook = HQWords(broadcast, gameType)
			}else{
				gameHook = HQTrivia(broadcast, gameType)
			}*/

			let socketUrl = "";
			if (debug){
				socketUrl = "ws://hqecho.herokuapp.com"
				socketUrl = "ws://localhost:8080"
			}else{
				socketUrl = broadcast.socketUrl.replace("https", "wss");
			}
			const gameid = broadcast["broadcastId"];
			if (fs.existsSync(logfile+"/"+gameid) == false){
				fs.mkdirSync(logfile+"/"+gameid);
			}
			if (fs.existsSync(logfile+"/"+gameid+"/gameLog.json") == false) {
				fs.writeFile(logfile+"/"+gameid+"/gameLog.json", JSON.stringify({}), function(err) {
					if(err) {
						console.log("LOG CREATION ERROR: "+err);
					}
				}); 
			}
			function logMessage(FileName,LMSG){
				const logFile = logfile+"/"+gameid+"/"+FileName+".json"
				fs.appendFile(logFile, JSON.stringify(LMSG)+","+newLine, function (err) {
					if (err){
						console.log("Write Error: "+err);
					}
				})
			}
			const ws = new WebSocket(socketUrl, {
				headers: {
					'Authorization': `Bearer ${config["authToken"]}`
					, 'User-Agent': 'HQ-iOS/121 CFNetwork/975.0.3 Darwin/18.2.0'
					, 'x-hq-client': 'iOS/1.3.27 b121'
					, 'x-hq-lang': 'en'
					, 'x-hq-country': 'US'
					, 'x-hq-stk': 'MQ=='
					, 'x-hq-timezone': 'America/Chicago'
				}
			})
			
			function send(JSON){
				quedMessages.push(JSON)
			}
			
			ws.on('open', () => {
				console.log(`Connected to websocket - ${socketUrl}`);
				connected = true;

				let sending = false;

				setInterval(() => {
					if (ws.readyState === WebSocket.OPEN){
						if (!sending){
							sending = true;
							ws.send(JSON.stringify({type: "ping"}))
							sending = false;
						}
					}
				}, 5000)

				setInterval(() => {
					if (ws.readyState === WebSocket.OPEN){
						if (quedMessages.length !== 0){
							if (!sending){
								sending = true;
								ws.send(quedMessages[0]);
								quedMessages.splice(0,1)
								sending = false;
							}
						}
					}
				}, 200)

			});
			ws.on('close', () => {
				console.log('Disconnected from websocket');
				connected = false;
				handleConnectionToSocket(broadcast)
			});
			
			
			ws.on('message', async (message) => {
				try {
					const decoded = JSON.parse(message);
					
					connections.forEach(element => {
						element.socket.emit("message",message)
					})

					logMessage("gameLog.json",decoded);
					const type = decoded["type"]
					console.log(decoded)

					if (decoded["type"] !== "interaction"){
						logMessage("SocketLogs.json",decoded);
					}
					if (decoded["type"] == "interaction"){
						logMessage("chatLogs.json",decoded);
					}
					if (decoded["type"] == "question" || decoded["type"] == "questionSummary"){
						logMessage("questionLogs.json",decoded);
					}
					
					//gameHook.search(decoded).then(function(resp){
					//}).catch(function(err){
					//})
					

				} catch (e) {
					console.log("Something went wrong during a message, whoops!")
					console.log(e)
				}
			})


		}
		function tryConnection(){
			request.get("https://api-quiz.hype.space/shows/now?type=",{headers: config_headers},function(error, response, body){
				if (error){
					console.log("ERROR: "+error);
				}else{
					let validJson = true;
					try {
						const showNow = JSON.parse(body);
						const activeShow = showNow["active"];
						const nextShow = showNow["nextShowTime"];
						const nextShowPrize = showNow["nextShowPrize"];
						const upcoming = showNow["upcoming"][0];
						const showTime = new Date(nextShow);
						if (activeShow){
							const showId = showNow["showId"];
							const showType = showNow["showType"];
							const startTime = showNow["startTime"];
							const prize = showNow["prize"];
							const prizePoints = showNow["prizePoints"];
							const broadcast = showNow["broadcast"];
							const gameType = showNow["gameType"];
							const media = showNow["media"];
							const broadcastFull = showNow["broadcastFull"];
							if (connected == false){
								handleConnectionToSocket(broadcast,gameType);
								stream = new Stream({
									name: 'hq-stream',
									url: broadcast["streamUrl"],
									port: 6542,
									ffmpegOptions: { // options ffmpeg flags
									  '-q': '1', // an option with no neccessary value uses a blank string
									  
									}
								  });
								  stream.start();
							}
						}else{
							const showTime = new Date(nextShow);
							let days = moment(nextShow).diff(new Date(),'day')%24;
							let hours = moment(nextShow).diff(new Date(),'hour')%60;
							let minutes = moment(nextShow).diff(new Date(),'minute')%60;
							let seconds = moment(nextShow).diff(new Date(),'second')%60;
							let timeString = "";
							if (days !== 0){
								timeString = timeString+" "+days+" days, "
							}
							if (hours !== 0){
								timeString=timeString+" "+hours+":"
							}
							if (minutes !== 0){
								timeString=timeString+minutes+":"
							}
							timeString=timeString+seconds+" seconds"
							console.log("Next show is: "+upcoming["nextShowLabel"]["title"]+" in"+timeString)
						}
					} catch (e) {
						console.log("Strange invalid JSON: "+body);
						console.log(e)
					}
					
				}
			})

			if (debug){
				handleConnectionToSocket(JSON.parse(`{
					"active": true,
					"atCapacity": false,
					"showId": 5716,
					"showType": "hq",
					"startTime": "2018-07-05T04:00:00.000Z",
					"nextShowTime": null,
					"nextShowPrize": null,
					"nextShowVertical": null,
					"upcoming": [
					{
						"time": "2018-07-06T01:00:00.000Z",
						"prize": "$5,000",
						"vertical": "general"
					}
					],
					"prize": 2500,
					"broadcast": {
					"broadcastId": 45758,
					"userId": 38752,
					"title": "Wirecast stream",
					"status": 1,
					"state": "live",
					"channelId": 100,
					"created": "2018-07-05T03:54:54.000Z",
					"started": "2018-07-05T03:54:54.000Z",
					"ended": null,
					"permalink": "https://hy.pe/b/aWR",
					"thumbnailData": null,
					"tags": [],
					"socketUrl": "https://ws-quiz.hype.space/ws/45758",
					"streams": {
						"source": "rtsp://edge-global.hype.space:1935/live/wirecast_high",
						"passthrough": "rtsp://edge-global.hype.space:1935/live/wirecast_high",
						"high": "rtsp://edge-global.hype.space:1935/live/wirecast_high",
						"medium": "rtsp://edge-global.hype.space:1935/live/wirecast_medium",
						"low": "rtsp://edge-global.hype.space:1935/live/wirecast_low"
					},
					"streamUrl": "rtsp://edge-global.hype.space:1935/live/wirecast_high",
					"streamKey": "wirecast",
					"relativeTimestamp": 207739,
					"links": {
						"self": "/broadcasts/45758",
						"transcript": "/broadcasts/45758/transcript",
						"viewers": "/broadcasts/45758/viewers"
					}
					},
					"gameKey": "hq:23",
					"vertical": "general",
					"broadcastFull": false
				}`),"trivia",true);
				}
		}
		
		setInterval(() => {
			tryConnection();
		}, 500)

		http.listen(port, function(){
			console.log(`listening on *:${port}`);
		  });

	});
}