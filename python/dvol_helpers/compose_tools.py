import jq
import json
import os
import sys
import yaml

from configparser import ConfigParser
from dvol_helpers.config import config_folder, config_store
from subprocess import check_output, run
from dvol_helpers.common import *

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

def manage_config (**kwargs):
    get_updated_profile(**kwargs, save = True)
    print(f'{f_path(config_store)}')
    quick_conf = open(config_store).read()
    print(quick_conf)
    quit()

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

def get_local_path (local_path, root, container, remote = ''):
    return local_path or f'{root}/{container}_volumes{remote}'

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

def recreate_compose (working_dir, configs, project, execute, service, *, add = None, remove = None):
    """
    Runs a command intended to tell docker compose to check the services listed in the configs for changes.

    By default, this command is
        docker compose -f /path/to/docker-compose.yml -f /path/to/other/.yml... up -d
    However, if there is a custom command you prefer to run you can override the default with the --execute arg
    """

    override_file, override_data = read_override(project, service)

    if remove:
        # TODO: might need to change this to just check destination
        override_data['services'][service]['volumes'].remove(remove)
        write_override(override_file, override_data)

    if add:
        new = [add]
        if not override_data['services'].get(service):
            override_data['services'][service] = {'volumes': new}
        else:
            new.extend(override_data['services'][service]['volumes'])
            override_data['services'][service]['volumes'] = (list(set(new)))

        write_override(override_file, override_data)

    if not execute:
        run_args = ['docker', 'compose', '--project-name', project, '--project-directory', working_dir]
        for conf in configs:
            run_args.extend(['-f', conf])
        run_args.extend(['up', '-d'])

        print('Refreshing containers')
        run(run_args)
    else:
        print(f'Running {f_command(execute)}')
        os.system(execute)

def enable_dvol (**kwargs):
    container, root, execute, use_git = get_updated_profile(**kwargs)
    working_dir, configs, project, service = get_compose_tags(container)
    if not configs:
        print ("[31mEnable/Disable is meaningless without 'docker compose'[0m")
        quit()
    override_file, override_data = read_override(project, service)
    configs = set(configs)
    configs.add(override_file)
    configs = list(configs)
    recreate_compose(working_dir, configs, project, execute, service)

def disable_dvol (**kwargs):
    container, root, execute, use_git = get_updated_profile(**kwargs)
    working_dir, configs, project, service = get_compose_tags(container)
    if not configs:
        print ("[31mEnable/Disable is meaningless without 'docker compose'[0m")
        quit()
    override_file, override_data = read_override(project, service)
    configs = set(configs)
    configs.remove(override_file)
    configs = list(configs)
    recreate_compose(working_dir, configs, project, execute, service)
