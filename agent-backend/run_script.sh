#!/bin/bash
# Wrapper script to run Python scripts with the virtual environment

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Activate the virtual environment
source "$DIR/venv/bin/activate"

# Run the Python script with all arguments passed to this script
python "$DIR/$1" "${@:2}"

# Deactivate the virtual environment
deactivate
