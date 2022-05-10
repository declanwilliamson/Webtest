# WebTranpost over QUIC comparison with WebSockets over TCP

This repository holds the files that were used for the comparison between WebTransport and WebSockets. The basis of the work is to get a view on what is the relative
performance of WebTransport over to WebSockets over TCP using known benchmarks that have been run on WebSockets as a basis for the experiment. 

When this test was run there weren't any code implemenations of a full WebTransports library, there is a library available for use within the Chrome browser which
was released in version 97 of Chrome in January 2022. Therefore the comparisons performed within this project were generally run within a browser to compare
