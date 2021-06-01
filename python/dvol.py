#!/usr/local/bin/python3
# TODO: when `get` is called, always show override, but mark as disabled if container isn't curently using it
# TODO: when config set with -p but no other params, clear it?
# TODO: when removing, should loop through existing mappings, delete those folders, then nuke the root/project folder
# TODO: after removing files, recursivly delete empty folders upward

import argparse

from dvol_helpers.dvol_add import determine_add
from dvol_helpers.dvol_remove import determine_remove
from dvol_helpers.dvol_print import determine_print
from dvol_helpers.common import *
from dvol_helpers.compose_tools import enable_dvol, disable_dvol, manage_config

######## Messages
all_help = 'Remove all volume mappings. Combine with -f for the nuke.'
container_help = f"Container name; use with {f_command('config')} to save default, or with {f_command('add')}/{f_command('remove')} to override"
execute_help = f"Replace {f_command('docker [compose] up -d')}; use with {f_command('config')} to save default, or with {f_command('add')}/{f_command('remove')} to override"
files_help = 'Also remove local folder'
force_help = 'Force re-copying remote folder contents, destroying the specified folder and any contents'
no_git_help = "Disable default volume-specific change tracking"
profile_help = "Name of profile from config to use."
path_help = 'Override {root}{container}{remote} path logic and use provided folder'
remote_add_help = 'Remote folder to add/map'
remote_remove_help = 'Remote folder mapping to remove'
root_help = f"Local root folder (/tmp); use with {f_command('config')} to save default, or with {f_command('add')}/{f_command('remove')} to override"
solution_help = 'If remote volume is mapped to a different folder, should dvol [u]se, [d]elete or [i]gnore it'

cmd_remove_desc = f'Remove volume map, leaving files unless {f_argument("--files")} given.'
cmd_main_desc = "Manage docker and docker compose volume mappings easily!"
cmd_add_help = "Add a new volume mapping, or update an existing one."
cmd_get_volumes_desc = "Get list of volumes and their sources"
cmd_add_desc = cmd_add_help + f"""

Docker Compose: dvol will only alter its own compose file. If a mapping is
found in another config for {f_argument('remote')}, dvol will abort.

Docker: dvol will create a new image based on the current state of the
container before re-running the machine with the new mapping.

For new or {f_argument('--force')} remote folders, dvol will copy the contents
to the default path:
    {{root}}/{{container}}_volumes/{{remote}}
or --path if provided, then initialize a new local git repository to make
tracking changes easier.
"""
cmd_config_help = f"""Set default/profile {f_argument("container")}, {f_argument("executed")}, and {f_argument("root")}.
Always prints resulting config."""
cmd_config_desc = cmd_config_help + """
Pass in empty string to clear values"""

main = argparse.ArgumentParser(prog = 'dvol', description = cmd_main_desc)
main.add_argument( "--container", "-c", help = container_help)
main.add_argument( "--root", "-r", help = root_help)
main.add_argument( "--execute", "-e", help = execute_help)
main.add_argument( "--no-git", help = no_git_help, action = 'store_true')
main.add_argument( "--profile", "-p", help = profile_help, default = 'default')
subs = main.add_subparsers(title = 'subcommands')

add_p = subs.add_parser('add', help = cmd_add_help, description = cmd_add_desc, formatter_class=argparse.RawDescriptionHelpFormatter, aliases = ['a'])
add_p.set_defaults(func = determine_add)
add_p.add_argument('--force', '-f', help = force_help, action = 'store_true')
add_p.add_argument('--path', '-p', help = path_help, dest = 'local_path')
add_p.add_argument('--solution', '-s', help = solution_help, choices = ['use', 'delete', 'ignore', 'u', 'd', 'i'])
add_p.add_argument('remote', help = remote_add_help, nargs=1)

remove_p = subs.add_parser('remove', help = cmd_remove_desc, aliases = ['rm'])
remove_p.set_defaults(func = determine_remove)
remove_p.add_argument('-f', '--files', help = files_help, dest = 'remove_files', action = 'store_true')
remove_p.add_argument('-p', '--path', help = path_help, dest = 'local_path')
all_or_something = remove_p.add_mutually_exclusive_group(required = True)
all_or_something.add_argument('-a', '--all', help = all_help, action = 'store_true', dest = 'all_mappings')
all_or_something.add_argument('remote', help = remote_remove_help, default = '',  nargs = '?')

get_volumes_p = subs.add_parser('get', help = cmd_get_volumes_desc)
get_volumes_p.set_defaults(func = determine_print)

enable_dvol_p = subs.add_parser('enable', help = 'adds dvol override without adding new mappings')
enable_dvol_p.set_defaults(func = enable_dvol)

disable_dvol_p = subs.add_parser('disable', help = 'removes dvol mapping')
disable_dvol_p.set_defaults(func = disable_dvol)

config_p = subs.add_parser('config', help = cmd_config_help, description = cmd_config_desc, aliases = ['config'])
config_p.set_defaults(func = manage_config)

if __name__ == '__main__':
    try:
        args = main.parse_args()
        args.func(**vars(args))
    except Exception as uh_oh:
        # print("Error: ", uh_oh)
        main.parse_args(['--help'])
