// MediVend Health Kiosk — physical prototype
// Dispense mechanism + IR drop confirmation + thermal safety pause
//
// One Arduino, one behavior loop:
//   1. Normal state: pressing the dispense button rotates the servo to
//      drop a mock item down the chute. An IR break-beam sensor across
//      the chute confirms it actually fell through, then the green LED
//      flashes and a success tone plays.
//   2. Judges' "Simulate Heat Wave" state: hold a hand warmer against the
//      DS18B20 probe (placed near the mock heat-sensitive items —
//      ointment, decongestant, sanitizer, sunscreen, cold pack). Once the
//      reading crosses 77°F — the same threshold the kiosk software's own
//      FAQ quotes — the red LED comes on and the dispense button is
//      IGNORED: the servo will not move at all while overheated. This is
//      a real physical lockout, not a fake LED-only indicator.
//      A teammate mirrors this on the laptop by pressing the existing
//      "Trigger Thermal Stability Override" button in the Judges panel at
//      the same moment, so the on-screen catalog locks those items too.
//   3. Removing the hand warmer lets the probe cool back below threshold
//      (with a little hysteresis so it doesn't flicker), which
//      automatically re-enables dispensing.
//
// Wiring:
//   Dispense button   -> pin 4  (to GND; uses internal pull-up)
//   Servo signal       -> pin 9
//   IR receiver output -> pin 3  (to GND when beam is BROKEN — check your
//                                 module; most break-beam receivers pull
//                                 LOW when blocked. Flip BEAM_BROKEN_STATE
//                                 below if yours is the other way.)
//   DS18B20 data        -> pin 2  (4.7k ohm pull-up resistor to 5V)
//   Green LED           -> pin 6  (through ~220 ohm resistor to GND)
//   Red LED             -> pin 7  (through ~220 ohm resistor to GND)
//   Buzzer              -> pin 8
//
// Libraries needed (Arduino Library Manager): "Servo" (built in),
// "OneWire", and "DallasTemperature".

#include <Servo.h>
#include <OneWire.h>
#include <DallasTemperature.h>

const int BUTTON_PIN = 4;
const int SERVO_PIN = 9;
const int IR_PIN = 3;
const int ONE_WIRE_PIN = 2;
const int GREEN_LED_PIN = 6;
const int RED_LED_PIN = 7;
const int BUZZER_PIN = 8;

// Most IR break-beam receiver modules read LOW when something blocks the
// beam. If yours does the opposite, change this to HIGH.
const int BEAM_BROKEN_STATE = LOW;

const int SERVO_HOME_ANGLE = 0;
const int SERVO_DISPENSE_ANGLE = 90;
const unsigned long DROP_CONFIRM_TIMEOUT_MS = 1500;

// Matches the 77°F cabinet-lockout threshold already quoted to customers
// in the kiosk's own AI assistant (knowledge.js).
const float THRESHOLD_F = 77.0;
const float HYSTERESIS_F = 1.0;

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature sensors(&oneWire);
Servo dispenseServo;

bool overheated = false;
bool lastButtonState = HIGH; // HIGH = not pressed (internal pull-up)

void setup() {
  Serial.begin(9600);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(IR_PIN, INPUT_PULLUP);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  sensors.begin();
  dispenseServo.attach(SERVO_PIN);
  dispenseServo.write(SERVO_HOME_ANGLE);

  setLeds(false);
  Serial.println("MediVend prototype ready.");
}

void setLeds(bool isOverheated) {
  digitalWrite(GREEN_LED_PIN, isOverheated ? LOW : HIGH);
  digitalWrite(RED_LED_PIN, isOverheated ? HIGH : LOW);
}

void updateTemperature() {
  sensors.requestTemperatures();
  float tempF = sensors.getTempFByIndex(0);

  if (tempF == DEVICE_DISCONNECTED_F) {
    Serial.println("Temp sensor disconnected — check wiring.");
    return;
  }

  if (!overheated && tempF >= THRESHOLD_F + HYSTERESIS_F) {
    overheated = true;
    Serial.println("Cabinet OVERHEATED — dispensing paused.");
  } else if (overheated && tempF <= THRESHOLD_F - HYSTERESIS_F) {
    overheated = false;
    Serial.println("Cabinet back to normal — dispensing re-enabled.");
  }

  setLeds(overheated);
  Serial.print("Cabinet temp: ");
  Serial.print(tempF);
  Serial.println(" F");
}

// Short double-beep: "denied" (dispense blocked by heat lockout).
void playDeniedTone() {
  tone(BUZZER_PIN, 220, 120);
  delay(160);
  tone(BUZZER_PIN, 220, 120);
}

// Rising beep: dispense confirmed by the IR beam.
void playSuccessTone() {
  tone(BUZZER_PIN, 880, 150);
}

// Falling beep: servo fired but nothing was detected falling through the
// chute in time (a "jam" — mirrors the kiosk's own dispenser-jam scenario).
void playJamTone() {
  tone(BUZZER_PIN, 440, 200);
  delay(220);
  tone(BUZZER_PIN, 300, 300);
}

void handleDispenseRequest() {
  if (overheated) {
    Serial.println("Dispense blocked: cabinet is overheated.");
    playDeniedTone();
    return;
  }

  Serial.println("Dispensing...");
  dispenseServo.write(SERVO_DISPENSE_ANGLE);

  bool confirmed = false;
  unsigned long start = millis();
  while (millis() - start < DROP_CONFIRM_TIMEOUT_MS) {
    if (digitalRead(IR_PIN) == BEAM_BROKEN_STATE) {
      confirmed = true;
      break;
    }
  }

  dispenseServo.write(SERVO_HOME_ANGLE);

  if (confirmed) {
    Serial.println("Drop confirmed by IR beam.");
    playSuccessTone();
  } else {
    Serial.println("No drop detected — possible jam.");
    playJamTone();
  }
}

void loop() {
  updateTemperature();

  bool buttonState = digitalRead(BUTTON_PIN);
  if (buttonState == LOW && lastButtonState == HIGH) {
    handleDispenseRequest();
  }
  lastButtonState = buttonState;

  delay(50);
}
