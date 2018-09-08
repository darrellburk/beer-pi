# beer-pi
Turn a chest freezer into a kegerator or temperature-controlled fermentation chamber, using a Raspberry Pi 3, 2 DS18B20 temperature probes, and a relay


TODO stuff to automate 

In the end there should be an install script designed to work as follows
1) start with a fresh Raspberry Pi
2) copy the beer-pi package onto it somewhere, then cd into it
3) execute the install script, which will
  a) install npm if needed
  b) use "npm install" to install the Node dependencies for the project
  c) generate/fix up the beer-pi.service file
  d) install beer-pi.service

To install the service

# put the service definition in the right place
sudo cp beer-pi.service /lib/systemd/system/
# start the service now
sudo systemctl start beer-pi
# enable the service to start after boot
sudo systemctl enable beer-pi
# cause systemd to reload the service definition after it is changed on disk
sudo systemctl daemon-reload


TODO installer needs to generate [parts of] beer-pi.service, including
+ path to where systemd wants the .service file to be
+ path to nodejs

TODO installer needs to do "npm install"