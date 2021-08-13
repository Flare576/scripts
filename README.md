# Flare576's Scripts

> Note:  
> Many of the scripts that used to live here have been split into their own repos, served
> with [homebrew](https://brew.sh/) via [my tap](https://github.com/flare576/homebrew-scripts).

It's important to know how your tools work, but sometimes (afterward), you just want to get things done _quickly_.
That's where scripts come in! Here is a brief description of what you can expect from each of the scripts; full
descriptions and usage details can be found in the `-h` help of each!

## clearKube (/js)

Sometimes when working with Docker and Kubernetes, you end up with pods that just don't die. ClearKube kills them. ded.

## gmb (/shell)
G[ei]t Master Branch (gmb) is a really simple script that basically amounts to a forceful `git checkout $branch;git pull`,
for when I just want to start over :)

## mmb (/shell)
Merge Master Branch (mmb) is a really script that basically updates my current branch with changes in "master".

## killZoom.sh (/shell)
There was a time when Zoom Meeting was installing a webserver on users' machines without them knowing; this script
killed it and made Zoom think it was still there. Probably not super useful anymore, but I did post the link around,
so #dontBreakLinks I guess.

