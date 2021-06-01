import jq
import json
import sys

from subprocess import check_output, run, DEVNULL
from dvol_helpers.common import *


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
