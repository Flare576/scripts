def f_folder (content): return f'[32;47m{content}[0m'

def f_path (content): return f'[33;47m{content}[0m'

def f_argument (content): return f'[34;47m{content}[0m'

def f_command (content): return f'[35;47m{content}[0m'

def get_local_path (local_path, root, container, remote = ''):
    return local_path or f'{root}/{container}_volumes{remote}'
