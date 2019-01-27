const fs = require("fs");
const moment = require("moment");
let read;
const parsing = false;
const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
const WebSocket = require('ws');

if (parsing){
    fs.readFile("./game.json", (error, data) => {
        if (error){
            console.log(error);
            process.kill();
        }else{
            read = data;

            let parse = [];

            const json = JSON.parse(read);
            let firstTime = moment(json[0]["ts"]);

            let number = 0;

            json.forEach(test => {
                number++;
                let time = moment(test["ts"]);
                let saveTime = test["ts"];
                let wait;

                //let diff = time.diff(firstTime, "minutes");
                let diff = moment.duration(time.diff(firstTime));
                test.waitTime = diff.asMilliseconds();

                parse.push(test)
                if (number !== 0){
                    firstTime = moment(saveTime);
                }

                if (number == json.length){
                    fs.writeFile("./parsedGame.json",JSON.stringify(parse),(err) => {
                        if (err){
                            console.log(err);
                        }else{
                            console.log("Done with 0 errors.")
                        }
                    })
                }
            });
        }
    });

}else{

    async function asyncForEach(array, callback) {
        for (let index = 0; index < array.length; index++) {
          await callback(array[index], index, array);
        }
      }
/*
    fs.readFile("./parsedGame.json", (error, data) => {
        if (error){
            console.log(error);
            process.kill();
        }else{
            const jsonParsed = JSON.parse(data);


            const start = async () => {
                await asyncForEach(jsonParsed, async (event) => {
                    await sleep(event.ts);
                });
            }
            start();
        }
    })
*/

    let activeSockets = [];

    const WebSocket = require('ws');

    const wss = new WebSocket.Server({ port: 8080 });
    
    wss.on('connection', function connection(ws) {
        const id = Math.random()*1500;
        activeSockets.push({socket: ws, id: id})
        console.log("someone connected")
        ws.on('message', function incoming(message) {
            console.log('received: %s', message);

        });
        ws.on("close",(data) => {
            let number = 0;
            activeSockets.forEach((socket) => {
                if(socket.id == id){
                    activeSockets.splice(number,1);
                }
                number++;
            })
        })
    
      
    });

    fs.readFile("./parsedGame.json", (error, data) => {
        if (error){
            console.log(error);
            process.kill();
        }else{
            const jsonParsed = JSON.parse(data);


            const start = async () => {
                await asyncForEach(jsonParsed, async (event) => {
                    await sleep(event.waitTime);
                    activeSockets.forEach((socket) => {
                        const ws = socket.socket;
                        if (ws.readyState == WebSocket.OPEN){
                            ws.send(JSON.stringify(event));
                          }
                     })
                });
                start();
            }
            start();
        }
    })

}