#!/usr/local/bin/python3
# TODO: when `get` is called, always show override, but mark as disabled if container isn't curently using it
# TODO: when config set with -p but no other params, clear it?
# TODO: when removing, should loop through existing mappings, delete those folders, then nuke the root/project folder
# TODO: after removing files, recursivly delete empty folders upward

import argparse
import jq
import json
import os
import sys
import yaml

from configparser import ConfigParser
from git import Repo
from shutil import rmtree, copy
from subprocess import check_output, run, DEVNULL

config_folder = f'{os.environ.get("HOME")}/.config/dvol'
config_store = f'{config_folder}/config.ini'

def f_folder (content): return f'[32;47m{content}[0m'

def f_path (content): return f'[33;47m{content}[0m'

def f_argument (content): return f'[34;47m{content}[0m'

def f_command (content): return f'[35;47m{content}[0m'

def read_override (project, service):
    override_file = f'{config_folder}/{project}.yml'
    if os.path.isfile(override_file):
        with open(override_file, 'r') as file:
            override_data = file.read()
        override_data = yaml.safe_load(override_data)
    else:
        override_data = { 'services': {service: { 'volumes': []}}}
    return (override_file, override_data)

def write_override (override_file, override_data):
    ensure_config_folder()
    print(f'Updating {f_path(override_file)}')
    with open(override_file, 'w') as file:
        file.write(yaml.dump(override_data))

def ensure_config_folder():
    if not os.path.isdir(config_folder):
        print(f'Creating {f_folder(config_folder)}')
        os.makedirs(config_folder)

def get_updated_profile (
    profile = 'default',
    container = None,
    root = None,
    execute = None,
    no_git = False,
    save = False,
    **kwargs
):
    config = ConfigParser()
    config.read(config_store)
    c_profile = config[profile] if config.has_section(profile) else {'root': '/tmp'}
    e_prime = c_profile.get('execute', None)
    """
    If user is setting some things, but not execute AND there's an existing execute, they may have forgotten
    there's one set. Confirm they want to keep it
    """
    if ((container == None and root == None) and (execute != None and not e_prime)):
        print(f"There is a default --execute command saved:\n{f_command(e_prime)}")
        if not input("Do you want to keep it? (y/n): ").lower().strip()[:1] == "y":
            execute = ''

    no_new = container == None and root == None and execute == None
    if no_new and not os.path.isfile(config_store):
        print(f'{f_path(config_store)} not found')
        quit()

    container = container   if  container != None else c_profile.get('container',  '')
    root      = root        if  root      != None else c_profile.get('root',       '')
    execute   = execute     if  execute   != None else c_profile.get('execute',    '')
    # Questionable choice: store setting as 'use_git', defaults to 'True', optional flag is 'no-git'
    use_git   = False       if no_git             else c_profile.get('use_git',    'True') == 'True'

    if save:
        c_profile['container'] = container
        c_profile['root']      = root
        c_profile['execute']   = execute
        c_profile['use_git']   = str(use_git)
        config[profile] = c_profile
        ensure_config_folder()
        with open(config_store, 'w') as configfile:
            config.write(configfile)

    return container, root, execute, use_git

def manage_config (**kwargs):
    get_updated_profile(**kwargs, save = True)

    print(f'{f_path(config_store)}')
    quick_conf = open(config_store).read()
    print(quick_conf)
    quit()

def get_compose_tags (container = None):
    # Validation
    running = check_output(['docker', 'ps']).decode(sys.stdout.encoding)
    if container not in running:
        print(f"It doesn't look like {f_argument(container)} is running... exiting")
        quit()
    inspect = check_output(['docker', 'container', 'inspect', container]).decode(sys.stdout.encoding)
    inspect = json.loads(inspect)
    labels = jq.compile('.[0].Config.Labels').input(inspect).first()
    if not labels:
        return (None, None, None, None)
    service = jq.compile(f'."com.docker.compose.service"').input(labels).first()

    project_base = '"com.docker.compose.project'
    working_dir = jq.compile(f'.{project_base}.working_dir\"').input(labels).first()
    configs = jq.compile(f'.{project_base}.config_files" | split(",")').input(labels).first()
    project = jq.compile(f'.{project_base}"').input(labels).first()
    # Convert all configs to absolute reference
    for idx, config in enumerate(configs):
        if config[0] == '/': continue
        configs[idx] = f'{working_dir}/{config.split("/")[-1]}'
    return (working_dir, configs, project, service)

