# Standard library imports
import ast
import json
import os

# Third party imports
from rever.activity import activity
from rever.tools import replace_in_file


$ACTIVITIES = [
    'checkout',
    'clean_repo',
    'update_repo',
    'install_deps',
    'format_code',
    'run_tests',
    'update_release_version',
    'create_distributions',
    'create_changelog',
    'commit_release_version',
    'authors',
    'add_tag',
    'update_tag',
    'update_dev_version',
    'commit_dev_version',
    'push',
]


$PROJECT = "setup-miniconda"
$MODULE = $PROJECT
$GITHUB_ORG = 'goanpeca'
$GITHUB_REPO = $PROJECT
$VERSION_BUMP_PATTERNS = [
    # These note where/how to find the version numbers
    ('package.json', r'"version":\s.*', '"version": "$VERSION",'),
]
$AUTHORS_FILENAME = "AUTHORS.md"
$AUTHORS_TEMPLATE = """# Authors

The $PROJECT project has some great contributors! They are:

{authors}

These have been sorted {sorting_text}.
"""
$AUTHORS_FORMAT= "- [{name}](https://github.com/{github})\n"
$AUTHORS_SORTBY = "alpha"
$TEMP_ENV = 'tmp-' + $PROJECT
$CONDA_ACTIVATE_SCRIPT = 'activate.xsh'
$HERE = os.path.abspath(os.path.dirname(__file__))


# --- Helpers
# ----------------------------------------------------------------------------
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def cprint(text, color):
    """Print colored text."""
    print(color + text + Colors.ENDC)


def get_version(version_type, module=$MODULE):
    """
    Get version info. Tuple with three items, major.minor.patch
    """
    with open(os.path.join($HERE, "package.json")) as fh:
        data = json.loads(fh.read())

    major, minor, patch = 'MAJOR', 'MINOR', 'PATCH'
    version = data['version']
    major, minor, patch = [int(v) for v in version.split('.')[:3]]

    version_type = version_type.lower()
    if version_type == 'major':
        major += 1
        minor = 0
        patch = 0
    elif version_type == 'minor':
        minor += 1
        patch = 0
    elif version_type == 'patch':
        patch += 1
    elif version_type in ['check', 'setup']:
        pass
    elif len(version_type.split('.')) == 3:
        major, minor, patch = version_type.split('.')
    else:
        raise Exception('Invalid option! Must provide version type: [major|minor|patch|MAJOR.MINOR.PATCH]')

    major = str(major)
    minor = str(minor)
    patch = str(patch)
    version = '.'.join([major, minor, patch])

    if version_type not in ['check', 'setup']:
        cprint('\n\nReleasing version {}'.format(version), Colors.OKBLUE)
        print('\n\n')

    return version


# Actual versions to use
$NEW_VERSION = get_version($VERSION)
$DEV_VERSION = $NEW_VERSION + '-dev'


def activate(env_name):
    """
    Activate a conda environment.
    """
    if not os.path.isfile($CONDA_ACTIVATE_SCRIPT):
        with open('activate.xsh', 'w') as fh:
            fh.write($(conda shell.xonsh hook))

    # Activate environment
    source activate.xsh
    conda activate @(env_name)
    $[conda info]


def update_version(version):
    """
    Update version patterns.
    """
    for fpath, pattern, new_pattern in $VERSION_BUMP_PATTERNS:
        new_pattern = new_pattern.replace('$VERSION', version)
        replace_in_file(pattern, new_pattern, fpath)


# --- Activities
# ----------------------------------------------------------------------------
@activity
def checkout(branch='1.x'):
    """
    Checkout master branch.
    """
    git stash
    git checkout @(branch)


@activity
def clean_repo():
    """
    Clean the repo from build/dist and other files.
    """
    import pathlib

    # Remove python files
    for p in pathlib.Path('.').rglob('*.orig'):
        p.unlink()

    rm -rf CHANGELOG.temp
    rm -rf activate.xsh

    # Delete files not tracked by git?
    # git clean -xfd


@activity
def update_repo(branch='1.x'):
    """
    Stash any current changes and ensure you have the latest version from origin.
    """
    git stash
    git pull origin @(branch)


@activity
def install_deps():
    """
    Install release and test dependencies.
    """
    try:
        conda remove --name $TEMP_ENV --yes --quiet --all
    except:
        pass

    conda create --name $TEMP_ENV nodejs=12 loghub -c conda-forge --yes --quiet
    activate($TEMP_ENV)
    npm install
    npm i -g @zeit/ncc


@activity
def update_release_version():
    """
    Update version in `package.json`
    """
    update_version($NEW_VERSION)


@activity
def create_distributions():
    """
    Create distributions.
    """
    activate($TEMP_ENV)
    npm run build
    npm run format
    npm run pack


@activity
def create_changelog():
    """
    Create changelog using loghub.
    """
    loghub $GITHUB_ORG/$GITHUB_REPO -m @('v' + $NEW_VERSION)

    with open('CHANGELOG.temp', 'r') as fh:
        new_changelog_lines = fh.read().split('\n')

    with open('CHANGELOG.md', 'r') as fh:
        lines = fh.read().split('\n')

    new_lines = lines[:2] + new_changelog_lines + lines[2:]

    with open('CHANGELOG.md', 'w') as fh:
        fh.write('\n'.join(new_lines))


@activity
def commit_release_version():
    """
    Commit release version.
    """
    git add .
    git commit -m @('Set release version to ' + $NEW_VERSION + ' [ci skip]')


@activity
def add_tag():
    """
    Add release tag.
    """
    # TODO: Add check to see if tag already exists?
    git tag -a @('v' + $NEW_VERSION) -m @('Tag version ' + $NEW_VERSION + ' [ci skip]')


@activity
def update_tag():
    """
    Update major release tag.
    """
    # TODO: Add check to see if tag already exists?
    # git tag -a @('v' + $NEW_VERSION) -m @('Tag version ' + $NEW_VERSION + ' [ci skip]')


@activity
def update_dev_version():
    """
    Update `__init__.py` (add 'dev0').
    """
    update_version($DEV_VERSION)


@activity
def commit_dev_version():
    """"
    Commit dev changes.
    """
    git add .
    git commit -m "Restore dev version [ci skip]" --no-verify


@activity
def push(branch='1.x'):
    """
    Push changes.
    """
    # Push changes
    git push origin @(branch)

    # Push tags
    git push origin --tags
