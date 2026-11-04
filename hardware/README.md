# MediVend physical prototype — build guide

The code is done and compile-verified (`kiosk_prototype/kiosk_prototype.ino`,
tested against Uno and both common Nano clone variants). This doc is
everything on the physical side: what to buy, what wire goes where, and how
to bring it up for the first time.

## 1. Parts (see the priced list from earlier in this conversation for costs)

- Arduino Nano clone (or Uno — the code works on either)
- 1x momentary push button (the "dispense" button, hidden under the shell)
- 1x SG90 micro servo
- 1x IR break-beam sensor module (an emitter + a receiver, sold as a pair)
- 1x DS18B20 waterproof temp probe
- 1x 4.7kΩ resistor (for the DS18B20 — usually included with the sensor,
  double check the listing)
- 2x 220Ω resistors (for the LEDs)
- 1x green LED, 1x red LED
- 1x small piezo buzzer
- Breadboard + jumper wires (from the starter kit)
- 4×AA battery holder + batteries (powers the board; **don't** power servos
  and logic from the same tiny USB-only supply if you add more servos later
  — for one SG90 the Nano's own power is fine)

## 2. Wiring

| Component | Pin | Notes |
|---|---|---|
| Dispense button | D4 → other leg to GND | Uses the internal pull-up, so no resistor needed |
| IR receiver output | D3 → other leg to GND | Power the IR emitter+receiver pair per their own module's +/GND pins |
| Servo signal (orange/yellow wire) | D9 | Servo red wire → 5V, brown/black wire → GND |
| DS18B20 data (yellow wire, usually) | D2 | Bridge a 4.7kΩ resistor from D2 to 5V (this is the required pull-up for the sensor's protocol) |
| DS18B20 power (red) / ground (black) | 5V / GND | |
| Green LED | D6 → 220Ω resistor → LED → GND | |
| Red LED | D7 → 220Ω resistor → LED → GND | |
| Buzzer | D8 → other leg to GND | |

Everything above shares the same 5V and GND rails on the breadboard — power
the whole board from the 4×AA pack (into the barrel jack if using an Uno, or
into VIN/GND if using a bare Nano) instead of a laptop USB port, so it's
untethered like a real kiosk and satisfies the "battery power only" rule.

## 3. Physically placing the parts

- **IR break-beam pair**: mount the emitter on one side of your dispense
  chute and the receiver directly across from it, so a falling mock item
  passes between them and blocks the beam for a moment.
- **Servo**: mount it so its arm can push/rotate a small gate or coil that
  releases one mock item per press. Foam board + a hot-glued servo horn
  extension works fine for this.
- **DS18B20 probe**: tuck the probe end down inside the mock "cabinet"
  section near your heat-sensitive mock items (ointment, decongestant,
  sanitizer, sunscreen, cold pack), so warming it there tells the same
  story as the software's thermal lockout.
- **Dispense button**: hidden under the shell somewhere a teammate's hand
  can reach without it being obvious to onlookers.

## 4. First upload

1. Install the [Arduino IDE](https://www.arduino.cc/en/software).
2. Open `hardware/kiosk_prototype/kiosk_prototype.ino` directly (this
   folder/file naming is exactly what the IDE expects — just double-click
   it).
3. In the IDE: **Tools → Board**, pick "Arduino Uno" or "Arduino Nano"
   (whichever you bought), and **Tools → Port**, pick the USB port it shows
   up as once plugged in.
4. **Sketch → Include Library → Manage Libraries**, search for and install:
   `Servo`, `OneWire`, `DallasTemperature`. (These are the exact three this
   sketch needs — already confirmed to compile clean with them.)
5. Click Upload. Open **Tools → Serial Monitor** (9600 baud) — you should
   see `MediVend prototype ready.` and then a temperature line every
   loop.

## 5. Testing checklist before demo day

- [ ] Press the dispense button with nothing blocking the IR beam path yet
      → should hear the descending "jam" tone (this is correct — nothing
      fell through, so no confirmation).
- [ ] Press the dispense button and manually wave your hand through the
      beam gap right after → should hear the rising "success" tone.
- [ ] Hold a hand warmer against the DS18B20 probe → within a few seconds
      the Serial Monitor's temperature reading should climb past 77°F and
      the red LED should turn on.
- [ ] While the red LED is on, press the dispense button → servo should
      **not** move, and you should hear the two-beep "denied" tone.
- [ ] Remove the hand warmer, wait for the probe to cool back down
      (~1°F below 77°F) → red LED turns off, green comes back on, and
      dispensing works again.
- [ ] If your beam confirmation is inverted (success/jam tones backwards
      from what you'd expect), open the sketch and flip
      `BEAM_BROKEN_STATE` from `LOW` to `HIGH` near the top, then
      re-upload.
