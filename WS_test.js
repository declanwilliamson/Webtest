class Connection {

    /**
     * Initializes all the data that will be needed to create and use the websocket client
     *
     * @param benchmark_obj {Object} An object storing data that each client will need to connect to the benchmark
     *      server, and send requests
     * @param connection_progress_obj {Object} An object storing data on the connections currently being made each round
     * @param benchmark_progress_obj {Object} An object storing data on all the requests currently being made each round
     * @returns void
     */
    constructor(benchmark_obj, connection_progress_obj, benchmark_progress_obj) {

        /**
         * Signifies whether the connection should be kept alive, and therefore reconnected if closed
         * @type {boolean}
         */
        this.keep_alive = true;

        /**
         * Client connection to the websocket server
         * @type {WebSocketClient}
         */
        this.client = null;

        /**
         * List of requests made for the round for this client with the requests corresponding timestamps
         * @type {Array}
         */
        this.times = [];

        /**
         * The number of connections that have failed
         * @type {number}
         */
        this.connection_fails = 0;

        /**
         * The number of errors that have occurred
         * @type {number}
         */
        this.connection_errors = 0;

        /**
         * The number of successfully completed requests for a given round
         * @type {number}
         */
        this.count = 0;

        /**
         * An array storing the last 20 count readings
         * @type {Array}
         */
        this.last_count = new Array(20);

        /**
         * An object storing data that each client will need to connect to the benchmark server, and send requests
         * {
         *      websocket_address {string} IP address of the websocket server to connect to
         *      websocket_port: {number} Port number of the websocket to connect to
         *      connection_interval: {number} The number of websocket connections to add each round
         *      request_interval: {number} The number of requests to sound out per connected client per round
         *      request_timeout: {number} The number of minutes to wait before abandoning a request
         * }
         * @type {Object}
         */
        this.benchmark_obj = benchmark_obj;

        /**
         * An object storing data on the connections currently being made each round
         * {
         *      counter: {number} the number of clients currently created each round,
         *      total: {number} the total number of clients expected to me created each round,
         *      message: {string} the message to output before starting the connection process
         * }
         * @type {Object}
         */
        this.connection_progress_obj = connection_progress_obj;

        /**
         * An object storing data on all the requests currently being made each round
         * {
         *      counter: {number} the number of requests currently completed each round,
         *      total: {number} the total number of requests expected to me completed each round,
         *      message: {string} the message to output before starting the benchmarking process
         * }
         * @type {Object}
         */
        this.benchmark_progress_obj = benchmark_progress_obj;

        // redefine the push function for the last_count array to shift the data with each entry
        this.last_count.push = function (){
            if (this.length >= 20) {
                this.shift();
            }
            return Array.prototype.push.apply(this, arguments);
        };
    }

    /**
     * Sends the requests from the websocket clients to the server
     *
     * @returns {Promise} resolves once all requests have been completed, or the process times out
     */
    sendData(){

        // track the number of successful requests
        this.count = 0;

        // empty array which will hold timestamp data for each request made
        this.times = [];

        return new Promise((resolve, reject) => {
            //console.log("In send data");

            // send a total number of requests equal to the specified request interval
            for (let i = 0; i < this.benchmark_obj.request_interval; i++) {

                // ensure the connection is defines before sending, otherwise resolve
                if (this.client !== undefined) {

                    // create a JSON string containing the current request number
                    let data = JSON.stringify({'c': i});

                    // set the starting timestamp for the request to now
                    this.times[i] = {'start':Date.now()};

                    // send the request to the websocket server
                    this.client.send(data);

                } else {
                    resolve();
                }

                // if the request being sent is that last in the loop..
                if(i === this.benchmark_obj.request_interval - 1) {
                    const self = this;
                    var timer = 0;

                    // ... check once per second if the function should resolve
                    const finishCount = setInterval(function () {

                        // The function should resolve if:
                        // 1. There are no requests with a "finish" index which is undefined
                        let readyToResolve = self.times.every(function (time, message_index) {
                            return time['finish'] !== undefined;
                        });

                        // 2. The count tracker of successful requests is equal to the number of requests sent
                        // 3. The number of successful requests is the same as the number of successful requests from
                        //    20 seconds ago AND more than 90% of requests were successful or the request process has
                        //    been running for 5 minutes
                        if ( readyToResolve
                            || ((self.count / self.benchmark_obj.request_interval) === 1)
                            || (self.count === self.last_count[0]
                                && (((self.count / self.benchmark_obj.request_interval) > .9)
                                    || (timer++ >= 100)
                                ))) {

                            // stop checking if the request process has finished, and resolve with the times array
                            clearInterval(finishCount);
                            resolve(self.times);
                        }

                        // Track the count of successful request.
                        // The array stores the last 20 checks (20 seconds).
                        // If the number of successful requests is not changing, we can assume no more
                        // will be coming in.
                        self.last_count.push(self.count);

                    }, 1000);
                }
            }
        });
    }




    /**
     * Sets up a connection to the websocket server
     * and defines event actions
     *
     * @returns {Promise} resolves once connected
     */
    connect(url) {
        return new Promise((resolve, reject) => {
            //console.log("In connect");

            // allows this to be used inside nested functions
            const self = this;

            // initialize websocket client
            this.client= new WebSocket(url);
            this.client.onopen = function () {
                // assign connection variable to member property
                //self.connection = connection;

                // increment connection counter by 1
                self.connection_progress_obj.counter++;

                // start heartbeat to keep connection alive
                self.client.onmessage = async (event) => {
                    // convert the incoming JSON string to an Object
                    //console.log("messages ",event.data);
                    let data = JSON.parse(event.data);
                    //console.log("Data ",data);

                    // ensure incoming message has an already existing corresponding request in the times array
                    if(self.times[data['c']] !== undefined) {

                        // ensure the corresponding request in the times array does not already contain any data from
                        // the websocket server.
                        // This can happen if the server sends the 0 response twice, once when the client connects,
                        // and again each round. For the sake of simple math, we just keep the first one.
                        if (self.times[data['c']]['received'] === undefined
                            && self.times[data['c']]['finish'] === undefined) {

                            // store the corresponding timestamps in the times array
                            self.times[data['c']]['received'] = data['ts'];
                            self.times[data['c']]['finish'] = Date.now();

                            // increment the successful request counters by 1
                            self.benchmark_progress_obj.counter++;
                            self.count++;

                        }
                    }
                };
                resolve();
                }
            this.client.onerror = function (err) {
                //    console.log("error in connect")
                reject(err);
            }
                //resolve();
            });
            this.times[0] = {'start':Date.now()};


        };


    /**
     * Closes the connection to the websocket server
     * @returns {void}
     */
    close(){
        this.keep_alive = false;
        this.client.close();
    }
};


