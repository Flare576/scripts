# Flare576's Scripts

It's important to know how your tools work, but sometimes (afterward), you just want to get things
done _quickly_.  That's where scripts come in!

The two scripts still housed directly in this project are git-related:

## gmb (/shell)
G[ei]t Master Branch (gmb) is a really simple script that basically amounts to a forceful `git
checkout $branch;git pull`, for when I just want to start over :)

## mmb (/shell)
Merge Master Branch (mmb) is a really script that basically updates my current branch with changes
in "master".

Full descriptions and usage details can be found in the `-h` help of each!

## Installation

Each of the submodules to this project are stand-alone tools and can be installed on systems using
[homebrew](https://brew.sh/) via my [my tap](https://github.com/flare576/homebrew-scripts).

To use the two git-related scripts in `/bin`, clone this project and add the folder to your $PATH:

```
export PATH="$HOME/scripts/bin:$PATH"
```

For non-homebrew systems, clone the project with `--recurse-submodules` and add `nonbrew` to your
path as well

```
export PATH="$HOME/scripts/nonbrew:$PATH"
```

Bear in mind that `gac`, `newScript`, and the cookie functionality of `jira-cli` require `npm`.
