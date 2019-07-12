# Shell-executable Javascript

I blatantly stole this from https://unix.stackexchange.com/questions/65235/universal-node-js-shebang

In order to keep the script from being top-heavy with comments, I'm explaining what's going on here instead if in
the script itself.

```
#!/bin/sh
```

Fun enough, bash is actually the thing that starts executing this script.

```
':' /*; 
```

':' is a (bash no-op)[https://stackoverflow.com/questions/12404661/what-is-the-use-case-of-noop-in-bash] and is used
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
sub-shell. If you're not going to use (inquirer)[https://www.npmjs.com/package/inquirer] or
 (yargs)[https://www.npmjs.com/package/yargs], feel free to remove them, but they're pretty awesome.

```
current=$(npm -g list 2> /dev/null | grep '^├' | cut -d ' ' -f2)
```

Get a list of installed packages, trimmed to just top-level and package names

```
for dep in ${dependencies[@]}; do 
  if ! [[ $current =~ "$dep@" ]]; then
      echo "Installing $dep"; npm install -g $dep
  fi 
done
```
> (expanded for legibility)

For each dependency, check to see if it's listed, and if not, install it

```
':' */
```

Our old friend no-op and the closing comment for Node

```
':' //;NODE_PATH=$(npm -g root) exec "$(node)" "$0" "$@"
```

No-op, followed by comment so Node doesn't see the command. Command sets NODE_PATH so Node can see our global modules,
Exec lets us use the current sub-shell and then call node with arguemnts

The rest of the code is JavaScript!
