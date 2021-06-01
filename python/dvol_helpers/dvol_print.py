from dvol_helpers.common import *
from dvol_helpers.compose_tools import *
from dvol_helpers.docker_tools import *

def determine_print (*, container, **kwargs):
    container, *rest = get_updated_profile(**kwargs)
    _, configs, project, service = get_compose_tags(container)
    if configs:
        print_compose (container, configs, project, service, **kwargs)
    else:
        print_docker (container)

def print_docker (container):
    for volume in get_mounts_as_volumes(container):
        print(f'  - {volume}')

def print_compose (container, configs, project, service, **kwargs):
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

