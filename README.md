# EXTREME DRIVE: NEXT GEN

A browser-based 3D driving prototype built with Three.js and cannon-es.

## Features in this prototype

- 3D driving scene and chase camera
- Keyboard controls (WASD / arrow keys)
- Basic raycast vehicle physics
- Steering, acceleration, braking and handbrake
- Test road, ramps, barriers, trees and mountains
- Speedometer, RPM and gear display
- Camera modes, reset and vehicle recovery
- Basic mobile touch controls

## Run locally

Because this project uses JavaScript modules, run it through a local web server.

### Option A: VS Code

1. Open this folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html`.
4. Choose **Open with Live Server**.

### Option B: Python

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to Render

1. Push the project folder to a GitHub repository.
2. In Render, choose **New → Static Site**.
3. Connect your GitHub repository.
4. Set **Build Command** to blank.
5. Set **Publish Directory** to `.`.
6. Deploy.

No backend is required for this prototype.

## Controls

| Key | Action |
|---|---|
| W / ↑ | Accelerate |
| S / ↓ | Brake / reverse input |
| A / ← | Steer left |
| D / → | Steer right |
| Space | Handbrake |
| R | Reset vehicle |
| F | Recover / flip vehicle |
| C | Change camera |
| Esc / P | Pause |

## Important limitations

This is a playable foundation, not a BeamNG.drive replacement yet. It uses a simplified vehicle setup and does not currently include soft-body vehicle deformation, detailed tire simulation, damage modeling, multiplayer, save games, or a large optimized open world.

A serious next stage should add:
- Soft-body or deformable vehicle physics
- Per-panel damage and detachable parts
- Better suspension and tire models
- Multiple vehicles and a vehicle garage
- Map streaming and optimized terrain
- Sound design and engine audio
- Settings, input remapping and gamepad support