/**
 * Creates, manages, and closes all the websocket clients
 *
 * @type {module.ConnectionManager}
 */

class ConnectionManager {

    /**
     * Initializes all the data that will be needed to create and use websocket clients
     *
     * @param benchmark_obj {Object} An object storing data that each client will need to connect to the benchmark
     *      server, and send requests
     * @param connection_obj {Object} An object storing websocket client connections and connection data
     * @param connection_progress_obj {Object} An object storing data on the connections currently being made each round
     * @param benchmark_progress_obj {Object} An object storing data on all the requests currently being made each round
     * @returns void
     */
    constructor(benchmark_obj, connection_obj, connection_progress_obj, benchmark_progress_obj,url){

        /**
         * Array tracking the number of clients connected each round to determine is the connection process has finished
         * @type {Array}
         */
        this.connected = new Array(benchmark_obj.connection_interval);

        /**
         * An object storing data that each client will need to connect to the benchmark server, and send requests
         * {
         *      websocket_address {string} IP address of the websocket server to connect to
         *      websocket_port: {number} Port number of the websocket to connect to
         *      connection_interval: {number} The number of websocket connections to add each round
         *      request_interval: {number} The number of requests to sound out per connected client per round
         *      request_timeout: {number} The number of minutes to wait before abandoning a request
         * }
         * @type {Object}
         */
        this.benchmark_obj = benchmark_obj;

        /**
         * An object storing websocket client connections and connection data
         * {
         *      connection_time: {number} the total time it took for all the clients to connect each round
         *      times: {Array}, time data produces by each client for each request to the websocket server
                clients: {Array} list of all connected clients
         * }
         * @type {Object}
         */
        this.connection_obj = connection_obj;

        /**
         * An object storing data on the connections currently being made each round
         * {
         *      counter: {number} the number of clients currently created each round,
         *      total: {number} the total number of clients expected to me created each round,
         *      message: {string} the message to output before starting the connection process
         * }
         * @type {Object}
         */
        this.connection_progress_obj = connection_progress_obj;

        /**
         * An object storing data on all the requests currently being made each round
         * {
         *      counter: {number} the number of requests currently completed each round,
         *      total: {number} the total number of requests expected to me completed each round,
         *      message: {string} the message to output before starting the benchmarking process
         * }
         * @type {Object}
         */
        this.benchmark_progress_obj = benchmark_progress_obj;
        this.url=url;
    }

