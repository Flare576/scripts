# Shell-executable Javascript

## What? WHY?

Shell scripts are great, but I spend a lot of time looking up syntax. I'd love to be able to get things done in
JavaScript, but I also like just typing in a single command (and any params).

I'm not the first to want this. My ideas were inspired by this post 
https://unix.stackexchange.com/questions/65235/universal-node-js-shebang

## Dependencies
On thing that the NodeJS ecosystem depends on is external modules, but if you don't have these modules already, you
need to get them. The approach in this repo solves this automatically without the author needing to be aware of what
exists and what does not.

## How it works

```
#!/bin/sh
```

Fun enough, bash is actually the thing that starts executing this script.

```
':' //;NODE_PATH=$(npm -g root) exec node -r ./sideLoad.js "$0" "$@"
```

':' is a [bash no-op](https://stackoverflow.com/questions/12404661/what-is-the-use-case-of-noop-in-bash) and is used
here to make bash ignore the next piece of input. Node basically does the same; a string by itself on a line is valid,
albeit useless. The `//` starts a Javascript comment, and so the semi colon is ignored there. Bash treats the `//`
as the input to the no-op, then sees the semi-colon as the command terminator. The next bit is sets NODE_PATH so Node
can see our global modules, then `exec` lets us use the current sub-shell and then call node with arguments. The
`-r ./sideLoad.js` is the key here. Let's look at what that file does.

Firstly, it imports `module`, yes **that** module, and overrides `require`, yes **that** require. It attempts to run the
normal process, and if it works, everything goes as if `sideLoad.js` isn't even there.

If something isn't found, we jump to action and run an `npm -g install` of the package. Then, we add a flag we can
detect to the command arguments and spin off a child NodeJS project. Why? Node was running before the module existed,
and there's no way to tell Node to re-load it's inventory. 

That child process attempts to do the same thing, and if **IT** finds a missing dependency, it also installs it.
However, instead of spinning up another subprocess, it detects that it's a child and terminates itself with a status
code that the parent detects. The parent, in turn, spins up a new child process and continues to do so until a child
runs without a missing dependency.

## Legacy Scripts


### Shell-driven dependency installation

### Why it's bad

`npm -g list` is SLOOOOWWWW, and there's a big chunk of shell script at the top of your JavaScript

### How it works

I've "minifed" the script in `./template.js` a bit, so here it is expanded and explained.

```
#!/bin/sh
```

Fun enough, bash is actually the thing that starts executing this script.

```
':' /*; 
```

':' is a [bash no-op](https://stackoverflow.com/questions/12404661/what-is-the-use-case-of-noop-in-bash) and is used
 here to make bash ignore the next piece of input. Node basically does the same; a string by itself on a line is valid,
 albeit useless. The `/*` starts a Javascript comment, and so the semi colon is ignored, and bash treats the `/*` as the
input to the no-op, then sees the semi-colon as the command terminator.

```
# Put any node dependencies here
dependencies=(
  inquirer
  yargs
)
```

To avoid cluttering your scripts folder, these will be installed globally and then included via NODE_PATH for this 
sub-shell. If you're not going to use [inquirer](https://www.npmjs.com/package/inquirer) or
 [yargs](https://www.npmjs.com/package/yargs), feel free to remove them, but they're pretty awesome.

```
current=$(npm -g --depth 0 list 2> /dev/null | cut -d ' ' -f2)
```

Get a list of installed packages, trimmed to just top-level and package names

```
for dep in ${dependencies[@]}; do 
  if ! [[ $current =~ "$dep@" ]]; then
      echo "Installing $dep"; npm install -g $dep
  fi 
done
```

For each dependency, check to see if it's listed, and if not, install it

```
':' */
```

Our old friend no-op and the closing comment for Node

```
':' //;NODE_PATH=$(npm -g root) exec node "$0" "$@"
```

No-op, followed by comment so Node doesn't see the command. Command sets NODE_PATH so Node can see our global modules,
Exec lets us use the current sub-shell and then call node with arguments

