# Jules Backend Server Scripts

## Quick Start

### Start the server (with port conflict resolution):
```bash
./start-server.sh
```

### Stop the server:
```bash
./stop-server.sh
```

## What these scripts do:

### `start-server.sh`
- Checks if port 4000 is already in use
- Automatically kills any existing node processes on port 4000
- Verifies the port is free before starting
- Starts the server with `node index.js`

### `stop-server.sh`
- Finds and stops any node processes running on port 4000
- Uses force kill if necessary to ensure the port is freed
- Provides clear feedback about what's happening

## Why this matters:
- **Port conflicts** were causing the old code to keep running even after updates
- **Manual process killing** was error-prone and time-consuming
- **Automatic resolution** ensures you're always testing the latest code changes

## Usage:
1. Make code changes to `chatController.js` or other files
2. Run `./start-server.sh` to restart with the new code
3. Test your changes
4. Use `./stop-server.sh` when you're done

This ensures you're always testing the actual code you just modified! 