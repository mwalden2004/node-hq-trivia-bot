const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})
const request = require('request');
const fs = require('fs');
const WebSocket = require('ws');
const spawn = require('child_process').spawn;
let connected = false;
if (process.env.process_restarting) {
	delete process.env.process_restarting;
	setTimeout(main, 1000);
	return;
}
const configExists = fs.existsSync("./config.json");
const logfile = "./game_logs";

let quedMessages = {};



if (configExists == false){
	readline.question(`What is your Phone Number for HQ? `, (phone) => {
		request.post({
		  url: 'https://api-quiz.hype.space/verifications',
		  headers: {
			  "User-Agent": "HQ-iOS/89 CFNetwork/808.2.16 Darwin/16.3.0",
			  "x-hq-client": "iOS/1.3.6 b89"
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
							  "x-hq-client": "iOS/1.3.6 b89"
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
	fs.readFile('./config.json', 'utf8', function(err, rawconfig){
		const config = JSON.parse(rawconfig);
		
		const config_headers = {
            'User-Agent':       'HQ-iOS/89 CFNetwork/808.2.16 Darwin/16.3.0',
            'Connection':       'keep-alive',
            'x-hq-stk':         'MQ==',
            'x-hq-device':      'iPhone6,1',
            'Accept':           '*/*',
            'Accept-Language':  'en-us',
            'x-hq-client':      'iOS/1.3.6 b89',
            'Authorization':    `Bearer ${config["authToken"]}`
        }
		
		function handleConnectionToSocket(broadcast){
			
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
			
			const socketUrl = broadcast.socketUrl.replace("https", "wss");
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
			function logMessage(LMSG){
				const logFile = logfile+"/"+gameid+"/gameLog.json"
				fs.appendFile(logFile, JSON.stringify(LMSG), function (err) {
					if (err){
						console.log("Write Error: "+err);
					}
				})
			}
			const ws = new WebSocket(socketUrl, {
				headers: {
					'Authorization': `Bearer ${config["authToken"]}`
					, 'User-Agent': 'okhttp/3.8.0'
					, 'x-hq-client': 'Android/1.5.1'
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
			});
			ws.on('close', () => {
				console.log('Disconnected from websocket');
				connected = false;
				handleConnectionToSocket(broadcast)
			});
			
			
			ws.on('message', async (message) => {
				try {
					const decoded = JSON.parse(message);
					
					logMessage(decoded);
					console.log(decoded)
					
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
								handleConnectionToSocket(broadcast);
								
							}
						}else{
							console.log("Next show in: "+showTime)
						}
					} catch (e) {
						console.log("Strange invalid JSON: "+body);
					}
					
				}
			})
		}
		setTimeout(tryConnection, 500);
	});
}