def get_local_path (local_path, root, container, remote = ''):
    return local_path or f'{root}/{container}_volumes{remote}'

def get_config_volume_map (service, configs = []):
    volume_map = {}
    for config in configs: #uses configs, service, &recreate:execute, working_dir, project
        if not os.path.isfile(config):
            continue
        with open(config, 'r') as file:
            full = yaml.safe_load(file.read())
            volumes = full['services'].get(service, {}).get('volumes', [])
            volume_map[config] = volumes
    return volume_map

def determine_add (remote, local_path = '', **kwargs):
    # todo: make parsearges not send this as a list
    remote = remote[0]
    if not remote:
        print("Can't add what you don't ask for")
        quit()
    if not len(remote) or remote[0] != '/': remote = '/' + remote
    container, root, *rest = get_updated_profile(**kwargs)
    local_path = get_local_path(local_path, root, container, remote)


    info, *rest = get_compose_tags(container)
    if info:
        add_compose(remote, **kwargs, local_path = local_path)
    else:
        add_docker(remote, **kwargs, local_path = local_path)

def get_mounts_as_volumes (container):
    try:
        inspect = check_output(['docker', 'container', 'inspect', container]).decode(sys.stdout.encoding)
        inspect = json.loads(inspect)
        mounts = jq.compile('.[0].Mounts').input(inspect).first()
        return list(set(map(
            lambda m: f"{m['Source']}:{m['Destination']}",
            mounts,
        )))
    except:
        print(f"It doesn't look like {f_argument(container)} is running... exiting")
        quit()

def recreate_docker (container, volumes, remove = None, add = None):
    current = []
    import ipdb
    ipdb.set_trace()
    if remove:
        for volume in volumes:
            if remove not in volume:
                current.append(volume)
    else:
        currrent = volumes or []

    if add:
        current.append(add)
        current = (list(set(current)))

    dvol_image = f'dvol-{container}'
    run(['docker', 'commit', '-a', 'dvol', '-m', 'Temp for dvol', container, dvol_image], stdout=DEVNULL)
    run(['docker', 'rm', '-f', container], stdout=DEVNULL)
    vols = []
    for volume in current:
        vols.extend(['-v', volume])
    run(['docker', 'run', *vols, '--name', container, '-td', dvol_image], stdout=DEVNULL)

def sync (*, container, remote, local_path, force, use_git, recreate_pair):
    (recreate_fn, recreate_args) = recreate_pair
    if force and os.path.isdir(local_path):
        print(f'Deleting {f_folder(local_path)}')
        rmtree(local_path)

    remove = None
    volumes = get_mounts_as_volumes(container)
    for volume in volumes:
        if remote in volume:
            remove = volume
            break

    if remove:
        print('Refreshing container to synch files')
        recreate_fn(*recreate_args, remove = remove)

    if not os.path.isdir(local_path):
        os.makedirs(local_path)
        print(f'Copying {f_argument(remote)} from {f_argument(container)} to {f_folder(local_path)}')
        run(["docker", "cp", f'{container}:{remote}/.', local_path], stdout=DEVNULL)
        if use_git:
            print(f'Initializing Git repo at {f_folder(local_path)}')
            repo = Repo.init(local_path)
            repo.git.add(A=True)
            repo.index.commit("initial dvol call")
    else:
        print(f'Not Copying {f_argument(remote)} from {f_argument(container)} to {f_folder(local_path)} (exists)')
        print(f'Run with {f_folder("--force")} if desired')

    recreate_fn(*recreate_args, add = f'{local_path}:{remote}')

def add_docker (remote, force = False, solution = None, local_path = '', **kwargs):
    container, root, execute, use_git = get_updated_profile(**kwargs)
    volumes = get_mounts_as_volumes(container)
    sync(
        container = container,
        remote = remote,
        local_path = local_path,
        force = force,
        use_git = use_git,
        recreate_pair = (recreate_docker, (container, volumes)),
    )

