For the simon game, we want to have a list of letters and numbers, and the morse code it corresponds to (like the morse code program we already have). then we need to have something that’ll randomly choose from that list, then play it. Once that happens, the person playing the game is supposed to send back whatever was played. Then the code plays the first letter and another random letter, and the player sends them both back. And so on.  
When you send the wrong letter, the game will play a sound, then display how many letters you got right, and ask if you want to play again. If you click “ok”, the program restarts.  
We also need a button to speed up the Morse code sending speed and one to slow it down.   
This will use the iambic keyer we already have build into the existing .js file [pt-cwsimon.js](https://github.com/hcarter333/toucs-beads-cw-game/blob/main/pt-cwsimon.js) to make it easier.

# Description

When you play the simon game, it’ll play a letter in Morse code and display that letter briefly on the phone sreen as an overlay that will fade back away after 0.5 seconds by default, and then you’re supposed to send it back using the iambic keyer that already existis in the code base. Then the game will send out that letter plus another another randomly chosen letter. On each turn, all the previously chosen letters will be sent followed by a newly chosen letter. The user will have to input each of the letters correctly, and in order using the iambic keyer. (This is a design choice so that it's easy to tell whether the user sent a dit or a dah.) The game continus until you send back a letter incorrectly. When that happens, a screen will pop up saying how many letters you got right, and ask if you want to play again. If you hit ok, the game will start over.

# Requirements

## code requirements

All code will be written in JavaScript.

#Features 

## letter chooser

We need a list of letters and numbers, and the Morse code it corresponds to, and something to randomly choose from that list, then play it. 

Then we need to have something that will keep track of the letters that have already been played, and play them before the next letter.

## Morese code game sequence

The game will send the letter stream from the letter chooser to the user in Morse code at the speed specified by [UNIT_MS]([url](https://github.com/hcarter333/toucs-beads-cw-game/blob/6127e1f3c641ac8d470fe94f630e8085e5d87870/cw_snippets.js#L3)) the configuration settings specify. Use the [sendMorseMessage]([url](https://github.com/hcarter333/toucs-beads-cw-game/blob/6127e1f3c641ac8d470fe94f630e8085e5d87870/cw_snippets.js#L52C16-L52C32)) to implement this. You'll find the Morse code table and the sleep [function]([url](https://github.com/hcarter333/toucs-beads-cw-game/blob/6127e1f3c641ac8d470fe94f630e8085e5d87870/cw_snippets.js#L47)) in the same file. Copy the code to another file if you want to, but do use it.

## user input interface 

Use the existing iambic [keyer]([url](https://github.com/hcarter333/toucs-beads-cw-game/blob/6127e1f3c641ac8d470fe94f630e8085e5d87870/pt-cwsimon.js#L455)) to watch what the player is sending back, and match the dits and dahs with what was played. Dahs come in with sideId == 3 correpsonding to "-". Dits come in with sideId == 1 corresponding to "." in the MORSE_TABLE notation.  The iambic keyer code already identifies dit and dah buttons, (area 1 and 3 on the screen respectively). The easy way to do this is to assemble the input dits and dahs and compare against the dits and dahs for the stream of letters that is sent on each turn.

## UX see the character as you hear the character
To reinforce learning,  the letter being output by the game in morse code will be displayed on a very large font that will fade after .5 seconds.

## UX game play: losing
When the player enters a letter incorrectly they lose the game. We then need a screen saying “do you want to play again” and a button saying "ok" to pop up. 

## user configuration interface
### config pane specification
Configuration settings are contained in a panel that is displayed when the user presses a settings button denoted by a gear wheel icon. The user should have an x button on the panel to make it disappear so they can return to the game.

### Words per minute specification
This is where the user will be able to set the words per minute. Remember, this is done simply by adjusting UNIT_MS.

Letter speed (controlled by UNIT_MS) and word speed (the space between characters set by default to 7*UNIT_MS) should be individually configurable. Look up the change in UNIT_MS to change  one word per minute (WPM) the ui should work in units of WPM. 
 
### Losing raspberry sound mute
This will also be where they can turn on and off the losing sound
 
### game defaults 
The words per minute should be set at 8 words per minute (WPM)

## scorekeeper
 
We also need something to keep track of how many rounds (turns) they got through before they messed up, then display that. Be sure to include the rounds completed count on the game's 'do you want to play again screen.' Remember, this is related to the description above: "The game continus until you send back a letter incorrectly. When that happens, a screen will pop up saying how many letters you got right, and ask if you want to play again. If you hit ok, the game will start over."
 
## development guidelines

The pieces of the game will be developed in parallel

1. play incrementally increasing sequence of letter every time the user clicks a button from step one  
2. implement user interface morse code letter input using the existing iambic keyer interface. Don't change the iambic keyer input.  
3. Add user input checking code in startIambic. It will look at what buttons are being pressed, and match that up with what was sent, (a dit '.' or a dah '-'.) 
4. Write code that can be tested without a browser so that it can be tested by Jasmine as a smoke suite.
5. Each feature implemented has to have test cases. Document the test cases tests.md.
6. When a new feature is implemented, existing test cases must pass before the feature is pushed the repo.
7. The html file will only use <script> tags to pull in .js code. There will be no Node.js, npm build process
8. Do not change the layout of the UI that is already present. It works successfully as an iambic keyer on a phone screen already.
9. Where it makes sense, write test cases for the UI layer in playwright. Document them and add them to the smoke suite that must be passed before pushing code.
10. All test cases must be documented and pushed to the repo with their corresponding code that htey test. 
 