    /**
     * Creates new connections for each round
     *
     * @param round {number} The current round being ran in the benchmarking process
     * @returns {Promise} resolves when all the connections have been made
     */
    createConnections(round) {

        //calculate the number of existing connections
        let existing_client_count = this.benchmark_obj.connection_interval * round;

        //calculate the total number of connections that should exist after the connection process is finished
        let new_client_count = this.benchmark_obj.connection_interval * (round + 1) - 1;

        //create undefined values in the connected array for each expected new connection
        this.connected[new_client_count] = undefined;

        return new Promise((resolve, reject) => {

            //start the connection process
            let connection_start = Date.now();

            //loop for the number of new connections that should be made
            for (let i = 0; i < this.benchmark_obj.connection_interval; i++) {

                //create a new connection
                this.connection_obj.clients[existing_client_count + i] = new Connection(this.benchmark_obj, this.connection_progress_obj, this.benchmark_progress_obj);
                this.connection_obj.clients[existing_client_count + i].connect(this.url).then(() => {
                    //console.log("CM in connect waiting");

                    //set the client number in the connected array as true
                    this.connected[existing_client_count + i] = 1;

                    //if all clients in the connected array have connected, end connection process and resolve
                    if (!this.connected.includes(undefined)) {
                        this.connection_obj.connection_time = Date.now() - connection_start;
                        //console.log("In CM - all connections made");
                        resolve();
                    }
                });
            }
        });
    }

    /**
     * Creates requests on each client for each round
     *
     * @param round {number} The current round being ran in the benchmarking process
     * @returns {Promise} resolves when all requests have been completed/timeout
     */
    sendRequests(round) {
        // clear the times array which contains the previous rounds data
        this.connection_obj.times = new Array(this.benchmark_obj.connection_interval * (round + 1));

        return new Promise((resolve, reject) => {

            //loop through the clients array in the connection object, and start the request process
            for (let i = 0; i < this.connection_obj.clients.length; i++) {
                //console.log("Calling senddata");
                this.connection_obj.clients[i].sendData().then((time) => {
                    this.connection_obj.times[i] = time;

                    // resolve after all requests have been completed/timeout
                    if (!this.connection_obj.times.includes(undefined)) {
                        //console.log("All send requests completed");
                        resolve();
                    }
                });
            }
        });
    }

    /**
     * Closes all open websocket connections
     * returns {void}
     */
    close() {

        //loop through the clients array in the connection object, and close the client connection
        for (let i = 0; i < this.connection_obj.clients.length; i++) {
            this.connection_obj.clients[i].close();
        }
    }
};


/**
 * Calculates the results of each round. Results include the time elapse and success rate of the processes
 *
 * @type {module.Results}
 */
class Results {

    /**
     * Initializes member variables that will be needed by the class
     *
     * @param file_manager {FileManager} Instance of the FileManager class
     * @param request_interval {number} The number of requests to sound out per connected client per round
     * @returns void
     */
    constructor(request_interval){

        /**
         * The number of requests to sound out per connected client per round
         * @type {number}
         */
        this.request_interval = request_interval;
    }

