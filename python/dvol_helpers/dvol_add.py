import os
import yaml

from git import Repo
from shutil import rmtree
from subprocess import run, DEVNULL

from dvol_helpers.common import *
from dvol_helpers.compose_tools import *
from dvol_helpers.docker_tools import *

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
                    elif not force: # mapping exists, matches what we'd create
                        print(f'Mapping exists, existing')
                        quit()
    sync(
        container = container,
        remote = remote,
        local_path = local_path,
        force = force,
        use_git = use_git,
        recreate_pair = (recreate_compose, (working_dir, configs, project, execute, service))
    )

    # todo: help for create needs to mention backup file, always printing location of main compose
    print(f_path(override_file))

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
        print('Refreshing container to sync files')
        recreate_fn(*recreate_args, remove = remove)

    if not os.path.isdir(local_path):
        os.makedirs(local_path)
        print(f'Copying {f_argument(remote)} from {f_argument(container)} to {f_folder(local_path)}')
        run(["docker", "cp", f'{container}:{remote}/.', local_path], stderr=DEVNULL)
        if use_git:
            print(f'Initializing Git repo at {f_folder(local_path)}')
            repo = Repo.init(local_path)
            repo.git.add(A=True)
            repo.index.commit("initial dvol call")
    else:
        print(f'Not Copying {f_argument(remote)} from {f_argument(container)} to {f_folder(local_path)} (exists)')
        print(f'Run with {f_folder("--force")} if desired')

    recreate_fn(*recreate_args, add = f'{local_path}:{remote}')
