import os
from shutil import rmtree

from dvol_helpers.common import *
from dvol_helpers.compose_tools import *
from dvol_helpers.docker_tools import *

def determine_remove (**kwargs):
    container, *rest = get_updated_profile(**kwargs)
    info, *rest = get_compose_tags(container)

    if info:
        remove_compose(**kwargs)
    else:
        remove_docker(**kwargs)

def remove_docker (**kwargs):
    container, root, execute, *rest = get_updated_profile(**kwargs)
    volumes = get_mounts_as_volumes(container)
    volumes = remove_process(volumes = volumes, **kwargs)
    recreate_docker(container ,volumes)

def remove_process (*, volumes, remote = '', local_path = '', remove_files = False, all_mappings = None, **kwargs):
    container, root, *rest = get_updated_profile(**kwargs)
    remote = '' if all_mappings else '/' + remote if not len(remote) or remote[0] != '/' else remote
    local_path = get_local_path(local_path, root, container, remote or '')
    if all_mappings:
        volumes = []
        target = local_path
    else:
        volume = next(volume for volume in volumes if volume.endswith(f':{remote}'))
        target = volume.split(':')[0]
        volumes.remove(volume)

    if remove_files:
        if not len(volumes):
            container_root = get_local_path(None, root, container)
            print(f'Last volume removed - Deleting {f_folder(container_root)}')
            rmtree(container_root)
        else:
            print(f'Deleting {f_folder(target)}')
            rmtree(target)
    else:
        print(f'Leaving {f_folder(target)} in-place: use --files to delete.')

    return volumes

def remove_compose (**kwargs):
    container, root, execute, *rest = get_updated_profile(**kwargs)
    working_dir, configs, project, service = get_compose_tags(container)
    override_file, override_data = read_override(project, service)
    if not override_data['services'].get(service):
        print(f'No mappings found for {f_argument(service)}')
        quit()
    volumes = override_data['services'][service]['volumes']

    volumes = remove_process(volumes = volumes, **kwargs)

    if not len(volumes):
        override_file in configs and configs.remove(override_file)
        del override_data['services'][service]

    if not len(override_data['services']):
        os.remove(override_file)
    else:
        write_override(override_file, override_data)

    recreate_compose(working_dir, configs, project, execute, service)