def add_compose (remote, force = False, solution = None, local_path = '', **kwargs):
    container, root, execute, use_git = get_updated_profile(**kwargs)
    working_dir, configs, project, service = get_compose_tags(container)

    override_file, override_data = read_override(project, service)
    configs = set(configs)
    configs.add(override_file)
    configs = list(configs)

    volume = None
    for config in configs:
        if not os.path.isfile(config):
            continue
        with open(config, 'r') as file:
            full = yaml.safe_load(file.read())
            volumes = full['services'].get(service, {}).get('volumes', [])
            for e_volume in volumes: # uses remote(p), config, solution?, volume, [service,override, force]
                segments = e_volume.split(':')
                if len(segments) != 2:
                    print("Volume does not have 2 ':' characters. I r confused")
                    quit()
                existing_local, existing_remote = segments
                if existing_remote == remote:
                    if volume:
                        print('It appears that there are two mappings to this location already... freaking out')
                        quit()
                    if config != override_file:
                        print(f'[97;41mMapping to [96m{remote}[97m found in [96m{config}[97m. Aborting[0m')
                        quit()

                    volume = e_volume
                    if existing_local != local_path:
                        print(f'Remote location {f_path(remote)} is already mapped to {f_folder(existing_local)}.')
                        print(f'dvol intended to map it to {f_folder(local_path)}, ', end='')
                        if solution == None:
                            print(f'what would you like to do?')
                            solution = input('[u]se existing\n[d]elete existing\n[i]gnore existing\n[a]bort\n:')
                        else:
                            print('using --solution to resolve.')
                        sol = solution[0].lower()
                        if sol == 'd':
                            print(f'Deleting {f_folder(existing_local)}')
                            rmtree(existing_local)
                        elif sol == 'u':
                            local_path = existing_local
                        elif sol == 'i':
                            print(f'Ignoring {f_folder(existing_local)}')
                        else:
                            quit()

    sync(
        container = container,
        remote = remote,
        local_path = local_path,
        force = force,
        recreate_pair = (recreate, (working_dir, configs, project, execute, service))
    )

    volume = volume or f'{local_path}:{remote}'
    override_data['services'][service] = override_data['services'].get(service, { 'volumes': [] })
    override_data['services'][service]['volumes'].append(volume)

    write_override(override_file, override_data)
    recreate(working_dir, configs, project, execute)

    # todo: help for create needs to mention backup file, always printing location of main compose
    print(f_path(override_file))

def remove (remote = '', remove_files = False, all_mappings = None, local_path = '', **kwargs):
    if not len(remote) or remote[0] != '/': remote = '/' + remote
    container, root, execute, *rest = get_updated_profile(**kwargs)
    working_dir, configs, project, service = get_compose_tags(container)
    override_file, override_data = read_override(project, service)
    volumes = override_data['services'][service]['volumes']
    local_path = get_local_path(local_path, root, container, remote or '')

    if all_mappings:
        volumes = []
        target = local_path
    else:
        # should throw StopIteration if not found
        volume = next(volume for volume in volumes if volume.endswith(f':{remote}'))
        target = volume.split(':')[0]
        volumes.remove(volume)

    if not len(volumes):
        override_file in configs and configs.remove(override_file)
        del override_data['services'][service]

    if not len(override_data['services']):
        os.remove(override_file)
    else:
        write_override(override_file, override_data)

    if remove_files:
        print(f'Deleting {target}')
        rmtree(target)
    else:
        print(f'Leaving {target} in-place: use --files to delete.')

    recreate(working_dir, configs, project, execute)

def print_volumes (**kwargs):
    container, *rest = get_updated_profile(**kwargs)
    _, configs, project, service = get_compose_tags(container)
    if configs:
        print_volumes_compose (container, configs, project, service, **kwargs)
    else:
        print_volumes_docker (container)

def print_volumes_docker (container):
    for volume in get_mounts_as_volumes(container):
        print(f'  - {volume}')

def print_volumes_compose (container, configs, project, service, **kwargs):
    override_file, override_data = read_override(project, service)
    volumes = get_config_volume_map(service, configs)
    in_use = False
    for file_name in volumes:
        in_use = file_name == override_file or in_use
        print(f_path(file_name))
        vols = volumes[file_name]
        if not len(vols):
            print('  None')
        else:
            for vol in vols:
                print(f'  - {vol}')


    if not in_use and override_data:
        print(f_path(override_file))
        mapped_service = list(override_data['services'])[0]
        container_from_service = f'{project}_{mapped_service}_1'
        _, mapped_configs, _, _ = get_compose_tags(container_from_service)
        if override_file in mapped_configs:
            # we're running with dvol, this container just doesn't have mappings
            print('  None')
            print(f"  Other containers: {f_argument(', '.join(list(override_data['services'])))}")
        else:
            # Not running with any dvol mappings but they exist
            print(f'  [31;106m Disabled [0m')
            print('Existing project mappings:')
            for service in override_data['services']:
                print(f_argument(service))
                for vol in override_data['services'][service]['volumes']:
                    print(f'  - {vol}')