    /**
     * Calculates various statistics on the data from the round, outputs the statistics to the console, and passes
     * then off to the file manager to be saved.
     *
     * @param stats {Object} An object storing websocket client connections and connection data
     * {
     *      connection_time: {number} the total time it took for all the clients to connect each round
     *      times: {Array}, time data produces by each client for each request to the websocket server
     *      clients: {Array} list of all connected clients
     * }
     * @returns void
     */
    calculate(stats) {

        // the number of clients connected
        let client_length = stats.clients.length;

        // time data produces by each client for each request to the websocket server
        let times = stats.times;

        // the total time it took for all the clients to connect each round
        let connection_time = stats.connection_time;

        // set default values for the start and stop times of the request process
        // these will be used to calculate the total elapsed time to complete the requests
        let start_time = Math.floor(new Date(8640000000000000) / 1000);
        let stop_time = 0;

        // set defaults for the the statistics on round trip times for requests
        let longest_rt = 0;
        let shortest_rt = Number.MAX_SAFE_INTEGER;
        let total_rt = 0;

        // the count of total number to requests that were successful
        let count = 0;

        // loop through all the clients that made requests each round
        //console.log("Results times ",times);
        times.forEach((client_time, key) => {
            // for each client, loop through all the requests the client made
            client_time.forEach(trip => {

                // check if the request completed successfully
                if (trip['start'] !== undefined && trip['received'] !== undefined && trip['finish'] !== undefined) {

                    // determine if the request has the earliest start time
                    if (trip['start'] < start_time) {
                        start_time = trip['start'];
                    }

                    // determine if the request has the latest finish time
                    if (trip['finish'] > stop_time) {
                        stop_time = trip['finish'];
                    }

                    // determine the trips round-trip time
                    let trip_time = trip['finish'] - trip['start'];

                    // determine if the trips round-trip time is the longest
                    if (trip_time > longest_rt) {
                        longest_rt = trip_time;
                    }

                    // determine if the trips round-trip time is the shortest
                    if (trip_time < shortest_rt) {
                        shortest_rt = trip_time;
                    }

                    // add the round trip time to the total round-trip time for the round
                    total_rt += trip_time;

                    // add one to the total number of successful requests
                    count++;
                }
            })
        });

        // calculate the average round trip time
        let average_rt = total_rt / count;

        // calculate the total time for the round
        let time_elapse = stop_time - start_time;

        // output statistics to console
        //addMessage("In results");
        console.log("Count: " + count + "/" + (this.request_interval * client_length) + " (" + count / (this.request_interval * client_length) * 100 + "%) " + " | Time Elapse: " + time_elapse);
        console.log("Longest Trip: " + longest_rt + " | Shortest Trip: " + shortest_rt + " | Average Trip: " + average_rt);
        var msg = $('<pre>').text("");
        var messages = $('#messages');
        messages.append(msg);
        messages.append("Count: " + count + "/" + (this.request_interval * client_length) + " (" + count / (this.request_interval * client_length) * 100 + "%) " + " | Time Elapse: " + time_elapse);
        messages.append("      Longest Trip: " + longest_rt + " | Shortest Trip: " + shortest_rt + " | Average Trip: " + average_rt);


    }
};


class Benchmarker {

    /**
     * Initializes all the data that will be needed throughout the program
     *
     * We initialize data that will be shared between mutliple files as objects, becuase
     * objects will be passed as reference, where a primitve variable would be passed by value
     */
    constructor(url) {


        this.url = url;


        /**
         * An object storing data on the connections currently being made each round
         * {
         *      counter: {number} the number of clients currently created each round,
         *      total: {number} the total number of clients expected to me created each round,
         *      message: {string} the message to output before starting the connection process
         * }
         * @type {Object}
         */
        this.connection_progress_obj = {
            counter: 0,
            total: 0,
            message: "Connecting..."
        };

        /**
         * An object storing data on all the requests currently being made each round
         * {
         *      counter: {number} the number of requests currently completed each round,
         *      total: {number} the total number of requests expected to me completed each round,
         *      message: {string} the message to output before starting the benchmarking process
         * }
         * @type {Object}
         */
        this.benchmark_progress_obj = {
            counter: 0,
            total: 0,
            message: "Benchmarking..."
        };

        /**
         * An object storing websocket client connections and connection data
         * {
         *      connection_time: {number} the total time it took for all the clients to connect each round
         *      times: {Array}, time data produces by each client for each request to the websocket server
                clients: {Array} list of all connected clients
         * }
         * @type {Object}
         */
        this.connection_obj = {
            connection_time: 0,
            times: [],
            clients: []
        };

        /**
         * An object storing data that each client will need to connect to the benchmark server, and send requests
         * {
         *      websocket_address {string} IP address of the websocket server to connect to
         *      websocket_port: {number} Port number of the websocket to connect to
         *      connection_interval: {number} The number of websocket connections to add each round
         *      request_interval: {number} The number of requests to sound out per connected client per round
         *      request_timeout: {number} The number of minutes to wait before abandoning a request
         * }
         * @type {Object}
         */
        this.benchmark_obj = {
            websocket_address: "127.0.0.1",
            websocket_port: 8080,
            connection_interval: 50,
            request_interval: 100,
        };


        /**
         * Instance of the Results class. This will be set once the user is prompted for
         * the current language being tested, as it requires the instance of the FileManager
         * @type {module.Results}
         */
        this.result = null;

        /**
         * Instance of the ConnectionManager class
         * @type {module.ConnectionManager}
         */
        this.cm = new ConnectionManager(this.benchmark_obj, this.connection_obj, this.connection_progress_obj, this.benchmark_progress_obj, url);

        /**
         * The number of rounds to perform per test
         * @type {number}
         */
        this.ROUNDS = 5;

    }

