Yamaha-js
==================

Simple JS Browser API to control Yamaha network-based receivers. Tested on RX-V673, but may also work on other models.
Any feedback or pull requests are welcome.
This code is initially based on PSeitz's yamaha-nodejs module from here:
https://github.com/PSeitz/yamaha-nodejs/

It also used xmlToJSON library from metatribal:
https://github.com/metatribal/xmlToJSON

The code has been rewritten to work in most browsers and use Promises instead of deferreds.
Each method returns a Promise, so methods can be chained as needed.