def enable_dvol (**kwargs):
    container, root, execute, use_git = get_updated_profile(**kwargs)
    working_dir, configs, project, service = get_compose_tags(container)
    override_file, override_data = read_override(project, service)
    configs = set(configs)
    configs.add(override_file)
    configs = list(configs)
    recreate(working_dir, configs, project, execute)

def disable_dvol ():
    container, root, execute, use_git = get_updated_profile(**kwargs)
    working_dir, configs, project, service = get_compose_tags(container)
    override_file, override_data = read_override(project, service)
    configs = set(configs)
    configs.remove(override_file)
    configs = list(configs)
    recreate(working_dir, configs, project, execute)

def recreate (working_dir, configs, project, execute, service, *, add = None, remove = None):
    """
    Runs a command intended to tell docker-compose to check the services listed in the configs for changes.

    By default, this command is
        docker-compose -f /path/to/docker-compose.yml -f /path/to/other/.yml... up -d
    However, if there is a custom command you prefer to run you can override the default with the --execute arg
    """

    override_file, override_data = read_override(project, service)
    if add:
        override_data['services'][service]['volumes'].append(add)
        write_override(override_file, override_data)

    if remove:
        # TODO: might need to change this to just check destination
        override_data['services'][service]['volumes'].remove(remove)
        write_override(override_file, override_data)

    if not execute:
        run_args = ['docker-compose', '--project-name', project, '--project-directory', working_dir]
        for conf in configs:
            run_args.extend(['-f', conf])
        run_args.extend(['up', '-d'])

        print('Refreshing containers')
        run(run_args)
    else:
        print(f'Running {f_command(execute)}')
        os.system(execute)

######## Messages
all_help = 'Remove all volume mappings. Combine with -f for the nuke.'
container_help = f"Container name; use with {f_command('config')} to save default, or with {f_command('add')}/{f_command('remove')} to override"
execute_help = f"Replace {f_command('docker-compose up -d')}; use with {f_command('config')} to save default, or with {f_command('add')}/{f_command('remove')} to override"
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
cmd_main_desc = "Manage docker-compose volume mappings easily!"
cmd_add_help = "Add a new volume mapping, or update an existing one."
cmd_get_volumes_desc = "Get list of volumes and their sources"
cmd_add_desc = cmd_add_help + f"""

dvol will only alter its own compose file.
If a mapping is found in another config for {f_argument('remote')}, dvol will abort.
For new or {f_argument('--force')} remote folders, dvol will copy the contents to the default path:
    {{root}}/{{container}}_volumes/{{remote}}
or --path if provided, then initialize a new local git repository to make tracking changes easier.
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

add_p = subs.add_parser('add', help = cmd_add_help, aliases = ['a'])
add_p.set_defaults(func = determine_add)
add_p.add_argument('--force', '-f', help = force_help, action = 'store_true')
add_p.add_argument('--path', '-p', help = path_help, dest = 'local_path')
add_p.add_argument('--solution', '-s', help = solution_help, choices = ['use', 'delete', 'ignore', 'u', 'd', 'i'])
add_p.add_argument('remote', help = remote_add_help, nargs=1)

remove_p = subs.add_parser('remove', help = cmd_remove_desc, aliases = ['rm'])
remove_p.set_defaults(func = remove)
remove_p.add_argument('-f', '--files', help = files_help, dest = 'remove_files', action = 'store_true')
remove_p.add_argument('-p', '--path', help = path_help, dest = 'local_path')
all_or_something = remove_p.add_mutually_exclusive_group(required = True)
all_or_something.add_argument('-a', '--all', help = all_help, action = 'store_true', dest = 'all_mappings')
all_or_something.add_argument('remote', help = remote_remove_help, default = '',  nargs = '?')

get_volumes_p = subs.add_parser('get', help = cmd_get_volumes_desc)
get_volumes_p.set_defaults(func = print_volumes)

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
        print("Error: ", uh_oh)
        main.parse_args(['--help'])