    /**
     * Prompts the user at the beginning of the application for the current language being benchmarked
     * @returns {void}
     */
    prompt() {

        // allows this to be used inside nested functions
        let self = this;


        // continue running the programming asynchronously
        let manage_file = async function () {
            self.result = new Results(self.benchmark_obj.request_interval);


            // benchmark the rest of the program
            await self.run_program();
        };
        manage_file();
    };


    /**
     * Loops through the benchmarking process for the given number of rounds,
     * then closed the websocket connections
     * @return {Promise<void>}
     */
    async run_program() {

        // for the number of given rounds, perform the benchmarking process, waiting for each round to finish before
        // continuing
        //console.log("In run program");
        for (let i = 0; i < this.ROUNDS; i++) {
            console.log("\nTest: " + (i + 1) + "/" + this.ROUNDS);
            await this.benchmark(i);
        }
        $('#inProgress').hide();
        $('#webConnect').show();

        // once all round have been completed, close the websocket connections
        await this.cm.close();
    }

    /**
     * Performs the benchmarking process
     * @param round {number} The current iteration count of the round being performed
     * @return {Promise} resolves once the round of the benchmarking process is complete
     */
    async benchmark(round) {
        return new Promise(async (resolve, reject) => {
            try {

                // determine the total number of expected connections
                // REQUEST_INTERVAL * ROUND_NUMBER
                this.connection_progress_obj.total = (round + 1) * this.benchmark_obj.connection_interval;


                // begin the connection process, and wait for it to finish
                await this.cm.createConnections(round);


                // output to the conole the time elapse for the new connections to connect
                console.log("\nConnection Time: " + this.connection_obj.connection_time);
                var msg = $('<pre>').text("");
                var messages = $('#messages');
                messages.append(msg);
                messages.append("Connection Time: " + this.connection_obj.connection_time);


                // start the benchmarking process, and wait for it to finish
                await this.cm.sendRequests(round);


                // calculate the results for the current round of benchmarking
                await this.result.calculate(this.connection_obj);

                // resolve when done
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
}


/**
* main function
* Instantiates an instance of the Benchmarker class, passing the url to the constructer of the call
* calls the prompt method of the Benchmarker class to being running the test
*/
function main(url) {
    let benchmarker = new Benchmarker(url);
    benchmarker.prompt();
}


new function() {

        var serverUrl;


        /**
        * web_test function
        * This is called when the webConnect button is clicked and begins the web test
        * It takes the value of the url from the serverURL value
        * Clears the messag box
        * Puts message that 'Running WebSocket Benchmark
        * Hides the webConnect button and show the In Progress button
        * Calls the main function to start the test with the url
        */
        var web_test = function() {
               console.log("In web test code");
               var url =serverUrl.val();
               console.log("Test URL ",url);
               $('#messages').html('');
               addMessage("Running WebSocket Benchmark");
               webConnect.hide();
               inProgress.show();
               main(url);
        }


        /**
        * clearLog function
        * User to empty the log messages
        */
        var clearLog = function() {
                console.log("In clearlog function");
                $('#messages').html('');
        }

        /**
        * addMessage
        * Function to add messages to the screen
        */
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

        /**
        * WebClient
        * Setups up listener on webConnect button and on clearMessage button
        */
        WebClient = {
                init: function() {
                        serverUrl = $('#serverUrl');

                        webConnect = $('#webConnect');
                        inProgress= $('#inProgress');


                        webConnect.click(function(e) {
                                web_test();
                        });


                        $('#clearMessage').click(function(e) {
                                clearLog();
                        });

                }
        };
}

//Call initialisation of WebClient
$(function() {
        WebClient.init();
});


