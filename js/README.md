# Shell-executable Javascript

## What? WHY?

Shell scripts are great, but I spend a lot of time looking up syntax. I'd love to be able to get things done in
JavaScript, but I also like just typing in a single command (and any params).

I'm not the first to want this. My ideas were inspired by this post 
https://unix.stackexchange.com/questions/65235/universal-node-js-shebang

## Dependencies
One thing that the NodeJS ecosystem depends on is external modules, but if you don't have these modules already, you
need to get them. The approach in this repo solves this automatically without the author needing to be aware of what
exists and what does not.

## How it works

So, to make this work, we need to ensure three things:

1. The script is valid JavaScript from start to finish
1. The script is an executable shell script
1. The dependencies of your NodeJS script must be available.

To make #3 viable, this project overrides NodeJS's `require` function via a preload script (more on that in a bit).
Let's look at `test.js`, which has the 2 lines you need to include in all of your JS-shell scripts.

```
#!/bin/sh
```

Bash (or whatever your shell is) is actually the thing that starts executing this script, which is why #2 above is true.

```
':' //;NODE_PATH=$(npm -g root) exec node -r ./sideLoad.js "$0" "$@"
```

The goal of this line is to have your shell start NodeJS and to run the file itself, however to make it valid
JavaScript, the SECOND goal is to make the line invisible to NodeJS.

':' is a [bash no-op](https://stackoverflow.com/questions/12404661/what-is-the-use-case-of-noop-in-bash) and is used
here to make bash ignore the next piece of input. Node basically does the same; a string by itself on a line is valid,
albeit useless.

The `//` starts a JavaScript comment, and so the rest of the line is ignored.

Bash treats the `//` as the input to the no-op, then sees the semi-colon as the command terminator.

The rest of the line sets up and executes the `node` command, first setting the environment variable `NODE_PATH` to the
value of the output of `npm -g root`. This ensures we get the expected version of node.

`exec node` uses the `exec` command to replace the current process with `node`.

`-r ./sideLoad.js` uses the `require` option of `node` to allow us to ensure #3 above. (**How** is coming up real soon,
I promise!)

`$0` refers to the script itself, telling node the file you want to run is the same one your Shell is executing now.
`$@` will then output any arguments you passed on the command line for NodeJS to pass to your script.

### sideLoad.js isn't dark magic, is it?

Nope, it just exploits a key feature of JavaScript - overriding - to get over a hurdle of NodeJS - static module
listing.

Firstly, it imports `module`, yes **that** module, and overrides `require`, yes **that** require. It attempts to run the
normal process, and if it works, everything goes as if `sideLoad.js` isn't even there.

If a module isn't found, we jump into action and run an `npm -g install` of the package. Then, we add a flag we can
detect to the command arguments and spin off a child NodeJS process. Why? Node was running before the module existed,
and there's no way to tell Node to re-load it's inventory. 

That child process attempts to do the same thing, and if **IT** finds a missing dependency, it also installs it.
However, instead of spinning up another subprocess, it detects that it's a child (remember the flag we added?) and
terminates itself with a status code that the parent detects. The parent, in turn, spins up a new child process. This
continues until a child runs without a missing dependency.

## How to use
You run these like any other scripts, so either of these (or others!) will work:

```
sh /hwerever/you/clone/scripts/js/test.js
/wherever/you/cloned/scripts/js/test.js
```

Will work, or if you start using them a lot, add 

```
export PATH="/wherever/you/cloned/scripts/js:${PATH}
```

to your .zshrc, .zshenv, .bashrc, .profile, ........ you get it.
