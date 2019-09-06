# Flare576's Scripts

It's important to know how your tools work, but sometimes (afterward), you just want to get things done _quickly_.
That's where scripts come in! Here is a brief description of what you can expect from each of the scripts; full
descriptions and usage details can be found in the `-h` help of each!

## clearKube (/js)

Sometimes when working with Docker and Kubernetes, you end up with pods that just don't die. ClearKube kills them. ded.

## clientClone (/shell)

Some of my clients require that I have a separate gitHub account for their repositories. To make it easier to switch
from one account to the other, I setup multiple certificates tied to different ssh domains. (for more on this,
check out my [DotFiles](https://github.com/Flare576/dotfiles) project). This script allows me to easily check out
projects using the different certs.

## gac (/js)
Git Add/Commit (gac) is a command I started with as a small alias and evolved into what it is now, a slick script that
simplifies my git interactions. My most common usages are `gac -a`, `gac -f my.js src/firstSet.js tests/ofChanges` and,
just plain `gac`.

## gmb (/shell)
Git Master Branch (gmb) is a really simple script that basically amounts to a forceful `git checkout $branch;git pull`,
for when I just want to start over :)

## killZoom.sh (/shell)
There was a time when Zoom Meeting was installing a webserver on users' machines without them knowing; this script
killed it and made Zoom think it was still there. Probably not super useful anymore, but I did post the link around,
so #dontBreakLinks I guess.

## sideLoad.js (/js)
Utility script for making the other JS scripts work as shell commands! See details in the `js/README.md`!

## template.js (/js)
Exactly what the name implies; starting-point for new JS scripts.

## test.js (/js)
If things are going weird for your JS scripts, this script SHOULD just echo your inputs after setting up some common
dependencies. If it doesn't.... well, maybe let me know?

## vroom (/shell)
This is simultaneous my favorite script and also the least portable. `vroom` by itself will try to start a nodeJS
project by searching for a few common "start on my machine" commands, and pipe the output to `server.js` so you can
look through it later. I've tried to make it more versatile by adding a project-specific config file (`.vroom`).
