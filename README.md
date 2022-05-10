# WebTransport over QUIC comparison with WebSockets over TCP

This repository holds the files that were used for the comparison between WebTransport and WebSockets. The basis of the work is to get a view on what is the relative
performance of WebTransport over to WebSockets over TCP using known benchmarks that have been run on WebSockets as a basis for the experiment. The work done in https://github.com/matttomasetti/NodeJS_Websocket-Benchmark-Client formed the basis of the client in the tests.

When this test was run there weren't any code implemenations of a full WebTransports library, there is a library available for use within the Chrome browser which
was released in version 97 of Chrome in January 2022. Therefore the comparisons performed within this project were generally within a browser. The tests performed the following

* open 50 conenctions at a time for 5 rounds of the test ( total of 250 connections opened )
* on each round of the test 100 messages per connection are sent to an echo server and the response waited on. The start and end time of each trip is stored
* metrics are generated for each round of the test which capture the following
   * average connection time
   * average message response time
   * Longest message response time
   * shortest message response time
   * elapsed time for the test
* The results of the test are output to the browser


## Running the tests

To execute the tests, firstly clone the files in this repo to a local machine.


## WebSocket Tests

An echo server needs to be setup which can be used for the test. A sample server can be located at the project https://github.com/matttomasetti/Python-Websockets_Websocket-Benchmark-Server. Follow the instructions and start the server at this location. Ensure that the TCP port 8080 is open on the VM for incoming traffic


To run the client, open a Chrome browser, and select the index_ws.html that was cloned to the local machine. In the url window of the browser input the IP address of the server and click run WebSocket test


## WebTransport Tests

An echo server needs to be setup for accepting the WebTransport requests. There is a sample server at the project https://github.com/aiortc/aioquic which can be used. Instructions are given at this location on how to setup the server. Ensure that the UDP port 4433 is open on the VM for incoming traffic.

Client
It is necessary to have version 97 or later of the Chrome browser to have WebTransport support within the browser. The browser also needs to be opened with the following commands to ensure that the traffic is over QUIC

open /Applications/Google\ Chrome.app --args --ignore-certificate-errors-spki-list=BSQJ0jkQ7wwhR7KvPZ+DSNk2XTZ/MS6xCbo9qu++VdQ= --enable-experimental-web-platform-features --origin-to-force-quic-on=IP of server:4433
  
Once the browser is started select the index_wt.html that was cloned. In the server url box input the IP address of the server and click on the Run WebTransport test option to execute the tests.
  
  
  
 ## Additional Tests
  The initial WebTransport test above opens a stream for each message to send over a connection. There are additional tests which open a single stream and send all the messages across this stream, and a datagram where messages are sent as un-guaranteed messages. The following are the html files to load to run each of these tests.
* Single stream    index_ss.html
* Datagram         index_dg.html
  







