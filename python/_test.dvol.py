import unittest.mock as um
import os
import importlib
import dvol as dvol

fake_yml = """top_level:
    - a list
    - of things"""

with um.patch('builtins.open', um.mock_open(read_data=fake_yml)):
    um.patch('os.isfile', um.mock
    os.path.isfile = MagicMock(return_value=True)
open = MagicMock(return_value={'read'
MagicMock.
print (dvol.read_override('myproject', 'myservice'))
