module.exports = function(){
    return {
        
        "SocketMessage": function(message){
            return new Promise(function(resolve, reject) {
                if (message == "question"){
                    const search = require("./solve.js")(message)
                }else{
                    reject("invalid type")
                }
            })
        }

    }
}