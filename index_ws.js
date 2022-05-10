new function() {
	var ws = [];
	var connected = false;

	var serverUrl;
	var connectionStatus;
	var sendMessage;
	
	var connectButton;
	var disconnectButton; 
	var sendButton;

	var open = function() {
		console.log("In open function");
		var url = serverUrl.val();
                console.log("Server URL ",url);          
                //for ( i=0; i<10; i++) {
                //console.log("Value of i ", i);
                let i =1;
		ws[i] = new WebSocket(url);
		ws[i].onopen = function() { ws[i].send("{\"c\":1}")};
		ws[i].onclose = function() { ws[i].close()};
		ws[i].onmessage = function(event) { addMessage(event.data)};
                //};

                i =2;
                ws[i] = new WebSocket(url); 
                ws[i].onopen = function() { ws[i].send("{\"c\":2}")};
                ws[i].onclose = function() { ws[i].close()};
                ws[i].onmessage = function(event) { addMessage(event.data)};

		connectionStatus.text('OPENING ...');
		serverUrl.attr('disabled', 'disabled');
		connectButton.hide();
		disconnectButton.show();

	}

        var ws_test = function() {
               console.log("In websocket test code");
               var url =serverUrl.val();
               console.log("Test URL ",url);
               addMessage("Running WebSocket Benchmark");
        }

	
	
	var clearLog = function() {
                console.log("In clearlog function");
		$('#messages').html('');
	}
	
	
	var addMessage = function(data, type) {
                console.log("In add message ", data);
		var msg = $('<pre>').text(data);
		if (type === 'SENT') {
			msg.addClass('sent');
		}
		var messages = $('#messages');
		messages.append(msg);
		
		var msgBox = messages.get(0);
		while (msgBox.childNodes.length > 1000) {
			msgBox.removeChild(msgBox.firstChild);
		}
		msgBox.scrollTop = msgBox.scrollHeight;
	}

	WebSocketClient = {
		init: function() {
			serverUrl = $('#serverUrl');
			connectionStatus = $('#connectionStatus');
			sendMessage = $('#sendMessage');
			
			connectButton = $('#connectButton');
			disconnectButton = $('#disconnectButton'); 
			sendButton = $('#sendButton');
                        webSocket = $('#webSocket');
			
			connectButton.click(function(e) {
				close();
				open();
			});

                        webSocket.click(function(e) {
                                ws_test();
                        });
		
			disconnectButton.click(function(e) {
				close();
			});
			
			sendButton.click(function(e) {
				var msg = $('#sendMessage').val();
                                console.log("sendButton message ", msg);
				addMessage(msg, 'SENT');
				ws.send(msg);
			});
			
			$('#clearMessage').click(function(e) {
				clearLog();
			});
			
			var isCtrl;
			sendMessage.keyup(function (e) {
				if(e.which == 17) isCtrl=false;
			}).keydown(function (e) {
				if(e.which == 17) isCtrl=true;
				if(e.which == 13 && isCtrl == true) {
					sendButton.click();
					return false;
				}
			});
		}
	};
}

$(function() {
	WebSocketClient.init();
});
