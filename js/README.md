# Shell-executable Javascript

Both of these approaches were inspired by this post 
https://unix.stackexchange.com/questions/65235/universal-node-js-shebang

## Approach 1 - Shell-driven dependency installation

### Why it's good

There's no trickery - You list the dependencies you need in the top of the script, the bash script checks for them, and
installs if necessary. It then kicks off node and your script runs smooth.

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

## Approach 2 - Node-driven dependency installation

### Why it's good

If all of the dependencies are already installed, it's nearly as quick as a bash script. It's also only one extra line
over a standard script, and that line is pretty easy to understand.

### Why it's bad

I couldn't find a good way to tell Node to re-index the module structure after installation. The best I could find was
to restart Node entirely, but doing that causes the terminal window to react strangely. It still works, it doesn't
break anything, and after the first run it never happens again, but it's still weird.

### How it works

```
#!/bin/sh
```

Fun enough, bash is actually the thing that starts executing this script.

```
':' //;NODE_PATH=$(npm -g root) exec node -r ./sideLoad.js "$0" "$@"
```

No-op, followed by comment so Node doesn't see the command. Command sets NODE_PATH so Node can see our global modules,
Exec lets us use the current sub-shell and then call node with arguments. The `-r ./sideLoad.js` is the key here. Let's
look at what that file does.

Firstly, it imports `module`, yes *that* module, and overrides `require`, yes *that* require. It attempts to run the
normal process, and if it works, everything goes as if `sideLoad.js` isn't even there.

If something isn't found, we jump to action and run an `npm -g install` of the package. The problem here, however, is
that Node was running before the module existed, and (as far as I can tell), there's no way to tell Node to re-load
it's inventory. So, we hook onto the "exit" event of the process, and kick off a new instance of the script. Then we
kill node.

And your terminal notices it die, and returns the prompt to you... but it doesn't notice the new process using the same
shell until something is output. This is where things get weird; your script runs, and when it finishes, it doesn't
trigger a new prompt to appear.

All of this weirdness only happens the if dependencies are missing, so generally the first time a script is run IF
non-bundled modules are used.

## Which one is better?

I plan to use Approach 2 for now. The speed difference is significant enough that I don't mind a little initial
weirdness.
