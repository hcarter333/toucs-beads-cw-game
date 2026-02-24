For the simon game, we want to have a list of letters and numbers, and the morse code it corresponds to (like the morse code program we already have). then we need to have something that’ll randomly choose from that list, then play it. Once that happens, the person playing the game is supposed to send back whatever was played. Then the code plays the first letter and another random letter, and the player sends them both back. And so on.  
When you send the wrong letter, the game will play a sound, then display how many letters you got right, and ask if you want to play again. If you click “ok”, the program restarts.  
We also need a button to speed up the Morse code sending speed and one to slow it down.   
This will use the iambic keyer we already have build into the existing .js file [pt-cwsimon.js](https://github.com/hcarter333/toucs-beads-cw-game/blob/main/pt-cwsimon.js) to make it easier.

# Description

When you play the simon game, it’ll play a letter in Morse code and display that letter briefly on the phone sreen as an overlay that will fade back away after 0.5 seconds by default, and then you’re supposed to send it back using the iambic keyer that already existis in the code base. Then the game will send out that letter plus another another randomly chose letter. On each turn, all the previously chosen letters will be sent followed by a newly chosen letter. The user will have to input the letters correctly using the iambic keyer. (This is a design choice so that it's easy to tell whether the user sent a dit or a dah.) The game continus until you send back a letter incorrectly. When that happens, a screen will pop up saying how many letters you got right, and ask if you want to play again. If you hit ok, the game will start over.

# Requirements

## code requirements

All code will be written in JavaScript.

### letter chooser

We need a list of letters and numbers, and the Morse code it corresponds to, and something to randomly choose from that list, then play it. 

Then we need to have something that will keep track of the letters that have already been played, and play them before the next letter.

### speaker

The letter chooser will send the letters to the speaker, and it will play them however fast the configuration settings specify. this code already exists and can be found [here](https://github.com/hcarter333/projecttoucans-cw-practice/blob/c6a801d78db88441a5d9007d61e7f8039eea4ae7/src/pt-iambic.js#L623) 

### user input interface 

We also need something to watch what the player is sending back, and match the dits and dahs with what was played. The iambic keyer code already identifies dit and dah buttons, (area 1 and 3 on the screen respectively). The easy way to do this is to assemble the input dits and dahs and compare against the dits and dahs for the stream of letters that is sent on each turn.

The letter being output in morse code will be displayed on a very large font that will fade after .5 seconds.

When the player enters a letter incorrectly, we need a screen saying “do you want to play again” and a button saying "ok" to pop up. 

### user configuration interface

This is where the user will be able to set the words per minute

This will also be where they can turn on and off the losing sound

Letter speed and word speed should be individually configurable

### game defaults

The words per minute should be set at 8 words per minute (WPM)

### scorekeeper

We also need something to keep track of how many rounds (turns) they got through before they messed up, then display that. 

## development flow

The pieces of the game will be developed in parallel

1. play incrementally increasing sequence of letter every time the user clicks a button from step one  
2. implement user interface morse code letter input using the existing iambic keyer interface. Don't change the iambic keyer input.  
3. Add checking code in startIambic. It will look at what buttons are being pressed, and match that up with what was sent. We'll use toneUnits to do that. 


The html file will only use <script> tags to pull in .js code. There will be no Node.js, npm build process

We need to make a new file called pt-simon.js and cwsimon.html.

