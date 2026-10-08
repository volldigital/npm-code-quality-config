#!/bin/bash

# Hand over .claude directory to vscode user
sudo chown -R vscode:vscode /home/vscode/.claude

# Set npm minimum release age
npm config set min-release-age=7

# Install npm dependencies
npm ci
