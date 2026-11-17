# Live effect controls

Replace the narrow intensity control with explicit Visibility (0–100%), Motion speed (0.25–3×), and Particle size (0.5–2.5×). Keep existing effectIntensity values compatible; the newly added speed and size default to 1×. Store all controls in appearance and apply changes immediately.

Use one integrated animation clock for ambient movement and existing/new typing trails. Speed changes update its rate, without jumping positions or leaving old trails at the old speed. Keep the active particle cap and reduced-motion behavior. Zero visibility hides and stops the effect. Improve opacity coefficients so ordinary slider changes are visible, and add moving pulses to the otherwise static circuit profile.

Add a self-contained, non-interactive live preview in Atmosphere, using the same engine and settings. It emits abstract sample trails without sending input to any PTY. Stop preview rendering when the settings dialog is closed. Right-click the sparkle button or choose Effect settings in Commands to jump directly to these controls.

Verify control endpoints, real animation clock changes, immediate updates, persistence after restart, preview layout and the existing native terminal regressions. Separately inspect Codex color output from a clean PTY instead of interpreting the old process's retained environment as a rendering failure.
